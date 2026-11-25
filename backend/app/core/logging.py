"""Логування застосунку (лабораторна 08).

У контейнері логи пишуться в stdout: Docker збирає їх сам, і їх видно командою `docker compose logs -f backend`.
Ніяких файлів логів усередині контейнера немає (коренева файлова система там лише для читання).

- APP_ENV=production  -> один рядок = один JSON (легко шукати й обробляти);
- APP_ENV=development -> звичайний читабельний рядок;
- LOG_LEVEL           -> DEBUG, INFO, WARNING, ERROR або CRITICAL.
Рядки uvicorn (запуск, запити) ідуть тим самим форматом, що й логи застосунку.
"""

import json
import logging
import logging.config
from datetime import datetime, timezone

from app.core.config import settings

PLAIN_FORMAT = '%(asctime)s %(levelname)-8s %(name)s: %(message)s'


class JsonFormatter(logging.Formatter):
    """Перетворює запис журналу на один рядок JSON."""

    def format(self, record: logging.LogRecord) -> str:
        data = {
            'time': datetime.fromtimestamp(record.created, timezone.utc).isoformat(timespec='milliseconds'),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }
        if record.exc_info:
            data['exception'] = self.formatException(record.exc_info)
        return json.dumps(data, ensure_ascii=False)


def build_config(level: str, app_env: str) -> dict:
    """Словник для logging.config.dictConfig. Окрема функція, щоб її можна було перевірити тестом."""
    formatter = 'json' if app_env == 'production' else 'plain'
    return {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'plain': {'format': PLAIN_FORMAT},
            'json': {'()': 'app.core.logging.JsonFormatter'},
        },
        'handlers': {
            'console': {'class': 'logging.StreamHandler', 'stream': 'ext://sys.stdout', 'formatter': formatter},
        },
        'root': {'level': level, 'handlers': ['console']},
        'loggers': {
            # uvicorn додає власні обробники; прибираємо їх, щоб усе йшло через наш (propagate -> root)
            'uvicorn': {'handlers': [], 'level': level, 'propagate': True},
            'uvicorn.error': {'handlers': [], 'level': level, 'propagate': True},
            'uvicorn.access': {'handlers': [], 'level': level, 'propagate': True},
            # SQL-запити та перевірка змін файлів у dev-режимі засмічують журнал
            'sqlalchemy.engine': {'level': 'WARNING'},
            'watchfiles': {'level': 'WARNING'},
        },
    }


def setup_logging() -> None:
    """Викликається з main.py один раз під час імпорту застосунку."""
    logging.config.dictConfig(build_config(settings.log_level, settings.app_env))
