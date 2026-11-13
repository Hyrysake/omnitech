"""Модель товару (таблиця products)."""

from sqlalchemy import CheckConstraint, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import NO_ID_REUSE, Base, CreatedAtMixin
from app.models.category import Category


class Product(CreatedAtMixin, Base):
    """Товар належить одній категорії (зв'язок «багато до одного»).

    ondelete='RESTRICT': базу не дасть видалити категорію, у якій ще є товари.
    CheckConstraint повторює правило Pydantic (ціна > 0) на рівні самої бази —
    останній рубіж, навіть якщо хтось запише дані в обхід API.
    """

    __tablename__ = 'products'
    __table_args__ = (CheckConstraint('price > 0', name='ck_products_price_positive'), NO_ID_REUSE)

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey('categories.id', ondelete='RESTRICT'), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default='')
    price: Mapped[int]                                   # ціна в гривнях, ціле число
    image_url: Mapped[str] = mapped_column(String(500), default='')
    is_featured: Mapped[bool] = mapped_column(default=False)   # показувати на головній

    # relationship — зв'язок на рівні Python: product.category повертає об'єкт Category.
    # lazy='joined' — категорія завантажується тим самим запитом (JOIN), а не окремим для кожного товару
    category: Mapped[Category] = relationship(lazy='joined')
