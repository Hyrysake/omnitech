"""Модель користувача (таблиця users)."""

from sqlalchemy import CheckConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import NO_ID_REUSE, Base, CreatedAtMixin

ROLE_ADMIN = 'admin'
ROLE_CLIENT = 'client'


class User(CreatedAtMixin, Base):
    """Акаунт: клієнт магазину або адміністратор.

    Mapped[str] — тип стовпця для Python, mapped_column(...) — як він виглядає в базі.
    Пароль відкритим текстом не зберігається ніколи, лише його хеш.
    """

    __tablename__ = 'users'
    __table_args__ = (CheckConstraint("role IN ('admin', 'client')", name='ck_users_role'), NO_ID_REUSE)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(10), default=ROLE_CLIENT)

    @property
    def is_admin(self) -> bool:
        return self.role == ROLE_ADMIN
