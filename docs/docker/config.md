# Конфігурація

## Файл `.env`

Compose читає змінні з файлу `.env` у корені проєкту. У Git його немає (він у `.gitignore`), зразок лежить у `.env.example`:

```bash
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```

| Змінна | За замовчуванням | Для чого |
|---|---|---|
| `HTTP_PORT` | `8080` | порт сайту на вашому комп'ютері. Якщо зайнятий — змініть, наприклад на `8090` |
| `SECRET_KEY` | демо-ключ із `.env.example` | підпис токенів входу, не менше 32 символів. Без цієї змінної `docker compose up` зупиниться з підказкою |
| `APP_ENV` | `production` | `production` — логи у форматі JSON, `development` — читабельні рядки |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `SEED_ON_START` | `true` | при старті заповнити ПОРОЖНЮ базу демо-даними (наявні дані не чіпаються) |
| `CORS_ORIGINS` | `[]` | дозволені джерела CORS, JSON-список. Через Nginx сайт і API на одній адресі, тому зазвичай порожньо |
| `BACKUP_KEEP` | `7` | скільки найновіших копій бази лишати (сервіс `backup`) |
| `BACKEND_DEV_PORT`, `FRONTEND_DEV_PORT` | `8000`, `5173` | порти лише для `compose.dev.yaml` |

> [!WARNING]
> Демо-ключ з `.env.example` лежить у публічному репозиторії. Для справжнього сервера згенеруйте свій:
> `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

Змінні контейнера, які задає сам образ (змінювати не треба): `DATABASE_URL=sqlite:////app/data/omnitech.db`,
`MEDIA_DIR=/app/media`, `PORT=8000`, `PYTHONUNBUFFERED=1`.

Як значення потрапляє в застосунок: `.env` → `${ЗМІННА}` у `compose/backend.yaml` → змінна оточення контейнера →
`pydantic-settings` у `backend/app/core/config.py`. Змінні оточення важливіші за `backend/.env`, тож локальний запуск без Docker
працює як і раніше.

## Файли Compose

| Файл | Зміст |
|---|---|
| `compose.yaml` | назва проєкту `omnitech`, `include:` трьох файлів, три volume |
| `compose/backend.yaml` | сервіс `backend`: збірка, змінні, volume, healthcheck, restart, обмеження, логування |
| `compose/frontend.yaml` | сервіс `frontend`: збірка (`VITE_API_URL=""`), порт `HTTP_PORT`, залежність від `backend` |
| `compose/ops.yaml` | сервіс `backup` (профіль `ops`) |
| `compose.dev.yaml` | те саме, але до `backend` і `frontend` додаються `*.dev.yaml` |
| `compose/backend.dev.yaml`, `compose/frontend.dev.yaml` | `--reload`, DEBUG, bind mount коду, сервер Vite |

Корисно знати:

- `docker compose config` показує підсумкову конфігурацію після підстановки змінних: так видно, що саме запуститься.
- Шляхи в підключених файлах рахуються від папки цього файлу (тому в `compose/backend.yaml` стоїть `context: ../backend`).
- Томи оголошені в `compose.yaml` і в `compose.dev.yaml` (інакше `include` не знає, що це за volume). Справжні назви мають префікс
  проєкту: `omnitech_omnitech-data`, `omnitech_omnitech-media`, `omnitech_omnitech-backups` (`docker volume ls`).
- Інша назва проєкту (наприклад, для другої копії на тому ж комп'ютері): `docker compose -p demo2 up`, тоді томи й контейнери окремі,
  а `HTTP_PORT` треба змінити.

## Health checks

| Сервіс | Перевірка | Інтервал | Початок |
|---|---|---|---|
| `backend` | Python відкриває `http://127.0.0.1:8000/api/health` (200 лише коли відповідає й база) | 15 с, 3 спроби | 15 с |
| `frontend` | `wget http://127.0.0.1/healthz` (відповідає сам Nginx) | 15 с, 3 спроби | 5 с |

Стан: `docker compose ps` (колонка STATUS) або `docker inspect --format "{{json .State.Health}}" <контейнер>`.

## Логи

Усі сервіси пишуть у stdout, Docker зберігає їх у форматі `json-file` з ротацією (`max-size: 10m`, `max-file: 3`).

```bash
docker compose logs -f backend          # JSON (production) або звичайні рядки (development)
docker compose logs --tail 50 frontend  # access- і error-логи Nginx
```

## Збірка

```bash
docker compose build                    # лише зібрати образи
docker compose build --no-cache backend # з нуля, без кешу шарів
docker images                           # розмір образів omnitech-backend, omnitech-frontend
```

`VITE_API_URL` вбудовується в код сайту під час збирання, а не під час запуску. Змінили її у `compose/frontend.yaml`: потрібен
`docker compose up --build`.

Порожня `VITE_API_URL` означає запити на той самий адрес, що й сторінка (`/api/...`). Тому `frontend/src/api/client.js` будує адресу як `new URL(API_URL + path, location.origin)`: без другого аргументу `new URL('/api/...')` кидає помилку, і сторінки з даними показують «Не вдалося з'єднатися із сервером».

## Шпаргалка команд

| Мета | Команда |
|---|---|
| запустити у фоні й дочекатися healthy | `docker compose up --build --wait -d` |
| стан | `docker compose ps` |
| зупинити, дані лишаються | `docker compose down` |
| зупинити й ВИДАЛИТИ базу та картинки | `docker compose down -v` |
| оболонка в контейнері | `docker compose exec backend sh` |
| перевірити права на базу | `docker compose exec backend ls -la /app/data` |
| режим розробки | `docker compose -f compose.dev.yaml up --build` |
| повна перевірка | `python scripts/docker_smoke.py` |
