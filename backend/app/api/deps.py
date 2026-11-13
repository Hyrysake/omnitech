"""Залежності (Depends) — спільні «шматки», які FastAPI підставляє в ендпоінти сам.

Ендпоінт оголошує параметр, наприклад `user: CurrentUser`, і FastAPI перед викликом:
дістає токен із заголовка, перевіряє його, читає користувача з бази й передає готовий об'єкт.
Якщо щось не так — ендпоінт навіть не викликається, клієнт одразу отримує 401 чи 403.
"""

from collections.abc import Iterator
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Path, Query, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.pagination import PageParams
from app.db.session import SessionLocal
from app.models import User


def get_db() -> Iterator[Session]:
    """Одна сесія бази на один запит. Після відповіді `with` закриває її навіть у разі помилки."""
    with SessionLocal() as db:
        yield db


DbSession = Annotated[Session, Depends(get_db)]

# Звідки брати токен: заголовок Authorization: Bearer <токен>. tokenUrl — адреса входу,
# її використовує кнопка Authorize у /docs. auto_error=False: якщо токена немає, повертаємо
# не стандартну англійську помилку, а свою (і дозволяємо «необов'язковий» вхід нижче)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/v1/auth/token', auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    # Заголовок WWW-Authenticate: Bearer для 401 вимагає стандарт HTTP: він каже, як саме увійти
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, headers={'WWW-Authenticate': 'Bearer'})


def _user_from_token(db: Session, token: str) -> User:
    """Перевіряє токен і повертає користувача з бази або кидає 401."""
    try:
        payload = decode_access_token(token)
        user_id = int(payload['sub'])
    except jwt.ExpiredSignatureError:
        raise _unauthorized('Термін дії входу минув. Увійдіть знову.')
    except (jwt.InvalidTokenError, KeyError, ValueError, OverflowError):
        raise _unauthorized('Недійсний токен входу.')
    # Роль беремо з бази, а не з токена: якщо адмін втратив права, це діє одразу
    user = db.get(User, user_id) if 0 < user_id <= MAX_ID else None
    if user is None:
        raise _unauthorized('Акаунт не знайдено. Увійдіть знову.')
    return user


def get_current_user(db: DbSession, token: Annotated[str | None, Depends(oauth2_scheme)]) -> User:
    """Користувач, який увійшов. Без токена — 401."""
    if token is None:
        raise _unauthorized('Потрібно увійти.')
    return _user_from_token(db, token)


def get_optional_user(db: DbSession, token: Annotated[str | None, Depends(oauth2_scheme)]) -> User | None:
    """Для ендпоінтів, відкритих і гостям (оформлення замовлення): без токена — None.

    Якщо токен передали, але він недійсний, це 401, а не тихий перехід у гості:
    інакше людина думала б, що замовлення прив'язане до її акаунта.
    """
    if token is None:
        return None
    return _user_from_token(db, token)


def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    """Лише адміністратор. Гість отримає 401 (від get_current_user), клієнт — 403."""
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, 'Потрібні права адміністратора.')
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
AdminUser = Annotated[User, Depends(require_admin)]


def get_page_params(
    page: Annotated[int, Query(ge=1, le=10_000, description='Номер сторінки, від 1')] = 1,
    size: Annotated[int, Query(ge=1, le=50, description='Записів на сторінці, від 1 до 50')] = 12,
) -> PageParams:
    """Параметри ?page=&size= для будь-якого списку. Більше 50 на сторінку не можна: захист від надто важких запитів."""
    return PageParams(page=page, size=size)


Pagination = Annotated[PageParams, Depends(get_page_params)]

# Найбільший номер запису. Без межі номер на кшталт 99999999999999999999 не влазить у ціле число
# SQLite, і сервер падав би з 500 замість зрозумілої відповіді 422
MAX_ID = 2_147_483_647

# Номер запису в адресі (/products/{product_id}): ціле число від 1 до MAX_ID
Id = Annotated[int, Path(gt=0, le=MAX_ID, description='Номер запису')]
