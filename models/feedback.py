"""Запити до таблиці feedback: відгуки з форми на сторінці «Контакти»."""

from db import get_db
from validators import is_valid_email


def validate_feedback(name, email, message):
    """Перевіряє поля форми й повертає список помилок (порожній, якщо все гаразд)."""
    errors = []
    if len(name) < 2:
        errors.append('Вкажіть ім\'я (щонайменше 2 літери).')
    if not is_valid_email(email):
        errors.append('Вкажіть коректну адресу пошти, наприклад name@example.com.')
    if len(message) < 10:
        errors.append('Напишіть повідомлення довжиною щонайменше 10 символів.')
    if len(message) > 2000:
        errors.append('Повідомлення задовге: не більше 2000 символів.')
    return errors


def add_feedback(name, email, message):
    """Зберігає новий відгук (CREATE)."""
    db = get_db()
    db.execute('INSERT INTO feedback (name, email, message) VALUES (?, ?, ?)', (name, email, message))
    db.commit()


def get_all_feedback():
    """Усі відгуки: спочатку непрочитані, усередині групи від новіших до старіших (READ)."""
    db = get_db()
    return db.execute('SELECT * FROM feedback ORDER BY is_read, id DESC').fetchall()


def set_feedback_read(feedback_id, is_read):
    """Позначає відгук прочитаним (1) або непрочитаним (0) (UPDATE)."""
    db = get_db()
    db.execute('UPDATE feedback SET is_read = ? WHERE id = ?', (1 if is_read else 0, feedback_id))
    db.commit()


def delete_feedback(feedback_id):
    """Видаляє відгук (DELETE)."""
    db = get_db()
    db.execute('DELETE FROM feedback WHERE id = ?', (feedback_id,))
    db.commit()


def count_unread_feedback():
    """Кількість непрочитаних відгуків (для адмін-панелі)."""
    db = get_db()
    return db.execute('SELECT COUNT(*) FROM feedback WHERE is_read = 0').fetchone()[0]
