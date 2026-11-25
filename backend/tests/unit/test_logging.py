"""Unit-тести логування (app/core/logging.py): формат рядка, налаштування за режимом, рівні."""

import json
import logging

import pytest

from app.core import logging as app_logging


@pytest.fixture
def restore_logging():
    """setup_logging змінює глобальні налаштування; після тесту повертаємо як було."""
    root = logging.getLogger()
    handlers, level = root.handlers[:], root.level
    yield
    root.handlers[:] = handlers
    root.setLevel(level)


def make_record(message='привіт', exc_info=None):
    return logging.LogRecord('app.test', logging.WARNING, __file__, 1, message, None, exc_info)


def test_json_formatter_gives_one_valid_json_line():
    line = app_logging.JsonFormatter().format(make_record('кошик порожній'))
    data = json.loads(line)
    assert '\n' not in line
    assert data['level'] == 'WARNING'
    assert data['logger'] == 'app.test'
    assert data['message'] == 'кошик порожній'      # кирилиця не перетворюється на \uXXXX
    assert data['time'].endswith('+00:00')


def test_json_formatter_includes_exception():
    try:
        1 / 0
    except ZeroDivisionError:
        import sys
        record = make_record('помилка', exc_info=sys.exc_info())
    assert 'ZeroDivisionError' in json.loads(app_logging.JsonFormatter().format(record))['exception']


def test_production_uses_json_and_development_uses_plain():
    assert app_logging.build_config('INFO', 'production')['handlers']['console']['formatter'] == 'json'
    assert app_logging.build_config('INFO', 'development')['handlers']['console']['formatter'] == 'plain'


def test_config_writes_to_stdout_not_to_a_file():
    handler = app_logging.build_config('INFO', 'production')['handlers']['console']
    assert handler['stream'] == 'ext://sys.stdout'
    assert 'filename' not in handler


def test_uvicorn_loggers_go_through_root(restore_logging):
    app_logging.setup_logging()
    for name in ('uvicorn', 'uvicorn.error', 'uvicorn.access'):
        logger = logging.getLogger(name)
        assert logger.propagate is True
        assert logger.handlers == []


def test_log_level_is_applied(monkeypatch, restore_logging):
    monkeypatch.setattr(app_logging.settings, 'log_level', 'DEBUG')
    app_logging.setup_logging()
    assert logging.getLogger().level == logging.DEBUG
    monkeypatch.setattr(app_logging.settings, 'log_level', 'ERROR')
    app_logging.setup_logging()
    assert logging.getLogger().level == logging.ERROR


def test_sql_logger_stays_quiet(restore_logging):
    app_logging.setup_logging()
    assert logging.getLogger('sqlalchemy.engine').level == logging.WARNING
