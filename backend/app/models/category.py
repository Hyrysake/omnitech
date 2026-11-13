"""Модель категорії (таблиця categories)."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import NO_ID_REUSE, Base


class Category(Base):
    __tablename__ = 'categories'
    __table_args__ = NO_ID_REUSE

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)
