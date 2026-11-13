"""Список бажань (таблиця wishlist_items): зв'язок «багато до багатьох» між користувачами й товарами."""

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedAtMixin
from app.models.product import Product


class WishlistItem(CreatedAtMixin, Base):
    """Пара (користувач, товар). Складений первинний ключ із двох стовпців не дасть додати товар двічі.

    CASCADE з обох боків: видалили акаунт чи товар — запис зі списку бажань зникає.
    """

    __tablename__ = 'wishlist_items'

    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id', ondelete='CASCADE'), primary_key=True)

    product: Mapped[Product] = relationship(lazy='joined')
