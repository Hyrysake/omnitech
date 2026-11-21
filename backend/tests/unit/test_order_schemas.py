"""Unit тести схем CartIn та OrderCreate: межі кількості, довжина кошика, телефон, зайві поля.

Pydantic перевіряє дані ще до того, як вони потрапляють у сервіс. Без бази й сервера це
перевіряється прямим створенням схеми: неправильні дані дають ValidationError.
"""

import pytest
from pydantic import ValidationError

from app.schemas.order import MAX_LINES, MAX_QUANTITY, CartIn, OrderCreate


def make_items(count, quantity=1):
    """Список із count різних товарів."""
    return [{'product_id': number, 'quantity': quantity} for number in range(1, count + 1)]


def make_order(**changes):
    """Правильні дані замовлення; тест змінює лише те, що перевіряє."""
    data = {
        'items': make_items(1),
        'customer_name': 'Олена Коваль',
        'phone': '+380501234567',
        'email': 'olena@example.com',
        'address': 'м. Луцьк, вул. Лесі Українки, 12',
    }
    data.update(changes)
    return data


# ---------- кількість рядків у кошику ----------

@pytest.mark.parametrize('count', [1, 2, MAX_LINES])
def test_cart_accepts_valid_number_of_lines(count):
    cart = CartIn(items=make_items(count))

    assert len(cart.items) == count


@pytest.mark.parametrize('count', [0, MAX_LINES + 1])
def test_cart_rejects_wrong_number_of_lines(count):
    with pytest.raises(ValidationError):
        CartIn(items=make_items(count))


# ---------- кількість штук ----------

@pytest.mark.parametrize('quantity', [1, 2, MAX_QUANTITY])
def test_cart_accepts_valid_quantity(quantity):
    cart = CartIn(items=make_items(1, quantity))

    assert cart.items[0].quantity == quantity


@pytest.mark.parametrize('quantity', [0, -1, MAX_QUANTITY + 1])
def test_cart_rejects_wrong_quantity(quantity):
    with pytest.raises(ValidationError):
        CartIn(items=make_items(1, quantity))


def test_cart_rejects_quantity_as_string():
    # strict=True: "2" як рядок не перетворюється мовчки на число
    with pytest.raises(ValidationError):
        CartIn(items=[{'product_id': 1, 'quantity': '2'}])


@pytest.mark.parametrize('product_id', [0, -5])
def test_cart_rejects_non_positive_product_id(product_id):
    with pytest.raises(ValidationError):
        CartIn(items=[{'product_id': product_id, 'quantity': 1}])


# ---------- телефон ----------

@pytest.mark.parametrize('phone', [
    '+380501234567',        # 12 цифр із плюсом
    '050 123 45 67',        # пробіли дозволені
    '(050) 123-45-67',      # дужки й дефіси теж
    '0501234567',           # рівно 10 цифр — нижня межа
])
def test_order_accepts_good_phone(phone):
    order = OrderCreate(**make_order(phone=phone))

    assert order.phone == phone


@pytest.mark.parametrize('phone', [
    '12345',                # замало цифр
    '050123456',            # 9 цифр — на одну менше за межу
    'телефон',              # взагалі без цифр
    '050123456a',           # літера всередині
    '+3805012345678901',    # забагато цифр
])
def test_order_rejects_bad_phone(phone):
    with pytest.raises(ValidationError):
        OrderCreate(**make_order(phone=phone))


# ---------- зайві поля ----------

def test_order_rejects_extra_price_field():
    # Ціну клієнт надсилати не може: extra='forbid' перетворює її на помилку
    with pytest.raises(ValidationError) as error:
        OrderCreate(**make_order(price=1))

    assert error.value.errors()[0]['loc'] == ('price',)


def test_cart_item_rejects_extra_price_field():
    with pytest.raises(ValidationError):
        CartIn(items=[{'product_id': 1, 'quantity': 1, 'price': 1}])


def test_order_rejects_short_address():
    with pytest.raises(ValidationError):
        OrderCreate(**make_order(address='вул'))
