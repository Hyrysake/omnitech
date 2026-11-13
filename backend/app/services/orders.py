"""Логіка кошика й замовлень.

Кошик живе в клієнта (браузер, Postman), сервер нічого не запам'ятовує між запитами.
Тому ціни й наявність ЗАВЖДИ перевіряються на сервері: клієнт міг змінити ціну у своєму кошику,
але замовлення рахується лише за цінами з бази.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError, UnprocessableError
from app.db.pagination import PageParams, paginate
from app.models import Order, OrderItem, OrderStatus, Product, User
from app.schemas.order import MAX_QUANTITY, CartItemIn, OrderCreate


def _merge_items(items: list[CartItemIn]) -> dict[int, int]:
    """Однаковий товар у кількох рядках об'єднуємо: {product_id: загальна кількість}."""
    merged: dict[int, int] = {}
    for item in items:
        merged[item.product_id] = merged.get(item.product_id, 0) + item.quantity
    too_many = [product_id for product_id, quantity in merged.items() if quantity > MAX_QUANTITY]
    if too_many:
        raise UnprocessableError(f'Не більше {MAX_QUANTITY} шт. одного товару (товар №{too_many[0]}).', field='items')
    return merged


def _load_products(db: Session, product_ids) -> dict[int, Product]:
    """Усі потрібні товари одним запитом (WHERE id IN (...)), а не окремим запитом на кожен."""
    return {product.id: product for product in db.scalars(select(Product).where(Product.id.in_(product_ids)))}


def preview_cart(db: Session, items: list[CartItemIn]) -> dict:
    """Рахує кошик за актуальними цінами. Неіснуючі товари не помилка, а список missing."""
    merged = _merge_items(items)
    products = _load_products(db, merged)
    lines = [{'product': products[product_id], 'quantity': quantity,
              'line_total': products[product_id].price * quantity}
             for product_id, quantity in merged.items() if product_id in products]
    return {
        'lines': lines,
        'missing': [product_id for product_id in merged if product_id not in products],
        'count': sum(line['quantity'] for line in lines),
        'total': sum(line['line_total'] for line in lines),
    }


def create_order(db: Session, data: OrderCreate, user: User | None) -> Order:
    """Створює замовлення одним commit: або замовлення з усіма рядками, або нічого (транзакція)."""
    merged = _merge_items(data.items)
    products = _load_products(db, merged)
    missing = [product_id for product_id in merged if product_id not in products]
    if missing:
        raise NotFoundError(f'Товару №{missing[0]} уже немає в каталозі. Оновіть кошик.')
    items = [OrderItem(product_id=product_id, quantity=quantity, price=products[product_id].price)
             for product_id, quantity in merged.items()]
    order = Order(
        user_id=user.id if user else None,
        customer_name=data.customer_name, phone=data.phone, email=data.email, address=data.address,
        total=sum(item.price * item.quantity for item in items),
        items=items,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def list_user_orders(db: Session, user: User, params: PageParams) -> dict:
    statement = select(Order).where(Order.user_id == user.id).order_by(Order.created_at.desc(), Order.id.desc())
    return paginate(db, statement, params)


def get_user_order(db: Session, user: User, order_id: int) -> Order:
    """Чуже замовлення — 404, а не 403: не підказуємо, що замовлення з таким номером існує."""
    order = db.get(Order, order_id)
    if order is None or order.user_id != user.id:
        raise NotFoundError('Замовлення не знайдено.')
    return order


# ---------- Адміністратор ----------


def list_orders(db: Session, params: PageParams, status: OrderStatus | None = None) -> dict:
    statement = select(Order).order_by(Order.created_at.desc(), Order.id.desc())
    if status is not None:
        statement = statement.where(Order.status == status)
    return paginate(db, statement, params)


def get_order(db: Session, order_id: int) -> Order:
    order = db.get(Order, order_id)
    if order is None:
        raise NotFoundError('Замовлення не знайдено.')
    return order


def set_status(db: Session, order_id: int, status: OrderStatus) -> Order:
    order = get_order(db, order_id)
    order.status = status
    db.commit()
    db.refresh(order)
    return order


def delete_order(db: Session, order_id: int) -> None:
    order = get_order(db, order_id)
    db.delete(order)        # рядки видаляються разом із замовленням (cascade)
    db.commit()
