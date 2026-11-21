"""Unit тести логіки замовлень: order_total, _merge_items і OrderItem.line_total.

Усе тут працює без бази й без HTTP: функції отримують звичайні дані й повертають результат.
Тому тести швидкі, а при падінні одразу зрозуміло, у якій функції помилка.
"""

import pytest

from app.core.errors import UnprocessableError
from app.models import OrderItem
from app.schemas.order import MAX_QUANTITY, CartItemIn
from app.services.orders import _merge_items, order_total


# ---------- order_total ----------

@pytest.mark.parametrize('rows, expected', [
    ([], 0),                                  # порожнє замовлення коштує 0
    ([(25000, 1)], 25000),                    # один рядок, одна штука
    ([(100, 2), (350, 3)], 1250),             # кілька рядків: 200 + 1050
    ([(19999, 99)], 1979901),                 # максимальна кількість одного товару
], ids=['empty', 'one-line', 'two-lines', 'max-quantity'])   # назви випадків у звіті pytest -v замість rows0, rows1…
def test_order_total_sums_price_times_quantity(rows, expected):
    # Act
    result = order_total(rows)

    # Assert
    assert result == expected


def test_order_total_accepts_generator():
    # У сервісі в order_total передають генератор, тож перевіряємо саме його
    rows = ((price, 2) for price in (10, 20, 30))

    assert order_total(rows) == 120


# ---------- _merge_items ----------

def test_merge_items_keeps_different_products_separate():
    items = [CartItemIn(product_id=1, quantity=2), CartItemIn(product_id=2, quantity=5)]

    assert _merge_items(items) == {1: 2, 2: 5}


def test_merge_items_sums_duplicates():
    # Arrange: той самий товар у двох рядках кошика
    items = [CartItemIn(product_id=7, quantity=2), CartItemIn(product_id=7, quantity=3)]

    # Act
    merged = _merge_items(items)

    # Assert
    assert merged == {7: 5}


def test_merge_items_allows_exactly_max_quantity():
    # Межа: рівно 99 ще можна
    items = [CartItemIn(product_id=1, quantity=MAX_QUANTITY)]

    assert _merge_items(items) == {1: MAX_QUANTITY}


def test_merge_items_allows_max_quantity_split_in_two_lines():
    items = [CartItemIn(product_id=1, quantity=90), CartItemIn(product_id=1, quantity=9)]

    assert _merge_items(items) == {1: 99}


def test_merge_items_rejects_sum_over_max_quantity():
    # Кожен рядок окремо в межах 99, але разом 100 — схема цього не бачить, тому перевіряє сервіс
    items = [CartItemIn(product_id=1, quantity=90), CartItemIn(product_id=1, quantity=10)]

    with pytest.raises(UnprocessableError) as error:
        _merge_items(items)

    assert error.value.field == 'items'
    assert '№1' in error.value.detail


# ---------- OrderItem.line_total ----------

@pytest.mark.parametrize('price, quantity, expected', [
    (100, 1, 100),
    (25000, 3, 75000),
    (1, 99, 99),
])
def test_order_item_line_total_is_price_times_quantity(price, quantity, expected):
    # Об'єкт не додаємо в базу: line_total — звичайна властивість Python
    item = OrderItem(price=price, quantity=quantity)

    assert item.line_total == expected
