"""Демонстраційні замовлення й повідомлення зворотного зв'язку (ті самі дані, що й у Lab 04)."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Feedback, Order, OrderItem, OrderStatus, Product, User

# Відгуки з форми «Контакти»: (ім'я, email, текст, прочитано, коли надіслано).
FEEDBACK = [
    ('Максим Ткачук', 'maksym@example.com',
     'Дякую за швидку доставку! Геймпад приїхав наступного дня, упаковка ціла.', 1, '2026-10-09 18:20:00'),
    ('Ірина Мельник', 'iryna@example.com',
     'Чи можна відкласти ноутбук на два дні? Хочу показати його чоловікові перед покупкою.', 0, '2026-10-12 11:05:00'),
    ('Остап Гнатюк', 'ostap@example.com',
     'На сторінці камери немає розміру матриці. Додайте, будь ласка, повні характеристики.', 0, '2026-10-13 09:40:00'),
]

# Демонстраційні замовлення, щоб адмін-панель одразу була не порожньою.
# (email акаунта або None для гостя, ім'я, телефон, email, адреса, статус, дата, [(товар, кількість), ...])
ORDERS = [
    ('client@omnitech.example', 'Олена Коваль', '+380501112233', 'client@omnitech.example',
     'м. Луцьк, вул. Лесі Українки, 12, кв. 5', 'completed', '2026-10-08 12:30:00',
     [('Бездротовий геймпад Pulse', 1), ('Бездротова миша Glide', 2)]),
    (None, 'Петро Савчук', '+380672223344', 'petro@example.com',
     'м. Рівне, відділення Нової пошти №3', 'shipped', '2026-10-11 16:45:00',
     [('Смартфон Nova X 128 ГБ', 1)]),
    ('client@omnitech.example', 'Олена Коваль', '+380501112233', 'client@omnitech.example',
     'м. Луцьк, вул. Лесі Українки, 12, кв. 5', 'processing', '2026-10-13 10:15:00',
     [('Навушники Studio Over-ear', 1), ('Монітор Vista 27"', 1)]),
    (None, 'Марія Бондар', '+380933334455', 'maria@example.com',
     'м. Ковель, вул. Незалежності, 7', 'new', '2026-10-14 20:05:00',
     [('Ноутбук OmniBook Air 14', 1)]),
]


def seed_orders(db: Session) -> None:
    if db.scalar(select(Feedback.id).limit(1)) is None:
        db.add_all(
            Feedback(name=name, email=email, message=message, is_read=bool(is_read),
                     created_at=datetime.fromisoformat(created_at))
            for name, email, message, is_read, created_at in FEEDBACK
        )
    if db.scalar(select(Order.id).limit(1)) is not None:
        return
    products = {product.name: product for product in db.scalars(select(Product))}
    user_ids = dict(db.execute(select(User.email, User.id)).all())
    for user_email, name, phone, email, address, status, created_at, lines in ORDERS:
        items = [OrderItem(product_id=products[product].id, quantity=quantity, price=products[product].price)
                 for product, quantity in lines]
        db.add(Order(
            user_id=user_ids.get(user_email), customer_name=name, phone=phone, email=email, address=address,
            status=OrderStatus(status), created_at=datetime.fromisoformat(created_at),
            total=sum(item.price * item.quantity for item in items), items=items,
        ))
    db.flush()
