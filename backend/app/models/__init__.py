"""Усі моделі в одному місці.

Імпорт цього пакета реєструє кожну модель у Base.metadata, тому init_db() створює всі таблиці.
Кожна частина проєкту додає сюди рядок зі своїми моделями.
"""

from app.models.user import User
from app.models.category import Category
from app.models.product import Product
from app.models.review import Review
from app.models.wishlist import WishlistItem

__all__ = [
    'User',
    'Category', 'Product', 'Review', 'WishlistItem',
]
