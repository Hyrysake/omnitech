"""Моделі замовлення (orders) і його рядків (order_items)."""

from enum import StrEnum

from sqlalchemy import CheckConstraint, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import NO_ID_REUSE, Base, CreatedAtMixin
from app.models.product import Product


class OrderStatus(StrEnum):
    """Статуси замовлення в порядку його «життя». StrEnum: значення — звичайні рядки ('new'…)."""

    NEW = 'new'
    PROCESSING = 'processing'
    SHIPPED = 'shipped'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'


class Order(CreatedAtMixin, Base):
    """Замовлення. user_id порожній (NULL), якщо оформив гість без акаунта.

    SET NULL: видалили акаунт — замовлення лишається (воно потрібне магазину), зв'язок обнуляється.
    """

    __tablename__ = 'orders'
    __table_args__ = (CheckConstraint('total >= 0', name='ck_orders_total'), NO_ID_REUSE)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), index=True)
    customer_name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(254))
    address: Mapped[str] = mapped_column(String(300))
    total: Mapped[int]
    # native_enum=False: у SQLite немає типу ENUM, тому це рядок + CHECK зі списком дозволених значень
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, native_enum=False, length=20, values_callable=lambda enum: [item.value for item in enum]),
        default=OrderStatus.NEW,
    )

    # Рядки замовлення. cascade='all, delete-orphan': рядки створюються й видаляються разом із замовленням.
    # lazy='selectin' — усі рядки сторінки замовлень підтягуються ОДНИМ додатковим запитом
    items: Mapped[list['OrderItem']] = relationship(cascade='all, delete-orphan', lazy='selectin',
                                                    order_by='OrderItem.id')


class OrderItem(Base):
    """Рядок замовлення: який товар, скільки штук і за якою ціною.

    price — ціна НА МОМЕНТ ПОКУПКИ: пізніша зміна ціни товару не переписує старі замовлення.
    RESTRICT: товар, який хтось купив, видалити не можна (інакше зламається історія замовлень).
    """

    __tablename__ = 'order_items'
    __table_args__ = (
        CheckConstraint('quantity > 0', name='ck_order_items_quantity'),
        CheckConstraint('price > 0', name='ck_order_items_price'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey('orders.id', ondelete='CASCADE'), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id', ondelete='RESTRICT'), index=True)
    quantity: Mapped[int]
    price: Mapped[int]

    product: Mapped[Product] = relationship(lazy='selectin')

    @property
    def product_name(self) -> str:
        return self.product.name

    @property
    def line_total(self) -> int:
        return self.price * self.quantity
