# Тестування Docker-запуску

Для лабораторної 08 тестується не логіка застосунку (це зробили pytest-тести лабораторної 07), а те, що контейнери збираються,
запускаються, зберігають дані й відновлюються після збою. Це робить скрипт `scripts/docker_smoke.py` (лише стандартна бібліотека Python).

## Як запустити

```bash
python scripts/docker_smoke.py            # зібрати, запустити, перевірити, зупинити з видаленням volume
python scripts/docker_smoke.py --no-up    # стек уже запущено, збирання пропустити (так працює GitHub Actions)
python scripts/docker_smoke.py --keep     # після перевірки нічого не зупиняти
```

Порт береться зі змінної `HTTP_PORT` (за замовчуванням 8080), назва проєкту — з `COMPOSE_PROJECT_NAME`. Файл `.env` скрипт
створює сам з `.env.example`, якщо його немає. Код виходу 0 означає, що жодної перевірки `FAIL` немає. Повна перевірка
з нуля триває 2–3 хвилини (більшу частину займає збирання образів).

## Що перевіряється

| # | Перевірка | Що це доводить |
|---|---|---|
| 1 | `docker compose config` для `compose.yaml` і `compose.dev.yaml` | файли без синтаксичних помилок, змінні підставляються |
| 2 | `up --build --wait` завершується успішно | образи збираються, healthcheck усіх сервісів зелений |
| 3 | `docker compose ps`: усі контейнери `healthy` | перевірка стану працює |
| 4 | `GET /api/health` через Nginx: `{"status": "ok", "database": "ok"}` | проксі `/api` працює, бекенд бачить базу |
| 5 | `GET /api/v1/products` віддає JSON | справжнє API, а не лише службова адреса |
| 6 | шість публічних сторінок (`/`, `/catalog.html`, `/login.html`, `/register.html`, `/about.html`, `/admin/index.html`) дають 200 | Nginx віддає зібраний сайт |
| 7 | `/no-such-page.html` дає 404 і сторінку `404.html` | у багатосторінкового сайту немає «запасної» головної |
| 8 | у зібраному JS немає `127.0.0.1:8000` | `VITE_API_URL` справді порожня, запити відносні |
| 9 | файл у volume `omnitech-media` доступний за `/media/products/smoke.txt` | проксі `/media` працює |
| 10 | образ бекенду менший за 250 МБ | оптимізація (multi-stage, slim, `--no-compile`) |
| 11 | реєстрація, `down` (без `-v`), `up`, вхід цим користувачем | база переживає видалення контейнерів (volume) |
| 12 | `kill 1` у контейнері бекенду: `RestartCount` зростає, сервіс знову відповідає | restart policy та healthcheck |
| 13 | `backup_db.py` → видалення рядка → `restore_db.py` → рядок знову є | резервні копії й відновлення |

Після перевірки скрипт виконує `docker compose down -v` (без `--keep`), тож нічого не лишається на комп'ютері.

### Заглушки: SKIP, а не FAIL

У базовій мітці `lab08-base` сайт, API і сервіс `backup` — заглушки з публічних образів, щоб `docker compose up` працював
ще до того, як кожен зробить свій крок. Скрипт розпізнає заглушку (відповідь `{"status": "stub"}`, заголовок
`X-OmniTech-Stub`, образ `busybox`) і пише `[SKIP]` замість `[FAIL]`. Коли злито всі три частини, SKIP не залишається.

Приклад повного результату:

```text
Конфігурація
  [PASS] compose.yaml і compose.dev.yaml коректні (docker compose config)
Збирання й запуск (docker compose up --build --wait)
  [PASS] усі сервіси стали healthy
  ...
  [PASS] restore_db.py повернув видалений рядок
SMOKE: 16 pass, 0 fail, 0 skip
```

## Автоматично: GitHub Actions

`.github/workflows/docker.yml` на кожен push у `main` і кожен Pull Request створює `.env`, перевіряє `docker compose config`,
виконує `docker compose up --build --wait` і запускає `python3 scripts/docker_smoke.py --no-up`. У разі помилки в журнал
виводяться логи контейнерів. Для тих, у кого Docker не запускається локально, зелений запуск «Docker» у PR — доказ роботи.

## Що ще перевіряється поза Docker

| Що | Команда | Очікується |
|---|---|---|
| тести бекенду, зокрема запуску й копій | `cd backend && pytest` | усі зелені (тести `test_entrypoint.py`, `test_backup.py`, `test_logging.py` не потребують Docker) |
| збирання сайту | `cd frontend && npm ci && npm run build` | папка `dist/` без помилок |
| чиста система | `docker compose down -v`, клонувати репозиторій в нову папку, `cp .env.example .env`, `docker compose up --build` | усе піднімається з нуля |

## Перевірка вручну (для звіту)

1. `docker compose up --build -d`, потім `docker compose ps`: у STATUS мають бути `healthy` (на знімок екрана).
2. Відкрити <http://localhost:8080>, зареєструвати користувача, додати товар у кошик.
3. `docker compose down`, `docker compose up -d`: користувач на місці.
4. `docker compose exec backend sh -c "kill 1"`, через кілька секунд `docker compose ps`: сервіс знову `healthy`.
5. `docker compose logs backend`: видно запити в JSON.
6. `docker images`: розмір `omnitech-backend` і `omnitech-frontend`.
