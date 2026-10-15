"""Запити до таблиць categories і products: те, що бачать відвідувачі магазину."""

from db import get_db


def get_featured_products():
    """Товари для головної сторінки: ті, що позначені is_featured = 1."""
    db = get_db()
    # JOIN підтягує назву категорії з другої таблиці: у кожного товару є лише category_id
    return db.execute(
        'SELECT p.id, p.name, p.price, p.image, c.name AS category '
        'FROM products p JOIN categories c ON c.id = p.category_id '
        'WHERE p.is_featured = 1 ORDER BY p.id'
    ).fetchall()
