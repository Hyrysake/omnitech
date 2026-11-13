"""Помилки застосунку та єдиний формат відповіді з помилкою.

Будь-яка помилка API повертається однаково:
    {"detail": "Текст для людини", "errors": [{"field": "price", "message": "..."}]}
Поле errors є лише тоді, коли не пройшли перевірку конкретні поля (код 422).
Клієнт (Postman, сторінка з Lab 06) обробляє всі помилки одним кодом.

Сервіси (app/services) нічого не знають про HTTP: вони кидають винятки з цього файлу
(NotFoundError, ConflictError…), а обробники нижче перетворюють їх на відповідь з потрібним кодом.
"""

import logging
import re

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger('omnitech')


class AppError(Exception):
    """Базова помилка застосунку. Кожен підклас знає свій HTTP-код."""

    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, detail: str, field: str | None = None):
        super().__init__(detail)
        self.detail = detail
        self.field = field      # якщо помилка стосується одного поля — його назва (для списку errors)


class BadRequestError(AppError):
    """400: запит зрозумілий, але виконати його не можна (наприклад, неправильний поточний пароль)."""


class PermissionDeniedError(AppError):
    """403: користувач відомий, але цю дію йому робити не можна."""

    status_code = status.HTTP_403_FORBIDDEN


class NotFoundError(AppError):
    """404: запису з таким номером немає."""

    status_code = status.HTTP_404_NOT_FOUND


class ConflictError(AppError):
    """409: дія суперечить наявним даним (пошта вже зайнята, товар є в замовленнях)."""

    status_code = status.HTTP_409_CONFLICT


class UnprocessableError(AppError):
    """422: формат даних правильний, але значення не підходить (наприклад, категорії з таким номером немає)."""

    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT


# Стандартні англійські тексти Starlette -> українські
HTTP_MESSAGES = {
    'Not Found': 'Адресу не знайдено.',
    'Method Not Allowed': 'Цей HTTP-метод для адреси не підтримується.',
}

# Тексти помилок перевірки Pydantic українською. Ключ — тип помилки (поле "type" у Pydantic),
# у дужках {…} підставляються значення з контексту помилки (наприклад, min_length)
VALIDATION_MESSAGES = {
    'missing': "Обов'язкове поле.",
    'string_too_short': 'Мінімальна довжина — {min_length} симв.',
    'string_too_long': 'Максимальна довжина — {max_length} симв.',
    'string_type': 'Має бути рядком.',
    'int_type': 'Має бути цілим числом.',
    'int_parsing': 'Має бути цілим числом.',
    'int_from_float': 'Має бути цілим числом.',
    'bool_type': 'Має бути true або false.',
    'bool_parsing': 'Має бути true або false.',
    'greater_than': 'Має бути більше за {gt}.',
    'greater_than_equal': 'Має бути не менше за {ge}.',
    'less_than_equal': 'Має бути не більше за {le}.',
    'literal_error': 'Допустимі значення: {expected}.',
    'enum': 'Недопустиме значення.',
    'string_pattern_mismatch': 'Значення не відповідає потрібному формату.',
    'list_type': 'Має бути списком.',
    'too_short': 'Щонайменше {min_length} елемент(и).',
    'too_long': 'Не більше {max_length} елементів.',
    'model_type': "Має бути об'єктом JSON.",
    'model_attributes_type': "Тіло запиту має бути об'єктом JSON.",
    'dict_type': "Має бути об'єктом JSON.",
    'json_invalid': 'Тіло запиту — некоректний JSON.',
    'extra_forbidden': 'Невідоме поле.',
    'value_error': '{error}',
}


def _field_name(loc: tuple) -> str:
    """('body', 'items', 0, 'quantity') -> 'items.0.quantity'. Перше слово (body/query/path) відкидаємо."""
    parts = [str(part) for part in loc[1:]] if len(loc) > 1 else [str(part) for part in loc]
    return '.'.join(parts) or 'body'


def _translate(error: dict) -> str:
    """Повертає український текст для однієї помилки Pydantic (або англійський, якщо перекладу немає)."""
    if error['type'] in ('literal_error', 'enum') and 'expected' in error.get('ctx', {}):
        # Pydantic пише список англійською («'a' or 'b'»): робимо «a, b» українською
        allowed = re.findall(r"'([^']*)'", str(error['ctx']['expected']))
        return 'Допустимі значення: ' + ', '.join(allowed) + '.'
    if error['type'] == 'value_error' and 'UploadFile' in error.get('msg', ''):
        return 'Очікується файл (multipart/form-data, поле file).'
    if error['type'] == 'value_error' and 'reason' in error.get('ctx', {}):
        # EmailStr повідомляє причину англійською (бібліотека email-validator)
        return 'Вкажіть коректну адресу пошти, наприклад name@example.com.'
    template = VALIDATION_MESSAGES.get(error['type'])
    if template is None:
        return error['msg']
    try:
        return template.format(**error.get('ctx', {}))
    except (KeyError, IndexError):
        return error['msg']


def error_body(detail: str, errors: list | None = None) -> dict:
    """Тіло відповіді з помилкою в єдиному форматі."""
    body = {'detail': detail}
    if errors:
        body['errors'] = errors
    return body


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    errors = [{'field': exc.field, 'message': exc.detail}] if exc.field else None
    return JSONResponse(status_code=exc.status_code, content=error_body(exc.detail, errors))


async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """HTTPException з FastAPI/Starlette: 401 з залежностей входу, 404 неіснуючої адреси, 405…"""
    detail = HTTP_MESSAGES.get(exc.detail, exc.detail) if isinstance(exc.detail, str) else str(exc.detail)
    # headers зберігаємо: для 401 там WWW-Authenticate: Bearer (так вимагає стандарт)
    return JSONResponse(status_code=exc.status_code, content=error_body(detail), headers=exc.headers)


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """422: тіло чи параметри не пройшли перевірку Pydantic. Повертаємо ВСІ помилки разом."""
    errors = [{'field': 'body' if error['type'] == 'json_invalid' else _field_name(tuple(error['loc'])),
               'message': _translate(error)} for error in exc.errors()]
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        content=error_body('Дані не пройшли перевірку.', errors))


async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    """Запасний обробник: база відхилила зміну (унікальність, зовнішній ключ).

    Сервіси самі перевіряють такі ситуації й пояснюють їх точніше; сюди потрапляє лише те,
    що проскочило між перевіркою і записом (наприклад, два однакові запити одночасно).
    """
    logger.warning('IntegrityError: %s', exc.orig)
    return JSONResponse(status_code=status.HTTP_409_CONFLICT,
                        content=error_body('Дія суперечить наявним даним.'))


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """500: помилка в коді. Подробиці — лише в журнал сервера, клієнту — загальний текст."""
    logger.exception('Unhandled error on %s %s', request.method, request.url.path)
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        content=error_body('Внутрішня помилка сервера. Спробуйте пізніше.'))


def register_error_handlers(app: FastAPI) -> None:
    """Підключає всі обробники до застосунку (викликається в main.py)."""
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(IntegrityError, integrity_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
