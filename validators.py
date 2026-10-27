"""Спільні перевірки й перетворення введених даних: їх використовують різні частини сайту."""

import re

# Дуже проста перевірка адреси пошти: щось, символ @, щось, крапка, щось
EMAIL_PATTERN = re.compile(r'[^@\s]+@[^@\s]+\.[^@\s]+')


def to_int(value):
    """Перетворює рядок із форми чи адреси на ціле число; порожнє або некоректне дає None."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def is_valid_email(email):
    """True, якщо рядок схожий на адресу пошти."""
    return EMAIL_PATTERN.fullmatch(email) is not None
