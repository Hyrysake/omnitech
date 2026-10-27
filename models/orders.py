"""Запити до таблиць orders і order_items: оформлення та керування замовленнями."""

from db import get_db

# Статуси замовлення: значення в базі -> підпис для людини.
# Порядок тут — це порядок життя замовлення від «нового» до «виконаного».
ORDER_STATUSES = {
    'new': 'Нове',
    'processing': 'В обробці',
    'shipped': 'Відправлено',
    'completed': 'Виконано',
    'cancelled': 'Скасовано',
}


def create_order(user_id, customer_name, phone, email, address, lines):
    """Створює замовлення з його рядками і повертає номер замовлення.

    lines — список трійок (номер товару, кількість, ціна). Ціну беремо з бази, а не з форми.
    Замовлення і його рядки записуються як одна транзакція: або збережеться все, або нічого.
    """
    db = get_db()
    total = sum(quantity * price for _, quantity, price in lines)
    try:
        cursor = db.execute(
            'INSERT INTO orders (user_id, customer_name, phone, email, address, total) '
            'VALUES (?, ?, ?, ?, ?, ?)',
            (user_id, customer_name, phone, email, address, total),
        )
        order_id = cursor.lastrowid    # номер щойно створеного замовлення
        db.executemany(
            'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
            [(order_id, product_id, quantity, price) for product_id, quantity, price in lines],
        )
        db.commit()                    # тільки тепер обидві вставки стають постійними
    except Exception:
        db.rollback()                  # скасовуємо все, що встигли записати
        raise
    return order_id


def get_orders(status=None):
    """Список замовлень для адмін-панелі, нові зверху. Можна відфільтрувати за статусом."""
    db = get_db()
    # LEFT JOIN + GROUP BY: для кожного замовлення рахуємо кількість штук у його рядках
    query = (
        'SELECT o.*, COALESCE(SUM(oi.quantity), 0) AS units '
        'FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id '
    )
    params = []
    if status:
        query += 'WHERE o.status = ? '
        params.append(status)
    query += 'GROUP BY o.id ORDER BY o.id DESC'
    return db.execute(query, params).fetchall()


def get_order(order_id):
    """Замовлення за номером разом з email акаунта (якщо його оформив зареєстрований клієнт)."""
    db = get_db()
    return db.execute(
        'SELECT o.*, u.email AS account_email '
        'FROM orders o LEFT JOIN users u ON u.id = o.user_id '
        'WHERE o.id = ?',
        (order_id,),
    ).fetchone()


def get_order_items(order_id):
    """Рядки замовлення з назвами товарів: JOIN з'єднує order_items з products."""
    db = get_db()
    return db.execute(
        'SELECT oi.quantity, oi.price, oi.quantity * oi.price AS line_total, '
        'p.id AS product_id, p.name '
        'FROM order_items oi JOIN products p ON p.id = oi.product_id '
        'WHERE oi.order_id = ? ORDER BY oi.id',
        (order_id,),
    ).fetchall()


def update_order_status(order_id, status):
    """Змінює статус замовлення (UPDATE). Недопустимий статус ігнорується."""
    if status not in ORDER_STATUSES:
        return False
    db = get_db()
    db.execute('UPDATE orders SET status = ? WHERE id = ?', (status, order_id))
    db.commit()
    return True


def delete_order(order_id):
    """Видаляє замовлення; його рядки в order_items видаляються самі (ON DELETE CASCADE)."""
    db = get_db()
    db.execute('DELETE FROM orders WHERE id = ?', (order_id,))
    db.commit()


def count_orders_by_status(status):
    """Кількість замовлень із вказаним статусом (для адмін-панелі)."""
    db = get_db()
    return db.execute('SELECT COUNT(*) FROM orders WHERE status = ?', (status,)).fetchone()[0]
