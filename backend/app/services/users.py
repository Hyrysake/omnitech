"""Логіка користувачів: реєстрація, вхід, профіль. Нічого не знає про HTTP — лише про дані."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BadRequestError, ConflictError, UnprocessableError
from app.core.security import DUMMY_HASH, hash_password, verify_password
from app.db.pagination import PageParams, paginate
from app.models import User
from app.models.user import ROLE_CLIENT
from app.schemas.auth import RegisterIn
from app.schemas.user import PasswordChange, UserUpdate


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def register(db: Session, data: RegisterIn) -> User:
    """Створює клієнта. Адміністратора через API створити не можна — лише через seed."""
    if get_by_email(db, data.email) is not None:
        raise ConflictError('Акаунт із такою поштою вже існує. Спробуйте увійти.')
    user = User(name=data.name, email=data.email, password_hash=hash_password(data.password), role=ROLE_CLIENT)
    db.add(user)
    db.commit()
    db.refresh(user)     # підтягуємо з бази id і created_at, які поставила сама база
    return user


def authenticate(db: Session, email: str, password: str) -> User | None:
    """Повертає користувача, якщо пошта й пароль правильні, інакше None.

    Для неіснуючої пошти все одно перевіряємо пароль (проти DUMMY_HASH), щоб відповідь
    займала однаковий час: інакше за швидкістю можна було б дізнатися, які пошти зареєстровані.
    """
    user = get_by_email(db, email)
    if user is None:
        verify_password(password, DUMMY_HASH)
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def update_profile(db: Session, user: User, data: UserUpdate) -> User:
    """Змінює лише передані поля (exclude_unset: поле, якого не було в запиті, не чіпаємо)."""
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if value is None:
            raise UnprocessableError('Поле не можна очистити значенням null: просто не передавайте його.', field=field)
    if 'email' in changes and changes['email'] != user.email:
        if get_by_email(db, changes['email']) is not None:
            raise ConflictError('Ця пошта вже зайнята іншим акаунтом.')
    for field, value in changes.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, data: PasswordChange) -> None:
    if not verify_password(data.current_password, user.password_hash):
        raise BadRequestError('Поточний пароль неправильний.', field='current_password')
    user.password_hash = hash_password(data.new_password)
    db.commit()


def delete_account(db: Session, user: User) -> None:
    """Видаляє власний акаунт.

    Записи інших таблиць, що посилаються на користувача (відгуки, замовлення, список бажань — їх додають
    наступні частини проєкту), база обробляє сама за правилами їхніх зовнішніх ключів (SET NULL / CASCADE).
    """
    if user.is_admin:
        raise ConflictError('Адміністратор не може видалити власний акаунт через API.')
    db.delete(user)
    db.commit()


def list_users(db: Session, params: PageParams, q: str | None = None) -> dict:
    """Сторінка користувачів для адміністратора; q шукає в імені й пошті."""
    statement = select(User).order_by(User.id)
    if q:
        statement = statement.where(User.name.icontains(q, autoescape=True) | User.email.icontains(q, autoescape=True))
    return paginate(db, statement, params)
