"""Базовий клас для всіх моделей SQLAlchemy.

Кожна модель (User, Product…) наслідує Base. Base збирає опис усіх таблиць у Base.metadata,
і за цим описом create_all() створює таблиці в базі.
"""

from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Спільний предок усіх моделей."""


# Без AUTOINCREMENT SQLite може віддати номер видаленого запису новому: видалили користувача №3 —
# наступний зареєстрований теж стане №3, і старий токен №3 відкрив би чужий акаунт.
# З AUTOINCREMENT номери ніколи не повторюються. Додається в __table_args__ кожної таблиці з id
NO_ID_REUSE = {'sqlite_autoincrement': True}


class CreatedAtMixin:
    """Домішка (mixin): додає моделі стовпець created_at з часом створення запису.

    server_default=func.now() означає, що час ставить сама база в момент INSERT.
    """

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
