"""Спільні схеми: базовий клас для вхідних даних, формат помилки, сторінка списку."""

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar('T')


class InputModel(BaseModel):
    """Предок усіх схем, які приходять від клієнта.

    str_strip_whitespace — пробіли на початку й у кінці рядків відрізаються ще до перевірки,
    тож «   » не пройде як ім'я. extra='forbid' — невідоме поле дає 422, а не мовчки ігнорується
    (одруківка «prise» замість «price» одразу видна).
    """

    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')


class OutputModel(BaseModel):
    """Предок схем відповіді. from_attributes=True дозволяє будувати схему з об'єкта SQLAlchemy."""

    model_config = ConfigDict(from_attributes=True)


class FieldError(BaseModel):
    field: str = Field(examples=['price'])
    message: str = Field(examples=['Має бути більше за 0.'])


class ErrorOut(BaseModel):
    """Формат будь-якої помилки API (для документації в /docs)."""

    detail: str = Field(examples=['Товар не знайдено.'])
    errors: list[FieldError] | None = None


class Page(BaseModel, Generic[T]):
    """Одна сторінка списку. Page[ProductOut] — сторінка товарів, Page[UserOut] — користувачів."""

    items: list[T]
    total: int = Field(description='Скільки записів усього за цими умовами')
    page: int = Field(description='Номер поточної сторінки (від 1)')
    size: int = Field(description='Скільки записів на сторінці')
    pages: int = Field(description='Скільки сторінок усього')


# Готові описи помилок для параметра responses= в ендпоінтах: так /docs показує формат помилки
def error_responses(*codes: int) -> dict:
    descriptions = {
        400: 'Дію виконати не можна',
        401: 'Потрібно увійти (немає токена або він недійсний)',
        403: 'Недостатньо прав',
        404: 'Запис не знайдено',
        409: 'Конфлікт з наявними даними',
        413: 'Файл завеликий',
        415: 'Непідтримуваний тип файлу',
        422: 'Дані не пройшли перевірку',
    }
    return {code: {'model': ErrorOut, 'description': descriptions[code]} for code in codes}
