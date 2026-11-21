# Docker у проєкті OmniTech (лабораторна 08)

Увесь проєкт (сайт, API, база) запускається в контейнерах однією командою. Тут зібрана вся документація.

## Швидкий старт

```bash
git clone https://github.com/Hyrysake/omnitech.git
cd omnitech
cp .env.example .env            # у Windows PowerShell: Copy-Item .env.example .env
docker compose up --build
```

Сайт відкривається на <http://localhost:8080>, документація API — на <http://localhost:8080/docs>.
Демо-акаунти ті самі, що в README (`admin@omnitech.example` / `admin123`).
Зупинити: `Ctrl+C` або `docker compose down` (дані бази лишаються у volume).

## Розділи

| Розділ | Про що | Файл |
|---|---|---|
| Архітектура | схема сервісів, образи, томи, мережа, пояснення рішень | [architecture.md](architecture.md) |
| Конфігурація | усі змінні `.env`, файли `compose/`, режими prod і dev | [config.md](config.md) |
| Тестування | що перевіряє `scripts/docker_smoke.py`, як запустити, GitHub Actions | [testing.md](testing.md) |
| Резервні копії | backup і відновлення бази SQLite, розклад, ротація | [backup.md](backup.md) |
| Типові проблеми | помилки та їх розв'язання, що робити, якщо Docker не запускається | [troubleshooting.md](troubleshooting.md) |

## Три режими запуску

| Режим | Команда | Що відбувається |
|---|---|---|
| Робочий (prod) | `docker compose up --build -d` | Nginx віддає зібраний сайт і пересилає `/api` на бекенд; контейнери самі перезапускаються |
| Розробка (dev) | `docker compose -f compose.dev.yaml up --build` | код з вашої папки, бекенд перезапускається при зміні файлів, сайт на сервері Vite (порт 5173) |
| Резервні копії (ops) | `docker compose --profile ops run --rm backup python /scripts/backup_db.py` | одна копія бази у volume `omnitech-backups` |
