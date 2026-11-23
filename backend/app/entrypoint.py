"""Запуск контейнера бекенду:  python -m app.entrypoint

1. створює таблиці (і, якщо SEED_ON_START=true, заповнює порожню базу демо-даними);
2. замінює себе на uvicorn (os.execvp), щоб uvicorn став головним процесом контейнера і отримував
   сигнал зупинки від Docker. Додаткові аргументи (наприклад, --reload у dev) передаються uvicorn.
"""

import os
import sys


def get_port(env) -> str:
    """Порт береться зі змінної PORT (за замовчуванням 8000). Не число — зрозуміла помилка."""
    port = env.get('PORT', '8000')
    if not port.isdigit() or not 1 <= int(port) <= 65535:
        raise SystemExit(f'PORT має бути числом від 1 до 65535, а не {port!r}')
    return port


def uvicorn_command(env, extra_args=()) -> list[str]:
    """Команда запуску сервера. Один процес: SQLite не любить кількох писачів."""
    return [
        'uvicorn', 'app.main:app',
        '--host', '0.0.0.0',                  # слухати ззовні контейнера, а не лише 127.0.0.1
        '--port', get_port(env),
        '--workers', '1',
        '--proxy-headers', '--forwarded-allow-ips', '*',   # справжня адреса клієнта з заголовків Nginx
        *extra_args,
    ]


def prepare_database(seed: bool) -> None:
    """Створює таблиці; за потреби додає демо-дані (наявні дані не чіпає: кожен seeder бачить, що таблиця не порожня)."""
    from app.db.session import SessionLocal, init_db
    from app.seed.__main__ import SEEDERS

    init_db()
    if seed:
        with SessionLocal() as db:
            for seeder in SEEDERS:
                seeder(db)
            db.commit()


def main(argv=None) -> None:
    from app.core.config import settings
    from app.core.logging import setup_logging

    setup_logging()
    prepare_database(settings.seed_on_start)
    command = uvicorn_command(os.environ, sys.argv[1:] if argv is None else argv)
    print(f'Запуск: {" ".join(command)}', flush=True)
    os.execvp(command[0], command)


if __name__ == '__main__':
    main()
