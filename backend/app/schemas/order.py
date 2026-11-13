"""Схеми кошика й замовлень."""

from datetime import datetime
from typing import Annotated

from pydantic import Field

from app.core.validators import Email, Name, Phone
from app.models.order import OrderStatus
from app.schemas.common import InputModel, OutputModel

MAX_QUANTITY = 99     # більше штук одного товару не замовити (як у кошику Lab 04)
MAX_LINES = 50        # більше різних товарів в одному замовленні не буває


class CartItemIn(InputModel):
    product_id: Annotated[int, Field(gt=0, le=2_147_483_647, strict=True, examples=[1])]
    quantity: Annotated[int, Field(ge=1, le=MAX_QUANTITY, strict=True, examples=[2])]


class CartIn(InputModel):
    """Кошик зберігає клієнт (у Lab 06 — localStorage браузера); сервер лише рахує його."""

    items: Annotated[list[CartItemIn], Field(min_length=1, max_length=MAX_LINES)]


class ProductShort(OutputModel):
    id: int
    name: str
    price: int
    image_url: str


class CartLineOut(OutputModel):
    product: ProductShort
    quantity: int
    line_total: int


class CartPreviewOut(OutputModel):
    lines: list[CartLineOut]
    missing: list[int] = Field(description='Номери товарів, яких уже немає в каталозі (прибрати з кошика)')
    count: int = Field(description='Скільки штук усього')
    total: int = Field(description='Сума за актуальними цінами, грн')


class OrderCreate(CartIn):
    """Оформлення: дані покупця + товари. Ціни клієнт НЕ надсилає — сервер бере їх з бази."""

    customer_name: Name
    phone: Phone
    email: Email
    address: Annotated[str, Field(min_length=5, max_length=300, examples=['м. Луцьк, вул. Лесі Українки, 12'])]


class OrderItemOut(OutputModel):
    product_id: int
    product_name: str
    quantity: int
    price: int = Field(description='Ціна за штуку на момент покупки')
    line_total: int


class OrderOut(OutputModel):
    id: int
    user_id: int | None
    customer_name: str
    phone: str
    email: str
    address: str
    total: int
    status: OrderStatus
    created_at: datetime
    items: list[OrderItemOut]


class OrderStatusUpdate(InputModel):
    status: OrderStatus
