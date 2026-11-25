# Типові проблеми

## Спочатку три команди

```bash
docker compose ps                       # хто запущений і healthy чи ні
docker compose logs --tail 50 backend   # що написав бекенд
docker compose config                   # що саме Compose збирається запускати (після підстановки .env)
```

## Docker Desktop не запускається (Windows)

| Симптом | Причина | Що робити |
|---|---|---|
| «WSL 2 is not installed», «WSL needs updating» | немає або застарів WSL2 | PowerShell від імені адміністратора: `wsl --install`, потім `wsl --update`, перезавантажити комп'ютер |
| «Virtualization support not detected», «Hardware assisted virtualization is disabled» | вимкнена віртуалізація в BIOS | перезавантажити, увійти в BIOS/UEFI, увімкнути **Intel VT-x** (Virtualization Technology) або **AMD SVM Mode**. Перевірка: Диспетчер завдань → Продуктивність → ЦП → «Віртуалізація: увімкнено» |
| Docker стартує дуже довго, комп'ютер гальмує, «Out of memory» | WSL2 забирає багато пам'яті | створити файл `%UserProfile%\.wslconfig` з рядками `[wsl2]` і `memory=4GB`, потім `wsl --shutdown` і запустити Docker Desktop знову |
| На Windows Home не вдається ввімкнути Hyper-V | у Home немає Hyper-V | він і не потрібен: Docker Desktop працює через WSL2. Увімкніть у «Компоненти Windows» пункти «Платформа віртуальної машини» і «Підсистема Windows для Linux», перезавантажте |
| Docker Desktop вічно «Starting…» | зависла службова віртуальна машина | `wsl --shutdown`, закрити Docker Desktop, відкрити знову; якщо не допомогло — Troubleshoot → Restart або Reset to factory defaults |
| `error during connect` / `cannot connect to the Docker daemon` | Docker Desktop не запущений | запустити Docker Desktop і дочекатися зеленого значка |

Перевірка, що все гаразд: `docker --version`, `docker compose version`, `docker run hello-world`.
Для `include:` і `dockerfile_inline` у проєкті потрібен Docker Compose версії 2.20 або новіший.

## Помилки під час запуску проєкту

| Повідомлення або симптом | Причина | Рішення |
|---|---|---|
| `env file .../.env not found` або `required variable SECRET_KEY is missing a value` | немає файлу `.env` | `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`) |
| `port is already allocated` або `Bind for 0.0.0.0:8080 failed` | порт 8080 зайнятий | знайти: `netstat -ano \| findstr :8080`. Або зупинити ту програму, або змінити `HTTP_PORT=8090` у `.env` і запустити знову |
| контейнер `backend` постійно перезапускається (`Restarting`) | помилка при старті | `docker compose logs backend`: найчастіше `SECRET_KEY` коротший за 32 символи або починається з `replace-me` |
| `exec ... no such file or directory`, `/bin/sh^M`, дивні символи `\r` у помилках | у файлах в кінці рядків CRLF (Windows) замість LF | у проєкті є `.gitattributes`, який вимагає LF. Якщо клонували до нього: `git config core.autocrlf false` і клонувати репозиторій заново (або, зберігши свої зміни, `git add --renormalize .`) |
| `sqlite3.OperationalError: unable to open database file` | у папку бази не можна писати | не підключайте до `/app/data` папку з комп'ютера (bind mount), лише named volume. Виправити права: `docker run --rm -v omnitech_omnitech-data:/d busybox chown -R 10001:10001 /d` |
| `502 Bad Gateway` на сайті | Nginx не достукався до бекенду | `docker compose ps`: чи `backend` healthy? `docker compose logs backend`. Зазвичай бекенд ще стартує (до 15 с) або впав |
| сайт відкривається, а запити до API йдуть на `127.0.0.1:8000` і падають | сайт зібраний з адресою розробки | `VITE_API_URL` у `compose/frontend.yaml` має бути порожнім, потім `docker compose up --build` |
| `invalid mount config ... mount path must be absolute` у Git Bash | Git Bash перетворює шляхи `/app/...` на `C:/Program Files/Git/app/...` | додати перед командою `MSYS_NO_PATHCONV=1` або запускати в PowerShell |
| `pull access denied for omnitech-backend` | повідомлення Compose, коли образу ще немає локально | це не помилка: далі Compose збере образ сам |
| змінив `.env`, а нічого не змінилося | контейнер не перестворено | `docker compose up -d` (Compose перестворить змінені сервіси); перевірити: `docker compose exec backend env` |
| після `docker compose down -v` база порожня | `-v` видаляє volume з даними | так і задумано. Відновити з копії: [backup.md](backup.md) |
| `no space left on device` | Docker зайняв весь диск | `docker system df`, потім `docker system prune` (видалить зупинені контейнери й невикористані образи) |
| збирання дуже довго або падає на `pip install`/`npm ci` | немає інтернету або він нестабільний | повторити `docker compose build`; кеш уже зібраних шарів збережеться |

