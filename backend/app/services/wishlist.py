"""Логіка списку бажань. Додавання й видалення ідемпотентні: повтор не змінює результат і не дає помилки."""

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Product, User, WishlistItem
from app.services.catalog import get_product


def list_products(db: Session, user: User) -> list[Product]:
    """Товари зі списку користувача, останні додані — першими."""
    items = db.scalars(select(WishlistItem).where(WishlistItem.user_id == user.id)
                       .order_by(WishlistItem.created_at.desc(), WishlistItem.product_id.desc())).all()
    return [item.product for item in items]


def add(db: Session, user: User, product_id: int) -> None:
    get_product(db, product_id)     # 404 для неіснуючого товару
    if db.get(WishlistItem, (user.id, product_id)) is None:   # пошук за складеним ключем
        db.add(WishlistItem(user_id=user.id, product_id=product_id))
        db.commit()


def remove(db: Session, user: User, product_id: int) -> None:
    db.execute(delete(WishlistItem).where(WishlistItem.user_id == user.id, WishlistItem.product_id == product_id))
    db.commit()
