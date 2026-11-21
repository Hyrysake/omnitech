"""Unit-тести app/core/validators.py: перевірка телефону й пошти.

Межі перевіряємо через parametrize: один тест, багато значень. Так видно, де саме
"добре" переходить у "погано" (9 цифр погано, 10 добре, 13 добре, 14 погано).
"""

import pytest

from app.core.validators import check_phone, lower_email


@pytest.mark.parametrize('phone', [
    '0501234567',            # рівно 10 цифр: нижня межа
    '+380501234567',         # 13 цифр: верхня межа
    '+38 (050) 123-45-67',   # пробіли, дужки й дефіси дозволені
    '050 123 45 67',
    '(050)1234567',
])
def test_valid_phone_is_returned_unchanged(phone):
    # Валідатор лише перевіряє, текст не змінює
    assert check_phone(phone) == phone


@pytest.mark.parametrize('phone', [
    '',                      # порожній
    '050123456',             # 9 цифр: на одну менше за мінімум
    '+38050123456789',       # 14 цифр: на одну більше за максимум
    '050abc1234567',         # літери
    '050.123.4567',          # крапка не дозволена
    '++++++++++',            # символи є, а цифр немає
    '050/123/4567',          # слеш не дозволений
])
def test_invalid_phone_raises_value_error(phone):
    with pytest.raises(ValueError):
        check_phone(phone)


def test_phone_error_message_has_example():
    with pytest.raises(ValueError, match='380501234567'):
        check_phone('123')


@pytest.mark.parametrize(('raw', 'expected'), [
    ('Olena@Example.COM', 'olena@example.com'),
    ('already@lower.com', 'already@lower.com'),
    ('ADMIN@OMNITECH.EXAMPLE', 'admin@omnitech.example'),
])
def test_lower_email_makes_everything_lowercase(raw, expected):
    assert lower_email(raw) == expected