## Як перевірити конкретну річ

| Питання | Команда |
|---|---|
| чи здоровий контейнер і чому ні | `docker inspect --format "{{json .State.Health}}" omnitech-backend-1` |
| скільки разів перезапускався | `docker inspect --format "{{.RestartCount}}" omnitech-backend-1` |
| права на базу | `docker compose exec backend ls -la /app/data` (власник `app`, файли `omnitech.db`, `-wal`, `-shm`) |
| чи API відповідає зсередини | `docker compose exec backend python -c "import urllib.request as u; print(u.urlopen('http://127.0.0.1:8000/api/health').read())"` |
| чи Nginx бачить бекенд | `docker compose exec frontend wget -qO- http://backend:8000/api/health` |
| куди пішла база | `docker volume ls`, `docker volume inspect omnitech_omnitech-data` |

(`omnitech-backend-1` — назва контейнера за схемою `<проєкт>-<сервіс>-1`; точну дивіться в `docker compose ps`.)

## Якщо Docker на вашому комп'ютері не запускається

Робота здається не тільки з власним Docker. Виберіть один із шляхів, а в звіті напишіть, який саме.

### Шлях A: GitHub Codespaces

1. Відкрити репозиторій на GitHub → **Code** → **Codespaces** → **Create codespace on main** (на безкоштовному тарифі є щомісячний ліміт годин).
2. У терміналі Codespaces перевірити `docker --version` (у стандартному образі Docker вже є).
3. `cp .env.example .env`, `docker compose up --build --wait`, `python3 scripts/docker_smoke.py --no-up`.
4. Вкладка **Ports** покаже порт 8080: відкрити його в браузері. Знімки екрана для звіту робляться там.
5. Після роботи зупинити Codespace (**Stop**), щоб не витрачати ліміт.

### Шлях B: GitHub Actions як доказ

Відкрийте Pull Request. Робочий процес `.github/workflows/docker.yml` сам збере образи, запустить `docker compose up --wait` і виконає
`docker_smoke.py`. Зелена галочка «Docker» у PR і розгорнутий журнал кроків (знімок екрана) — доказ, що ваші файли працюють.
Якщо крок червоний, у кінці журналу є логи контейнерів (`docker compose logs`).

### Шлях C: перевірки без Docker

Цього достатньо, щоб показати свою частину коду, навіть без контейнерів:

```bash
cd backend && pip install -r requirements-dev.txt && pytest        # включно з test_entrypoint, test_backup, test_logging
python scripts/backup_db.py --db backend/data/omnitech.db          # копія локальної бази (спершу python -m app.seed у backend)
python scripts/restore_db.py backups/<файл>.db                     # відновлення
cd frontend && npm ci && npm run build                             # збирання сайту
```

Файли Dockerfile та compose у такому разі перевіряє GitHub Actions (шлях B) або хтось із команди, у кого Docker працює:
`docker compose config` не запускає контейнерів, але ловить помилки в самих файлах.
