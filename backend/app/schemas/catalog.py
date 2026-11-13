"""Схеми категорій і товарів."""

import re
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, Field

from app.schemas.common import InputModel, OutputModel


# Адреса файлу, який видав наш сервер: /media/products/<32 шістнадцяткові символи>.<jpg|png|webp>
MEDIA_URL_PATTERN = re.compile(r'/media/products/[0-9a-f]{32}\.(jpg|png|webp)')


def check_image_url(url: str) -> str:
    """Порожньо, зовнішня адреса http(s)://… або точна адреса файлу, який завантажили до нас.

    Довільний шлях /media/... (наприклад, з ../) не приймається: інакше в адресу можна було б
    підставити чужий файл, і його видалили б разом із «своїм» товаром.
    """
    if url and not url.startswith(('http://', 'https://')) and not MEDIA_URL_PATTERN.fullmatch(url):
        raise ValueError('Адреса картинки має починатися з http:// чи https:// або бути адресою завантаженого файлу.')
    return url


CategoryName = Annotated[str, Field(min_length=2, max_length=50, examples=['Ноутбуки'])]
ProductName = Annotated[str, Field(min_length=3, max_length=200, examples=['Ноутбук OmniBook Air 14'])]
# strict=True: для API ціна — лише справжнє ціле число JSON. Рядок "15999", дріб 12.5 і true
# не пройдуть (у нестрогому режимі Pydantic перетворив би "15999" на число мовчки)
Price = Annotated[int, Field(gt=0, le=10_000_000, strict=True, examples=[32999])]
CategoryId = Annotated[int, Field(gt=0, le=2_147_483_647, strict=True, examples=[1])]
Description = Annotated[str, Field(max_length=1000)]
ImageUrl = Annotated[str, Field(max_length=500), AfterValidator(check_image_url)]

# Допустимі способи сортування каталогу
ProductSort = Literal['default', 'price_asc', 'price_desc', 'name', 'newest']


class CategoryIn(InputModel):
    name: CategoryName


class CategoryOut(OutputModel):
    id: int
    name: str


class CategoryWithCount(CategoryOut):
    product_count: int = Field(description='Скільки товарів у категорії')


class ProductCreate(InputModel):
    """Новий товар (POST) або повна заміна (PUT): обов'язкові поля мають бути всі."""

    category_id: CategoryId
    name: ProductName
    price: Price
    description: Description = ''
    image_url: ImageUrl = ''
    is_featured: Annotated[bool, Field(strict=True)] = False


class ProductUpdate(InputModel):
    """Часткова зміна (PATCH): будь-яке поле можна пропустити."""

    category_id: CategoryId | None = None
    name: ProductName | None = None
    price: Price | None = None
    description: Description | None = None
    image_url: ImageUrl | None = None
    is_featured: Annotated[bool, Field(strict=True)] | None = None


class ProductOut(OutputModel):
    """Товар у відповіді API v1: категорія — лише номер."""

    id: int
    category_id: int
    name: str
    description: str
    price: int
    image_url: str
    is_featured: bool
    created_at: datetime


class RatingOut(OutputModel):
    average: float | None = Field(description='Середня оцінка, 1–5; порожньо, якщо відгуків немає', examples=[4.5])
    count: int = Field(description='Кількість відгуків', examples=[2])


class ProductOutV2(OutputModel):
    """Товар у відповіді API v2: категорія й рейтинг усередині."""

    id: int
    name: str
    description: str
    price: int
    image_url: str
    is_featured: bool
    created_at: datetime
    category: CategoryOut
    rating: RatingOut

    @staticmethod
    def base_fields(product) -> dict:
        """Поля товару з об'єкта SQLAlchemy (без рейтингу, який рахується окремо)."""
        return {
            'id': product.id, 'name': product.name, 'description': product.description,
            'price': product.price, 'image_url': product.image_url, 'is_featured': product.is_featured,
            'created_at': product.created_at, 'category': product.category,
        }
