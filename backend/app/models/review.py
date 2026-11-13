"""Модель відгуку про товар (таблиця reviews)."""

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import NO_ID_REUSE, Base, CreatedAtMixin
from app.models.product import Product


class Review(CreatedAtMixin, Base):
    """Один користувач — один відгук про товар (UniqueConstraint).

    CASCADE: товар видалили — його відгуки зникають. SET NULL: видалили акаунт — відгук лишається,
    а author_name зберігає ім'я автора. Демонстраційні відгуки мають user_id = NULL.
    """

    __tablename__ = 'reviews'
    __table_args__ = (
        UniqueConstraint('product_id', 'user_id', name='uq_reviews_product_user'),
        CheckConstraint('rating BETWEEN 1 AND 5', name='ck_reviews_rating'),
        NO_ID_REUSE,
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id', ondelete='CASCADE'), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'))
    author_name: Mapped[str] = mapped_column(String(100))
    rating: Mapped[int]
    text: Mapped[str] = mapped_column(Text)

    # Товар відгуку. lazy='raise' — випадково завантажити його окремим запитом не вийде (буде помилка):
    # там, де назва товару потрібна, запит явно просить її через joinedload (див. services/reviews.py)
    product: Mapped[Product] = relationship(lazy='raise')

    @property
    def product_name(self) -> str:
        return self.product.name
