"""Заповнює базу демонстраційними даними.

    python -m app.seed           — створити таблиці й заповнити ПОРОЖНІ (наявні дані не чіпає)
    python -m app.seed --reset   — видалити всі таблиці й почати з чистого аркуша

Кожна частина проєкту додає свою функцію заповнення в список SEEDERS.
"""

import argparse

from app.db.base import Base
from app.db.session import SessionLocal, engine, init_db
from app.seed.users import seed_users
from app.seed.catalog import seed_catalog
from app.seed.orders import seed_orders

# Порядок важливий: замовлення посилаються на товари й користувачів, тому вони останні
SEEDERS = [
    seed_users,
    seed_catalog,
    seed_orders,
]


def main() -> None:
    parser = argparse.ArgumentParser(description='Демонстраційні дані OmniTech')
    parser.add_argument('--reset', action='store_true', help='видалити всі дані й створити таблиці заново')
    args = parser.parse_args()

    if args.reset:
        import app.models  # noqa: F401 — щоб drop_all знав про всі таблиці
        Base.metadata.drop_all(engine)
        print('Усі таблиці видалено.')
    init_db()

    with SessionLocal() as db:
        for seeder in SEEDERS:
            seeder(db)
        db.commit()
    print('Готово: демонстраційні дані на місці.')


if __name__ == '__main__':
    main()
