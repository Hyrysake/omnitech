# Резервні копії бази

База SQLite лежить у volume `omnitech-data` (`/app/data/omnitech.db`). Volume переживає `docker compose down`, але не `down -v`
і не захищає від помилки (випадково видалений запис, зламане оновлення). Для цього є резервні копії.

## Чому не просто скопіювати файл

У режимі WAL нові дані спершу потрапляють у файл `omnitech.db-wal` і лише потім переносяться в основний файл. Якщо копіювати
тільки `omnitech.db`, у копії не буде свіжих змін, а копія файлу під час запису може вийти пошкодженою. Тому скрипти
використовують `sqlite3.Connection.backup()`: вбудований механізм SQLite робить цілісну копію, навіть коли застосунок працює.
Готову копію скрипт перевіряє через `PRAGMA integrity_check`. Файл спершу має суфікс `.part` і отримує справжнє ім'я
лише коли готовий, тож напівготова копія ніколи не виглядає як справжня.

## Що де лежить

| Що | Де |
|---|---|
| база | volume `omnitech-data`, папка `/app/data` у контейнерах `backend` і `backup` |
| копії | volume `omnitech-backups`, папка `/app/backups`, файли `omnitech-РРРРММДД-ГГххсс.db` |
| скрипти | `scripts/backup_db.py`, `scripts/restore_db.py`; у контейнері `backup` вони в `/scripts` |

Ротація: скрипт лишає `BACKUP_KEEP` найновіших копій (за замовчуванням 7) і видаляє старіші. Копії `omnitech-before-restore-*.db`
(див. нижче) ротація не чіпає.

## Разова копія

```bash
docker compose --profile ops run --rm backup python /scripts/backup_db.py
```

В останньому рядку виводу — шлях до файлу, наприклад `Резервна копія: /app/backups/omnitech-20261118-120000.db`.
Список копій:

```bash
docker compose --profile ops run --rm backup ls -la /app/backups
```

## Автоматично

Сервіс `backup` за замовчуванням робить копію раз на добу (`--every 86400`):

```bash
docker compose --profile ops up -d backup
docker compose logs backup
```

Це працює, поки запущено Docker і контейнер. Без Docker Desktop на комп'ютері (він не завжди запущений) надійніше
запускати разову копію за розкладом системи: планувальник завдань Windows або `cron` викликає ту саму команду `run --rm backup`.

## Відновлення

1. Подивитись список копій (команда вище) і вибрати файл.
2. Бажано зупинити бекенд: `docker compose stop backend`.
3. Відновити:

```bash
docker compose --profile ops run --rm backup python /scripts/restore_db.py /app/backups/omnitech-20261118-120000.db
```

4. Запустити знову: `docker compose start backend`.

Що робить `restore_db.py`: перевіряє файл копії (`integrity_check`), зберігає поточну базу як `omnitech-before-restore-<час>.db` поруч із копіями
(відновлення можна скасувати) і копіює вміст копії в базу через `backup()`. Пошкоджену копію скрипт не прийме, база лишиться як була.

## Копія на комп'ютер

Файл із volume можна забрати на хост:

```bash
docker compose --profile ops run --rm -v "%cd%:/out" backup cp /app/backups/omnitech-20261118-120000.db /out/
```

У PowerShell замість `%cd%` пишуть `${PWD}`, у Linux і Git Bash — `$(pwd)`. Копія на тому ж диску не рятує від втрати диска:
для справжнього сервера її треба зберігати ще й в іншому місці.

## Без Docker

Скрипти не потребують Docker, лише Python:

```bash
python scripts/backup_db.py                  # backend/data/omnitech.db -> backups/
python scripts/backup_db.py --db other.db --out my-backups --keep 3
python scripts/restore_db.py backups/omnitech-20261118-120000.db
```

Папка `backups/` у `.gitignore`: копії не потрапляють у репозиторій.

## Увага: `down -v` і копії

`docker compose down -v` видаляє лише ті volume, якими користуються запущені (активні) сервіси. Сервіс `backup` має профіль `ops`,
тому без профілю volume `omnitech-backups` після `down -v` **лишається**. Це корисно (копії переживають повне скидання бази),
але щоб прибрати все, пишіть `docker compose --profile ops down -v`.

## Обмеження

- Копія містить усю базу, зокрема хеші паролів і замовлення. Не публікуйте її й не додавайте в Git.
- Картинки з volume `omnitech-media` цим скриптом не копіюються (це файли, а не база). Їх можна зберегти командою `docker run --rm -v omnitech_omnitech-media:/m -v "$(pwd):/out" busybox tar czf /out/media.tgz -C /m .`.
- Для кількох серверів і великого навантаження SQLite не підходить, потрібна клієнт-серверна база з власними інструментами копій.
