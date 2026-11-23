# Образ бекенду OmniTech (лабораторна 08). Збірка з папки backend:  docker build -t omnitech-backend backend
# Два етапи: у першому ставимо бібліотеки, у другому лишається тільки готове середовище без кешу pip.
# Обидва етапи на одному образі python:3.13-slim (Debian), тому скомпільовані пакунки (argon2, pillow) сумісні.

# ---------- Етап 1: бібліотеки ----------
FROM python:3.13-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Віртуальне середовище лежить в окремій папці, щоб його можна було скопіювати одним рядком
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Спершу лише список бібліотек: поки requirements.txt не змінився, Docker бере цей шар з кешу
# і зміна коду застосунку не змушує ставити всі пакети заново
COPY requirements.txt .
# --no-compile: не зберігати скомпільовані .pyc (економить ~27 МБ). pip у фінальному образі не потрібен, тож
# видаляємо його з середовища (~13 МБ)
RUN pip install --no-compile -r requirements.txt \
    && rm -rf /opt/venv/lib/python3.13/site-packages/pip /opt/venv/lib/python3.13/site-packages/pip-*.dist-info

# ---------- Етап 2: фінальний образ ----------
FROM python:3.13-slim

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    DATABASE_URL=sqlite:////app/data/omnitech.db \
    MEDIA_DIR=/app/media

# Звичайний користувач замість root. Папки data і media належать йому: коли Docker створює порожній
# volume на такій папці, він копіює власника з образу, тож SQLite може писати файл бази та -wal/-shm.
RUN useradd --system --uid 10001 --no-create-home app \
    && mkdir -p /app/data /app/media \
    && chown app:app /app/data /app/media

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
# Код копіюємо останнім: він змінюється найчастіше
COPY app ./app

USER 10001
EXPOSE 8000

# У slim-образі немає curl, тому перевіряємо /api/health самим Python
# (urlopen кидає помилку на 503, тобто коли база недоступна)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/health' % os.environ['PORT'])"]

# exec-форма: головним процесом (PID 1) стає сам Python, а потім uvicorn, тож він отримує SIGTERM від docker stop
ENTRYPOINT ["python", "-m", "app.entrypoint"]
