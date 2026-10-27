"""Запити до таблиці reviews: відгуки покупців про товари."""

from db import get_db
from validators import to_int

MIN_TEXT = 5       # найкоротший відгук
MAX_TEXT = 1000    # найдовший відгук


def validate_review(rating, text):
    """Перевіряє поля форми. Повертає (оцінка як число, список помилок)."""
    errors = []
    rating_number = to_int(rating)
    if rating_number is None or not 1 <= rating_number <= 5:
        errors.append('Оберіть оцінку від 1 до 5 зірок.')
    if len(text) < MIN_TEXT:
        errors.append(f'Напишіть відгук довжиною щонайменше {MIN_TEXT} символів.')
    if len(text) > MAX_TEXT:
        errors.append(f'Відгук задовгий: не більше {MAX_TEXT} символів.')
    return rating_number, errors


def get_reviews(product_id):
    """Відгуки про товар, найновіші першими (READ)."""
    db = get_db()
    return db.execute(
        'SELECT id, user_id, author_name, rating, text, created_at '
        'FROM reviews WHERE product_id = ? ORDER BY created_at DESC, id DESC',
        (product_id,),
    ).fetchall()


def get_rating_summary(product_id):
    """Скільки відгуків і яка середня оцінка товару. Для товару без відгуків average = None."""
    db = get_db()
    # Агрегатні функції COUNT і AVG рахують по всіх рядках, що пройшли умову WHERE
    row = db.execute(
        'SELECT COUNT(*) AS count, AVG(rating) AS average FROM reviews WHERE product_id = ?',
        (product_id,),
    ).fetchone()
    return {'count': row['count'], 'average': row['average']}


def get_user_review(product_id, user_id):
    """Відгук цього користувача про цей товар або None."""
    db = get_db()
    return db.execute(
        'SELECT id, rating, text FROM reviews WHERE product_id = ? AND user_id = ?',
        (product_id, user_id),
    ).fetchone()


def save_review(product_id, user, rating, text):
    """Зберігає відгук користувача: новий додає, а вже наявний змінює (CREATE і UPDATE разом).

    У таблиці є обмеження UNIQUE (product_id, user_id): один користувач — один відгук про товар.
    Запис INSERT ... ON CONFLICT DO UPDATE («upsert») каже базі: якщо такий відгук уже є,
    не вставляй дубль, а онови наявний. Дату при цьому ставимо нову: вона показує, коли відгук
    змінювали востаннє.
    """
    db = get_db()
    db.execute(
        'INSERT INTO reviews (product_id, user_id, author_name, rating, text) '
        'VALUES (?, ?, ?, ?, ?) '
        'ON CONFLICT (product_id, user_id) DO UPDATE SET '
        "author_name = excluded.author_name, rating = excluded.rating, text = excluded.text, "
        "created_at = datetime('now', 'localtime')",
        (product_id, user['id'], user['name'], rating, text),
    )
    db.commit()


def delete_user_review(product_id, user_id):
    """Видаляє відгук самого користувача (DELETE)."""
    db = get_db()
    db.execute('DELETE FROM reviews WHERE product_id = ? AND user_id = ?', (product_id, user_id))
    db.commit()


def get_all_reviews():
    """Усі відгуки з назвами товарів для адмін-панелі (JOIN з таблицею products)."""
    db = get_db()
    return db.execute(
        'SELECT r.id, r.product_id, r.author_name, r.rating, r.text, r.created_at, p.name AS product_name '
        'FROM reviews r JOIN products p ON p.id = r.product_id '
        'ORDER BY r.id DESC'
    ).fetchall()


def delete_review(review_id):
    """Видаляє будь-який відгук за номером (модерація адміністратором)."""
    db = get_db()
    db.execute('DELETE FROM reviews WHERE id = ?', (review_id,))
    db.commit()


def count_reviews():
    """Кількість відгуків (для адмін-панелі)."""
    db = get_db()
    return db.execute('SELECT COUNT(*) FROM reviews').fetchone()[0]
