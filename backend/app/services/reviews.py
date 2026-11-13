"""Логіка відгуків: читання, створення, зміна, видалення, модерація."""

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.errors import ConflictError, NotFoundError, PermissionDeniedError, UnprocessableError
from app.db.pagination import PageParams, paginate
from app.models import Review, User
from app.schemas.review import ReviewIn, ReviewUpdate
from app.services.catalog import get_product


def list_for_product(db: Session, product_id: int, params: PageParams) -> dict:
    get_product(db, product_id)     # 404, якщо товару немає (а не порожній список)
    statement = (select(Review).where(Review.product_id == product_id)
                 .order_by(Review.created_at.desc(), Review.id.desc()))
    return paginate(db, statement, params)


def get_review(db: Session, review_id: int) -> Review:
    review = db.get(Review, review_id)
    if review is None:
        raise NotFoundError('Відгук не знайдено.')
    return review


def create(db: Session, product_id: int, user: User, data: ReviewIn) -> Review:
    """Один користувач — один відгук про товар. Другий раз — 409 з підказкою змінити наявний."""
    get_product(db, product_id)
    existing = db.scalar(select(Review.id).where(Review.product_id == product_id, Review.user_id == user.id))
    if existing is not None:
        raise ConflictError(f'Ви вже залишили відгук про цей товар (№{existing}). Змініть його через PATCH.')
    review = Review(product_id=product_id, user_id=user.id, author_name=user.name, **data.model_dump())
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


def update(db: Session, review_id: int, user: User, data: ReviewUpdate) -> Review:
    """Змінити відгук може лише його автор (навіть адміністратор чужий текст не переписує)."""
    review = get_review(db, review_id)
    if review.user_id != user.id:
        raise PermissionDeniedError('Змінювати можна лише власний відгук.')
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if value is None:
            raise UnprocessableError('Поле не можна очистити значенням null: просто не передавайте його.', field=field)
    for field, value in changes.items():
        setattr(review, field, value)
    db.commit()
    db.refresh(review)
    return review


def delete(db: Session, review_id: int, user: User) -> None:
    """Видалити може автор або адміністратор (модерація)."""
    review = get_review(db, review_id)
    if review.user_id != user.id and not user.is_admin:
        raise PermissionDeniedError('Видаляти можна лише власний відгук.')
    db.delete(review)
    db.commit()


def list_all(db: Session, params: PageParams) -> dict:
    """Усі відгуки з назвою товару — для сторінки модерації.

    joinedload: товар підтягується тим самим запитом (JOIN), а не окремим запитом на кожен відгук
    (інакше 12 відгуків = 13 запитів — так звана проблема N+1).
    """
    statement = (select(Review).options(joinedload(Review.product))
                 .order_by(Review.created_at.desc(), Review.id.desc()))
    return paginate(db, statement, params)
