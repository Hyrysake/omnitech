"""Підключення до бази: engine (з'єднання) і SessionLocal (фабрика сесій).

Сесія — це «розмова» з базою в межах одного запиту: ми додаємо, змінюємо, видаляємо об'єкти,
а commit() записує все разом (транзакція). Нову сесію на кожен запит видає get_db() з app/api/deps.py.
"""

from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.base import Base

_url = make_url(settings.database_url)
_is_sqlite = _url.get_backend_name() == 'sqlite'

# check_same_thread=False: FastAPI виконує звичайні (не async) функції в кількох потоках,
# а SQLite за замовчуванням дозволяє з'єднанню працювати лише в потоці, де його створили
engine = create_engine(
    settings.database_url,
    connect_args={'check_same_thread': False} if _is_sqlite else {},
)


def _sqlite_lower(value):
    """lower() для SQLite з підтримкою кирилиці (вбудований lower() SQLite знає лише латиницю)."""
    return value.lower() if isinstance(value, str) else value


if _is_sqlite:
    @event.listens_for(engine, 'connect')
    def _configure_sqlite(dbapi_connection, connection_record):
        """Виконується для кожного нового з'єднання з SQLite."""
        # Без цього SQLite НЕ перевіряє зовнішні ключі (ON DELETE RESTRICT/CASCADE не працювали б)
        cursor = dbapi_connection.cursor()
        cursor.execute('PRAGMA foreign_keys = ON')
        cursor.close()
        # Підміняємо lower(): пошук без урахування регістру (ilike) тепер працює й для «Ноутбук»/«ноутбук».
        # На PostgreSQL це не потрібно: там ILIKE розуміє кирилицю сам
        dbapi_connection.create_function('lower', 1, _sqlite_lower, deterministic=True)


# autoflush=False: зміни йдуть у базу лише під час commit() або явного flush(), а не непомітно.
# expire_on_commit=False: після commit() об'єкт лишається доступним для відповіді без нового запиту
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    """Створює таблиці, яких ще немає (наявні таблиці й дані не чіпає)."""
    import app.models  # noqa: F401 — імпорт реєструє всі моделі в Base.metadata

    if _is_sqlite and _url.database:
        Path(_url.database).parent.mkdir(parents=True, exist_ok=True)   # папка data/ для файлу бази
    Base.metadata.create_all(engine)
