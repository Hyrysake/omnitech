"""Unit-тести app/core/errors.py: назви полів, переклад повідомлень Pydantic, тіло помилки.

Функції _field_name і _translate приватні (з підкресленням), але саме вони формують текст,
який бачить користувач, тому їх варто перевірити окремо від HTTP.
"""

import pytest

from app.core.errors import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    _field_name,
    _translate,
    error_body,
)


@pytest.mark.parametrize(('loc', 'expected'), [
    (('body', 'items', 0, 'quantity'), 'items.0.quantity'),   # вкладений список
    (('body', 'email'), 'email'),                              # слово body відкидається
    (('query', 'page'), 'page'),                               # query теж
    (('body',), 'body'),                                       # єдине слово лишається
])
def test_field_name_builds_dotted_path(loc, expected):
    assert _field_name(loc) == expected


def test_translate_known_type_with_context():
    error = {'type': 'string_too_short', 'msg': 'String should have at least 6 characters',
             'ctx': {'min_length': 6}}
    assert _translate(error) == 'Мінімальна довжина — 6 симв.'


def test_translate_known_type_without_context():
    error = {'type': 'missing', 'msg': 'Field required'}
    assert _translate(error) == "Обов'язкове поле."


def test_translate_unknown_type_falls_back_to_original_message():
    error = {'type': 'some_new_error', 'msg': 'Original English text'}
    assert _translate(error) == 'Original English text'


def test_translate_literal_error_lists_allowed_values():
    error = {'type': 'literal_error', 'msg': "Input should be 'a' or 'b'", 'ctx': {'expected': "'new' or 'paid'"}}
    assert _translate(error) == 'Допустимі значення: new, paid.'


def test_translate_missing_context_key_falls_back():
    # Шаблон просить {min_length}, а в ctx його немає: не падаємо, а віддаємо англійський msg
    error = {'type': 'string_too_short', 'msg': 'Too short', 'ctx': {}}
    assert _translate(error) == 'Too short'


def test_error_body_without_errors_has_only_detail():
    assert error_body('Не знайдено.') == {'detail': 'Не знайдено.'}


def test_error_body_with_empty_list_has_no_errors_key():
    assert 'errors' not in error_body('Помилка', [])


def test_error_body_with_errors_keeps_them():
    errors = [{'field': 'email', 'message': 'Погана пошта'}]
    assert error_body('Дані не пройшли перевірку.', errors)['errors'] == errors


@pytest.mark.parametrize(('error_class', 'code'), [
    (BadRequestError, 400),
    (NotFoundError, 404),
    (ConflictError, 409),
])
def test_app_error_classes_have_right_status_code(error_class, code):
    assert error_class('текст').status_code == code
