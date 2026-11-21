"""Unit-тести розбиття на сторінки (app/db/pagination.py) і lower() для SQLite (app/db/session.py)."""

import pytest

from app.db.pagination import PageParams, page_count
from app.db.session import _sqlite_lower


@pytest.mark.parametrize(('total', 'size', 'expected'), [
    (0, 12, 0),     # порожній список: 0 сторінок
    (1, 12, 1),
    (12, 12, 1),    # рівно одна повна сторінка
    (13, 12, 2),    # один зайвий запис дає нову сторінку
    (24, 12, 2),
    (25, 12, 3),
])
def test_page_count(total, size, expected):
    assert page_count(total, size) == expected


@pytest.mark.parametrize(('page', 'size', 'expected'), [
    (1, 12, 0),     # перша сторінка нічого не пропускає
    (2, 12, 12),
    (3, 12, 24),
    (4, 5, 15),
])
def test_page_params_offset(page, size, expected):
    assert PageParams(page=page, size=size).offset == expected


def test_page_params_defaults():
    params = PageParams()
    assert (params.page, params.size) == (1, 12)


def test_sqlite_lower_handles_cyrillic():
    # Вбудований lower() SQLite кирилицю не знає, наша версія знає
    assert _sqlite_lower('НОУТБУК') == 'ноутбук'


def test_sqlite_lower_keeps_none():
    assert _sqlite_lower(None) is None


def test_sqlite_lower_keeps_numbers():
    assert _sqlite_lower(42) == 42
