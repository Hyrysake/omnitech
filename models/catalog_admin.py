"""Запити, які змінюють товари й категорії: використовує лише адмін-панель."""

from db import get_db


# ---------- Категорії ----------

def get_categories_with_counts():
    """Категорії разом з кількістю товарів у кожній (LEFT JOIN залишає і порожні категорії)."""
    db = get_db()
    return db.execute(
        'SELECT c.id, c.name, COUNT(p.id) AS products_count '
        'FROM categories c LEFT JOIN products p ON p.category_id = c.id '
        'GROUP BY c.id ORDER BY c.id'
    ).fetchall()


def get_category(category_id):
    """Категорія за номером або None."""
    db = get_db()
    return db.execute('SELECT id, name FROM categories WHERE id = ?', (category_id,)).fetchone()


def create_category(name):
    """Додає категорію. Повторна назва викличе sqlite3.IntegrityError (стовпець UNIQUE)."""
    db = get_db()
    db.execute('INSERT INTO categories (name) VALUES (?)', (name,))
    db.commit()


def rename_category(category_id, name):
    """Змінює назву категорії."""
    db = get_db()
    db.execute('UPDATE categories SET name = ? WHERE id = ?', (name, category_id))
    db.commit()


def delete_category(category_id):
    """Видаляє категорію. Якщо в ній є товари, спрацьовує ON DELETE RESTRICT
    і SQLite кидає sqlite3.IntegrityError."""
    db = get_db()
    db.execute('DELETE FROM categories WHERE id = ?', (category_id,))
    db.commit()


def count_categories():
    """Кількість категорій (для адмін-панелі)."""
    db = get_db()
    return db.execute('SELECT COUNT(*) FROM categories').fetchone()[0]


# ---------- Товари ----------

def get_all_products():
    """Усі товари з назвами категорій для таблиці в адмін-панелі."""
    db = get_db()
    return db.execute(
        'SELECT p.id, p.name, p.price, p.image, p.is_featured, c.name AS category '
        'FROM products p JOIN categories c ON c.id = p.category_id '
        'ORDER BY p.id'
    ).fetchall()


def create_product(category_id, name, description, price, image, is_featured):
    """Додає товар (CREATE)."""
    db = get_db()
    db.execute(
        'INSERT INTO products (category_id, name, description, price, image, is_featured) '
        'VALUES (?, ?, ?, ?, ?, ?)',
        (category_id, name, description, price, image, is_featured),
    )
    db.commit()


def update_product(product_id, category_id, name, description, price, image, is_featured):
    """Змінює всі поля товару (UPDATE)."""
    db = get_db()
    db.execute(
        'UPDATE products SET category_id = ?, name = ?, description = ?, price = ?, '
        'image = ?, is_featured = ? WHERE id = ?',
        (category_id, name, description, price, image, is_featured, product_id),
    )
    db.commit()


def delete_product(product_id):
    """Видаляє товар (DELETE). Якщо він є в замовленнях, ON DELETE RESTRICT
    не дозволить видалення: SQLite кидає sqlite3.IntegrityError."""
    db = get_db()
    db.execute('DELETE FROM products WHERE id = ?', (product_id,))
    db.commit()


def count_products():
    """Кількість товарів (для адмін-панелі)."""
    db = get_db()
    return db.execute('SELECT COUNT(*) FROM products').fetchone()[0]
