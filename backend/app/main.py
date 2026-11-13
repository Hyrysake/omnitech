"""Точка входу: створює застосунок FastAPI і підключає все інше.

Запуск (з папки backend):  uvicorn app.main:app --reload
Документація API:          http://127.0.0.1:8000/docs
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import TAGS, api_router
from app.core.config import settings
from app.core.errors import error_body, register_error_handlers
from app.db.session import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Код до yield виконується один раз під час запуску сервера, після yield — під час зупинки."""
    init_db()   # створити таблиці, яких ще немає
    yield


app = FastAPI(
    title=settings.app_name,
    version='1.0.0',
    description='REST API інтернет-магазину OmniTech. Вхід: кнопка **Authorize** '
                '(пошта в полі username). Демо-акаунти — у README.',
    openapi_tags=TAGS,
    lifespan=lifespan,
)


@app.middleware('http')
async def limit_request_size(request: Request, call_next):
    """Відхиляє завеликий запит ДО того, як сервер його прочитає (413).

    Перевіряється заголовок Content-Length (розмір тіла, який повідомляє клієнт). Без цього
    сервер спершу записав би весь файл на диск, а вже потім сказав би, що він завеликий.
    Запас 1 МБ — на службові частини запиту з файлом (multipart). Запит без Content-Length
    (передача частинами, chunked) так не зупинити: його ловить уже перевірка в services/media.py,
    а на справжньому сервері розмір тіла обмежує ще й проксі (nginx) перед застосунком.
    Ця функція оголошена ДО CORS, тож CORS загортає її і додає свої заголовки навіть до відповіді 413.
    """
    limit = (settings.max_upload_mb + 1) * 1024 * 1024
    length = request.headers.get('content-length')
    if length is not None and length.isdigit() and int(length) > limit:
        return JSONResponse(status_code=413, content=error_body(f'Запит завеликий: не більше {settings.max_upload_mb} МБ.'))
    return await call_next(request)


# CORS: браузер дозволить сторінці з іншої адреси (дев-сервер Vite у Lab 06) читати відповіді API
# лише з цих джерел. Токен ходить у заголовку Authorization, а не в cookie, тому credentials не потрібні
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allow_headers=['Authorization', 'Content-Type'],
)

register_error_handlers(app)
app.include_router(api_router)

# Завантажені файли (картинки товарів) віддаються як статичні: /media/products/<ім'я>.webp
settings.media_dir.mkdir(parents=True, exist_ok=True)
app.mount('/media', StaticFiles(directory=settings.media_dir), name='media')
