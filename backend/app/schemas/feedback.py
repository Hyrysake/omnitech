"""Схеми зворотного зв'язку (форма «Контакти») і статистики для адмін-панелі."""

from datetime import datetime
from typing import Annotated

from pydantic import Field

from app.core.validators import Email, Name
from app.schemas.common import InputModel, OutputModel


class FeedbackIn(InputModel):
    name: Name
    email: Email
    message: Annotated[str, Field(min_length=10, max_length=2000, examples=['Чи можна відкласти ноутбук на два дні?'])]


class FeedbackOut(OutputModel):
    id: int
    name: str
    email: str
    message: str
    is_read: bool
    created_at: datetime


class FeedbackUpdate(InputModel):
    is_read: Annotated[bool, Field(strict=True)]


class StatsOut(OutputModel):
    """Лічильники для головної сторінки адмін-панелі."""

    products: int
    categories: int
    users: int
    reviews: int
    orders: int
    orders_by_status: dict[str, int]
    unread_feedback: int
    revenue: int = Field(description='Сума виконаних замовлень, грн')
