"""Запити до таблиці users: реєстрація, пошук користувача, перевірка пароля."""

from werkzeug.security import check_password_hash, generate_password_hash

from db import get_db


def create_user(name, email, password, role='client'):
    """Додає користувача і повертає його номер.

    У базу потрапляє лише хеш пароля. Якщо такий email уже є, SQLite кине помилку
    sqlite3.IntegrityError (через UNIQUE), яку обробляє той, хто викликав функцію.
    """
    db = get_db()
    cursor = db.execute(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        (name, email, generate_password_hash(password), role),
    )
    db.commit()    # без commit() зміни не збережуться
    return cursor.lastrowid


def get_user_by_email(email):
    """Користувач за email або None."""
    db = get_db()
    return db.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()


def get_user_by_id(user_id):
    """Користувач за номером або None."""
    db = get_db()
    return db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()


def check_password(user, password):
    """True, якщо введений пароль збігається з хешем, збереженим для цього користувача."""
    return check_password_hash(user['password_hash'], password)


def count_users():
    """Кількість зареєстрованих користувачів (для адмін-панелі)."""
    db = get_db()
    return db.execute('SELECT COUNT(*) FROM users').fetchone()[0]
