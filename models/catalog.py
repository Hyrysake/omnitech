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


# Варіанти сортування: ключ із адреси -> (підпис у списку, фрагмент SQL).
# Користувач ніколи не вписує SQL сам: з адреси береться лише ключ, а текст запиту обираємо ми.
SORT_OPTIONS = {
    'default': ('Рекомендовані', 'p.is_featured DESC, p.id'),
    'price_asc': ('Спочатку дешевші', 'p.price ASC, p.id'),
    'price_desc': ('Спочатку дорожчі', 'p.price DESC, p.id'),
    'name': ('За назвою', 'lower_uk(p.name)'),
}


def get_categories():
    """Усі категорії в тому порядку, в якому їх додавали."""
    db = get_db()
    return db.execute('SELECT id, name FROM categories ORDER BY id').fetchall()


def get_product(product_id):
    """Один товар за номером разом з назвою категорії; None, якщо такого немає."""
    db = get_db()
    return db.execute(
        'SELECT p.id, p.name, p.description, p.price, p.image, p.is_featured, p.category_id, '
        'c.name AS category '
        'FROM products p JOIN categories c ON c.id = p.category_id '
        'WHERE p.id = ?',
        (product_id,),
    ).fetchone()


def _like_pattern(text):
    """Готує текст для оператора LIKE: символи % і _ шукаються як звичайні, а не як шаблон."""
    escaped = text.casefold().replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
    return f'%{escaped}%'


def search_products(query='', category_id=None, min_price=None, max_price=None, sort='default'):
    """Шукає товари за текстом і фільтрами, повертає список у вибраному порядку.

    Умова додається до запиту лише для тих полів, які користувач справді заповнив.
    Самі значення завжди передаються окремо через «?», тому вставити в запит
    чужий SQL (SQL-ін'єкція) неможливо.
    """
    conditions = []   # шматки умови WHERE, у яких на місці значень стоять «?»
    params = []       # самі значення, у тому ж порядку

    if query:
        pattern = _like_pattern(query)
        conditions.append("(lower_uk(p.name) LIKE ? ESCAPE '\\' OR lower_uk(p.description) LIKE ? ESCAPE '\\')")
        params += [pattern, pattern]
    if category_id is not None:
        conditions.append('p.category_id = ?')
        params.append(category_id)
    if min_price is not None:
        conditions.append('p.price >= ?')
        params.append(min_price)
    if max_price is not None:
        conditions.append('p.price <= ?')
        params.append(max_price)

    where = 'WHERE ' + ' AND '.join(conditions) if conditions else ''
    # Невідомий ключ сортування замінюється на стандартний
    order_by = SORT_OPTIONS.get(sort, SORT_OPTIONS['default'])[1]

    db = get_db()
    return db.execute(
        'SELECT p.id, p.name, p.description, p.price, p.image, p.category_id, c.name AS category '
        'FROM products p JOIN categories c ON c.id = p.category_id '
        f'{where} ORDER BY {order_by}',
        params,
    ).fetchall()


def get_products_by_ids(product_ids):
    """Товари з переданого списку номерів (потрібно кошику)."""
    if not product_ids:
        return []
    db = get_db()
    # Рядок «?, ?, ?» будуємо за кількістю номерів. У запит потрапляють лише знаки питання,
    # а самі номери йдуть окремо, тож це безпечно
    placeholders = ', '.join('?' * len(product_ids))
    return db.execute(
        'SELECT p.id, p.name, p.price, p.image, c.name AS category '
        'FROM products p JOIN categories c ON c.id = p.category_id '
        f'WHERE p.id IN ({placeholders})',
        list(product_ids),
    ).fetchall()
