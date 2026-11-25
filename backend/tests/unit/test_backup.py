"""Unit-тести резервних копій (scripts/backup_db.py і scripts/restore_db.py).

Docker не потрібен: скрипти працюють зі звичайними файлами SQLite у тимчасовій папці pytest (tmp_path).
"""

import sqlite3
import sys
from datetime import datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'scripts'))   # корінь репозиторію / scripts

import backup_db  # noqa: E402
import restore_db  # noqa: E402


@pytest.fixture
def database(tmp_path):
    """Маленька база в режимі WAL (як справжня) з двома рядками."""
    path = tmp_path / 'data' / 'omnitech.db'
    path.parent.mkdir()
    conn = sqlite3.connect(path)
    conn.execute('PRAGMA journal_mode = WAL')
    conn.execute('CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT)')
    conn.executemany('INSERT INTO notes (text) VALUES (?)', [('перший',), ('другий',)])
    conn.commit()
    conn.close()
    return path


def texts(path):
    conn = sqlite3.connect(path)
    try:
        return [row[0] for row in conn.execute('SELECT text FROM notes ORDER BY id')]
    finally:
        conn.close()


def test_db_path_from_docker_url():
    assert backup_db.db_path_from_url('sqlite:////app/data/omnitech.db') == Path('/app/data/omnitech.db')
    assert backup_db.db_path_from_url('sqlite:///data/x.db') == Path('data/x.db')


def test_non_sqlite_url_is_rejected():
    with pytest.raises(SystemExit):
        backup_db.db_path_from_url('postgresql://user@host/db')


def test_backup_contains_all_rows(database, tmp_path):
    copy = backup_db.make_backup(database, tmp_path / 'backups')
    assert copy.parent == tmp_path / 'backups'
    assert texts(copy) == ['перший', 'другий']


def test_backup_sees_data_that_is_only_in_wal_file(database, tmp_path):
    """Нове значення ще може лежати лише в -wal. Копіювання самого файлу його б загубило, backup() — ні."""
    writer = sqlite3.connect(database)
    writer.execute("INSERT INTO notes (text) VALUES ('лише у wal')")
    writer.commit()                         # з'єднання лишається відкритим, checkpoint не було
    try:
        copy = backup_db.make_backup(database, tmp_path / 'backups')
    finally:
        writer.close()
    assert texts(copy)[-1] == 'лише у wal'


def test_backup_name_has_timestamp_and_no_part_file_left(database, tmp_path):
    copy = backup_db.make_backup(database, tmp_path / 'b', now=datetime(2026, 11, 18, 12, 30, 5))
    assert copy.name == 'omnitech-20261118-123005.db'
    assert list((tmp_path / 'b').glob('*.part')) == []


def test_two_backups_in_the_same_second_do_not_overwrite(database, tmp_path):
    moment = datetime(2026, 11, 18, 12, 0, 0)
    first = backup_db.make_backup(database, tmp_path / 'b', now=moment)
    second = backup_db.make_backup(database, tmp_path / 'b', now=moment)
    assert first != second and first.exists() and second.exists()


def test_rotation_keeps_only_newest(database, tmp_path):
    out = tmp_path / 'b'
    for minute in range(5):
        backup_db.make_backup(database, out, keep=3, now=datetime(2026, 11, 18, 12, minute, 0))
    names = sorted(p.name for p in out.glob('*.db'))
    assert names == ['omnitech-20261118-120200.db', 'omnitech-20261118-120300.db', 'omnitech-20261118-120400.db']


def test_missing_database_gives_clear_error(tmp_path):
    with pytest.raises(SystemExit) as error:
        backup_db.make_backup(tmp_path / 'nope.db', tmp_path / 'b')
    assert 'не знайдено' in str(error.value)


def test_main_uses_environment(database, tmp_path, monkeypatch, capsys):
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{database.as_posix()}')
    assert backup_db.main(['--out', str(tmp_path / 'env-b')]) == 0
    assert 'Резервна копія:' in capsys.readouterr().out
    assert len(list((tmp_path / 'env-b').glob('*.db'))) == 1


def test_restore_brings_back_deleted_row(database, tmp_path):
    copy = backup_db.make_backup(database, tmp_path / 'b')
    conn = sqlite3.connect(database)
    conn.execute("DELETE FROM notes WHERE text = 'другий'")
    conn.commit()
    conn.close()
    assert texts(database) == ['перший']
    restore_db.restore(copy, database)
    assert texts(database) == ['перший', 'другий']


def test_restore_keeps_a_safety_copy_of_the_current_database(database, tmp_path):
    copy = backup_db.make_backup(database, tmp_path / 'b')
    conn = sqlite3.connect(database)
    conn.execute("INSERT INTO notes (text) VALUES ('після копії')")
    conn.commit()
    conn.close()
    safety = restore_db.restore(copy, database)
    assert 'before-restore' in safety.name
    assert texts(safety)[-1] == 'після копії'
    assert 'після копії' not in texts(database)


def test_restore_refuses_corrupted_backup(database, tmp_path):
    bad = tmp_path / 'bad.db'
    bad.write_bytes(b'this is not a database' * 100)
    with pytest.raises(SystemExit):
        restore_db.restore(bad, database)
    assert texts(database) == ['перший', 'другий']      # база не постраждала


def test_restore_refuses_missing_file(database, tmp_path):
    with pytest.raises(SystemExit):
        restore_db.restore(tmp_path / 'nope.db', database)
