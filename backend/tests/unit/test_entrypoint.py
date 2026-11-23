"""Unit-тести запуску контейнера (app/entrypoint.py): команда uvicorn, порт, наповнення бази.

Docker для цих тестів не потрібен: перевіряється лише Python-код. Сам execvp у тесті підмінено.
"""

import pytest
from sqlalchemy import func, select

from app import entrypoint
from app.models import Category, Product, User


def test_default_command_uses_port_8000_and_one_worker():
    command = entrypoint.uvicorn_command({})
    assert command[:2] == ['uvicorn', 'app.main:app']
    assert command[command.index('--port') + 1] == '8000'
    assert command[command.index('--workers') + 1] == '1'
    assert command[command.index('--host') + 1] == '0.0.0.0'


def test_port_is_read_from_environment():
    assert entrypoint.get_port({'PORT': '9000'}) == '9000'


@pytest.mark.parametrize('bad', ['abc', '', '0', '70000', '-1', '80 80'])
def test_bad_port_stops_with_clear_message(bad):
    with pytest.raises(SystemExit) as error:
        entrypoint.get_port({'PORT': bad})
    assert 'PORT' in str(error.value)


def test_extra_arguments_go_to_uvicorn():
    command = entrypoint.uvicorn_command({}, ['--reload'])
    assert command[-1] == '--reload'


def test_prepare_database_without_seed_leaves_tables_empty(db):
    entrypoint.prepare_database(seed=False)
    assert db.scalar(select(func.count()).select_from(User)) == 0


def test_prepare_database_with_seed_fills_demo_data(db):
    entrypoint.prepare_database(seed=True)
    assert db.scalar(select(func.count()).select_from(User)) > 0
    assert db.scalar(select(func.count()).select_from(Category)) > 0
    assert db.scalar(select(func.count()).select_from(Product)) > 0


def test_seed_twice_does_not_duplicate(db):
    """Контейнер перезапускається багато разів: демо-дані не мають множитися."""
    entrypoint.prepare_database(seed=True)
    users = db.scalar(select(func.count()).select_from(User))
    entrypoint.prepare_database(seed=True)
    assert db.scalar(select(func.count()).select_from(User)) == users


def test_main_replaces_process_with_uvicorn(monkeypatch, db):
    calls = []
    monkeypatch.setattr(entrypoint.os, 'execvp', lambda file, args: calls.append((file, args)))
    monkeypatch.setenv('PORT', '8123')
    entrypoint.main(['--log-level', 'warning'])
    file, args = calls[0]
    assert file == 'uvicorn'
    assert args[args.index('--port') + 1] == '8123'
    assert args[-2:] == ['--log-level', 'warning']
