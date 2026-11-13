"""Єдине місце, де збираються всі адреси API.

Кожен файл у app/routers описує свою групу адрес (APIRouter), а тут вони підключаються під
спільні префікси: /api/v1/… і /api/v2/…. Кожна частина проєкту додає сюди свої рядки.
"""

from fastapi import APIRouter

from app.routers import health
from app.routers.v1 import admin_users, auth, users
from app.routers.v1 import categories, products, reviews, wishlist
from app.routers.v2 import products as products_v2
from app.routers.v1 import admin_feedback, admin_orders, admin_stats, cart, feedback, orders

# Опис розділів для сторінки /docs (порядок тут = порядок розділів на сторінці)
TAGS = [
    {'name': 'Авторизація', 'description': 'Реєстрація і вхід. Токен з /auth/token вставляється в кнопку Authorize.'},
    {'name': 'Профіль', 'description': 'Дані користувача, який увійшов.'},
    {'name': 'Категорії', 'description': 'Категорії товарів. Зміни — лише адміністратор.'},
    {'name': 'Товари', 'description': 'Каталог: пошук, фільтри, сторінки, картинки.'},
    {'name': 'Відгуки', 'description': 'Відгуки покупців про товари.'},
    {'name': 'Список бажань', 'description': 'Товари, які користувач відклав на потім.'},
    {'name': 'Товари v2', 'description': 'Друга версія: категорія й рейтинг усередині товару.'},
    {'name': 'Кошик', 'description': 'Розрахунок кошика (сам кошик зберігає клієнт).'},
    {'name': 'Замовлення', 'description': 'Оформлення замовлення та історія замовлень.'},
    {'name': "Зворотний зв'язок", 'description': 'Повідомлення з форми «Контакти».'},
    {'name': 'Адміністрування', 'description': 'Лише для ролі admin.'},
    {'name': 'Службові', 'description': 'Стан сервера.'},
]

api_v1 = APIRouter(prefix='/v1')
api_v1.include_router(auth.router)
api_v1.include_router(users.router)
api_v1.include_router(admin_users.router)
api_v1.include_router(categories.router)
api_v1.include_router(products.router)
api_v1.include_router(reviews.router)
api_v1.include_router(reviews.admin_router)
api_v1.include_router(wishlist.router)
api_v1.include_router(cart.router)
api_v1.include_router(orders.router)
api_v1.include_router(feedback.router)
api_v1.include_router(admin_orders.router)
api_v1.include_router(admin_feedback.router)
api_v1.include_router(admin_stats.router)

api_v2 = APIRouter(prefix='/v2')
api_v2.include_router(products_v2.router)

api_router = APIRouter(prefix='/api')
api_router.include_router(health.router)
api_router.include_router(api_v1)
api_router.include_router(api_v2)
