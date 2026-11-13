"""Повідомлення з форми «Контакти» (таблиця feedback)."""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import NO_ID_REUSE, Base, CreatedAtMixin


class Feedback(CreatedAtMixin, Base):
    __tablename__ = 'feedback'
    __table_args__ = NO_ID_REUSE

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(254))
    message: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(default=False)
