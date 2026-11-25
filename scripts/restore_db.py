"""Відновлення бази SQLite з резервної копії (лабораторна 08).

    python scripts/restore_db.py backups/omnitech-20261118-120000.db
    python scripts/restore_db.py FILE --db backend/data/omnitech.db

Перед відновленням поточна база зберігається поруч із копією як omnitech-before-restore-<час>.db,
тож помилку можна скасувати. Відновлення йде через sqlite3.Connection.backup() (не підміною файлу),
тому -wal і -shm не розходяться з основним файлом.
Найбезпечніше зупинити backend на час відновлення:  docker compose stop backend
"""

import argparse
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from backup_db import check_integrity, default_db  # noqa: E402


def copy_database(source_path: Path, target_path: Path) -> None:
    """Повна копія однієї бази SQLite в іншу через backup()."""
    source, target = sqlite3.connect(source_path), sqlite3.connect(target_path)
    try:
        source.backup(target)
    finally:
        target.close()
        source.close()


def restore(backup: Path, db: Path) -> Path | None:
    """Копіює вміст `backup` у `db`. Повертає шлях до безпечної копії старої бази (або None, якщо бази ще не було)."""
    if not backup.is_file():
        raise SystemExit(f'Файл копії не знайдено: {backup}')
    if not check_integrity(backup):
        raise SystemExit(f'Копія {backup} пошкоджена (integrity_check), відновлення скасовано.')
    safety = None
    if db.is_file():
        safety = backup.parent / f'omnitech-before-restore-{datetime.now():%Y%m%d-%H%M%S}.db'
        copy_database(db, safety)
    copy_database(backup, db)
    return safety


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description='Відновлення бази SQLite з копії')
    parser.add_argument('backup', type=Path, help='файл копії, створений backup_db.py')
    parser.add_argument('--db', type=Path, default=None, help='куди відновити (за замовчуванням DATABASE_URL або backend/data/omnitech.db)')
    args = parser.parse_args(argv)
    db = args.db or default_db()
    safety = restore(args.backup, db)
    if safety:
        print(f'Стару базу збережено: {safety}')
    print(f'Базу відновлено з {args.backup}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
