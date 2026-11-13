"""Єдине місце, де збираються всі адреси API.

Кожен файл у app/routers описує свою групу адрес (APIRouter), а тут вони підключаються під
спільні префікси: /api/v1/… і /api/v2/…. Кожна частина проєкту додає сюди свої рядки.
"""

from fastapi import APIRouter

from app.routers import health
from app.routers.v1 import admin_users, auth, users

# Опис розділів для сторінки /docs (порядок тут = порядок розділів на сторінці)
TAGS = [
    {'name': 'Авторизація', 'description': 'Реєстрація і вхід. Токен з /auth/token вставляється в кнопку Authorize.'},
    {'name': 'Профіль', 'description': 'Дані користувача, який увійшов.'},
    {'name': 'Адміністрування', 'description': 'Лише для ролі admin.'},
    {'name': 'Службові', 'description': 'Стан сервера.'},
]

api_v1 = APIRouter(prefix='/v1')
api_v1.include_router(auth.router)
api_v1.include_router(users.router)
api_v1.include_router(admin_users.router)

api_router = APIRouter(prefix='/api')
api_router.include_router(health.router)
api_router.include_router(api_v1)
