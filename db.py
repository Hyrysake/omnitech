"""
Робота з базою даних SQLite: з'єднання, створення таблиць і початкові дані.

Вся база — це один файл db.sqlite у теці проєкту. Модуль sqlite3 входить
у стандартну бібліотеку Python, тож нічого додатково встановлювати не треба.
"""

import sqlite3

from flask import current_app, g

import seed_data


def _lower_uk(text):
    """Переводить текст у нижній регістр, враховуючи кирилицю.

    Вбудована функція LOWER() у SQLite знає лише англійські літери, тому без цієї
    функції пошук «ноутбук» не знайшов би товар «Ноутбук OmniBook».
    """
    return text.casefold() if isinstance(text, str) else text


def get_db():
    """Повертає з'єднання з базою для поточного запиту.

    На кожен запит відкривається одне з'єднання. Воно лежить у g — сховищі даних
    поточного запиту, тож усі функції одного запиту користуються тим самим
    з'єднанням. Закриває його close_db() після завершення запиту.
    """
    if 'db' not in g:
        g.db = sqlite3.connect(current_app.config['DATABASE'])
        # Рядки поводяться як словники: row['name'] замість row[1]
        g.db.row_factory = sqlite3.Row
        # За замовчуванням SQLite не перевіряє зовнішні ключі. Вмикаємо перевірку
        # одразу після підключення, до будь-яких інших запитів
        g.db.execute('PRAGMA foreign_keys = ON')
        # Робимо Python-функцію доступною в SQL-запитах (її використовує пошук)
        g.db.create_function('lower_uk', 1, _lower_uk, deterministic=True)
    return g.db


def close_db(error=None):
    """Закриває з'єднання наприкінці запиту. Flask викликає цю функцію сам."""
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    """Створює таблиці зі schema.sql і додає демонстраційні дані в порожні таблиці."""
    db = get_db()
    # open_resource шукає файл відносно теки застосунку, тож працює з будь-якої теки запуску
    with current_app.open_resource('schema.sql') as schema_file:
        db.executescript(schema_file.read().decode('utf-8'))
    seed_data.seed_database(db)
    db.commit()


def init_app(app):
    """Підключає базу до застосунку: після кожного запиту з'єднання закривається."""
    app.teardown_appcontext(close_db)
