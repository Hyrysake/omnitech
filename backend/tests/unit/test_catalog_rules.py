"""Unit тести правил каталогу (Станіслав): валідатор адреси картинки, тип Price і побудова запиту.

Тут немає бази й HTTP: функції викликаються напряму, тому тести швидкі й точно показують,
яке саме правило зламалось.
"""

import pytest
from pydantic import TypeAdapter, ValidationError

from app.core.errors import BadRequestError
from app.schemas.catalog import Price, check_image_url
from app.services.catalog import ProductFilters, build_product_query

HEX32 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'


# ---------- Адреса картинки ----------

@pytest.mark.parametrize('url', [
    '',                                          # порожньо = «без картинки»
    'http://example.com/photo.jpg',
    'https://example.com/photo.jpg',
    f'/media/products/{HEX32}.png',              # наш власний завантажений файл
    f'/media/products/{HEX32}.jpg',
    f'/media/products/{HEX32}.webp',
])
def test_image_url_accepts_valid_values(url):
    assert check_image_url(url) == url


@pytest.mark.parametrize('url', [
    f'/media/products/{HEX32[:31]}.png',         # 31 символ замість 32
    f'/media/products/{HEX32.upper()}.png',      # великі літери: ми генеруємо лише малі
    f'/media/products/{HEX32}.gif',              # розширення не з дозволеного списку
    '/media/products/../../app/main.py',         # вихід за межі папки
    'ftp://example.com/photo.jpg',               # не http(s)
    'photo.jpg',                                 # просто ім'я файлу
])
def test_image_url_rejects_invalid_values(url):
    with pytest.raises(ValueError):
        check_image_url(url)


# ---------- Ціна ----------

price_adapter = TypeAdapter(Price)


@pytest.mark.parametrize('value', [1, 15999, 10_000_000])
def test_price_accepts_values_inside_limits(value):
    assert price_adapter.validate_python(value) == value


@pytest.mark.parametrize('value', [
    0,                  # межа gt=0: нуль не можна
    -5,
    10_000_001,         # на одиницю більше за максимум
    '15999',            # рядок: strict не перетворює мовчки
    12.5,               # дріб
    True,               # у Python True == 1, але для API це не число
])
def test_price_rejects_values_outside_limits_or_wrong_type(value):
    with pytest.raises(ValidationError):
        price_adapter.validate_python(value)


# ---------- Побудова запиту ----------

def test_build_query_raises_when_min_price_greater_than_max_price():
    filters = ProductFilters(min_price=500, max_price=100)

    with pytest.raises(BadRequestError):
        build_product_query(filters)


@pytest.mark.parametrize('min_price, max_price', [
    (100, 100),         # межа: рівні значення — це нормальний фільтр «рівно 100»
    (100, 200),
    (None, 100),        # одне з обмежень не задане
    (100, None),
    (None, None),
])
def test_build_query_allows_valid_price_range(min_price, max_price):
    filters = ProductFilters(min_price=min_price, max_price=max_price)

    statement = build_product_query(filters)

    assert statement is not None
