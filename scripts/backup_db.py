"""Резервна копія бази SQLite (лабораторна 08). Лише стандартна бібліотека Python.

    python scripts/backup_db.py                         копія бази backend/data/omnitech.db у папку backups/
    python scripts/backup_db.py --db X.db --out DIR     інша база / інша папка
    python scripts/backup_db.py --keep 3                лишити 3 найновіші копії
    python scripts/backup_db.py --every 86400           робити копію раз на добу, поки процес не зупинять (так працює контейнер backup)

Копіювання йде через sqlite3.Connection.backup(), а не копіюванням файлу: у режимі WAL частина даних
лежить у файлі -wal, а запис може йти просто зараз. backup() дає цілісну копію й тоді, коли застосунок працює.
У Docker шлях бази й папка копій беруться зі змінних DATABASE_URL і BACKUP_DIR (BACKUP_KEEP — скільки копій лишати).
"""

import argparse
import os
import signal
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PREFIX = 'omnitech-'


def db_path_from_url(url: str) -> Path:
    """sqlite:////app/data/omnitech.db -> /app/data/omnitech.db;  sqlite:///data/x.db -> data/x.db"""
    if not url.startswith('sqlite:///'):
        raise SystemExit(f'Підтримується лише SQLite, а не {url!r}')
    return Path(url[len('sqlite:///'):])


def default_db() -> Path:
    url = os.environ.get('DATABASE_URL')
    return db_path_from_url(url) if url else ROOT / 'backend' / 'data' / 'omnitech.db'


def check_integrity(path: Path) -> bool:
    """PRAGMA integrity_check повертає єдиний рядок 'ok', якщо файл не пошкоджений."""
    conn = sqlite3.connect(path)
    try:
        return conn.execute('PRAGMA integrity_check').fetchall() == [('ok',)]
    except sqlite3.DatabaseError:       # це взагалі не база SQLite
        return False
    finally:
        conn.close()


def free_name(out_dir: Path, stamp: str) -> Path:
    path = out_dir / f'{PREFIX}{stamp}.db'
    n = 1
    while path.exists():            # дві копії в одну секунду не затирають одна одну
        path = out_dir / f'{PREFIX}{stamp}-{n}.db'
        n += 1
    return path


def rotate(out_dir: Path, keep: int) -> list[Path]:
    """Видаляє найстаріші копії, лишає `keep` найновіших. Повертає видалені."""
    copies = sorted(out_dir.glob(f'{PREFIX}2*.db'))      # імена з датою сортуються за часом; копії «before-restore» не чіпаємо
    old = copies[:-keep] if keep > 0 else []
    for path in old:
        path.unlink()
    return old


def make_backup(db: Path, out_dir: Path, keep: int = 7, now: datetime | None = None) -> Path:
    if not db.is_file():
        raise SystemExit(f'Базу не знайдено: {db}. Запустіть застосунок хоча б раз або вкажіть --db.')
    out_dir.mkdir(parents=True, exist_ok=True)
    target = free_name(out_dir, (now or datetime.now()).strftime('%Y%m%d-%H%M%S'))
    tmp = target.with_suffix('.part')
    source, dest = sqlite3.connect(db), sqlite3.connect(tmp)
    try:
        source.backup(dest)         # цілісна копія навіть під час запису
    finally:
        dest.close()
        source.close()
    if not check_integrity(tmp):
        tmp.unlink()
        raise SystemExit('Копія не пройшла integrity_check, її видалено.')
    tmp.replace(target)             # файл з'являється під справжнім іменем лише коли готовий
    rotate(out_dir, keep)
    return target


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description='Резервна копія бази SQLite')
    parser.add_argument('--db', type=Path, default=None, help='файл бази (за замовчуванням DATABASE_URL або backend/data/omnitech.db)')
    parser.add_argument('--out', type=Path, default=Path(os.environ.get('BACKUP_DIR', ROOT / 'backups')), help='папка для копій')
    parser.add_argument('--keep', type=int, default=int(os.environ.get('BACKUP_KEEP', '7')), help='скільки найновіших копій лишати (7)')
    parser.add_argument('--every', type=int, default=0, help='секунд між копіями; 0 = одна копія й вихід')
    args = parser.parse_args(argv)
    db = args.db or default_db()

    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))      # docker stop зупиняє цикл одразу
    while True:
        print(f'Резервна копія: {make_backup(db, args.out, args.keep)}', flush=True)
        if args.every <= 0:
            return 0
        time.sleep(args.every)


if __name__ == '__main__':
    sys.exit(main())
