"""Збереження завантажених картинок товарів у папку media/products.

Правила безпеки:
- тип файлу визначаємо за його ВМІСТОМ (Pillow відкриває картинку), а не за назвою чи заголовком
  Content-Type, які клієнт може підробити;
- розмір обмежено (налаштування MAX_UPLOAD_MB);
- ім'я файлу генеруємо самі (uuid4), тож шлях на зразок ../../app/main.py підсунути неможливо.
"""

import uuid
from io import BytesIO
from pathlib import Path
from typing import BinaryIO

from PIL import Image, UnidentifiedImageError

from app.core.config import settings
from app.core.errors import AppError

PRODUCTS_SUBDIR = 'products'
# Формат, який повідомляє Pillow -> розширення файлу
ALLOWED_FORMATS = {'JPEG': 'jpg', 'PNG': 'png', 'WEBP': 'webp'}
CHUNK_SIZE = 1024 * 1024    # читаємо файл шматками по 1 МБ


class FileTooLargeError(AppError):
    status_code = 413


class UnsupportedFileError(AppError):
    status_code = 415


def _products_dir() -> Path:
    path = settings.media_dir / PRODUCTS_SUBDIR
    path.mkdir(parents=True, exist_ok=True)
    return path


def _read_limited(stream: BinaryIO) -> bytes:
    """Читає файл, але не більше дозволеного розміру: зайвий шматок одразу дає 413."""
    limit = settings.max_upload_mb * 1024 * 1024
    data = bytearray()
    while chunk := stream.read(CHUNK_SIZE):
        data.extend(chunk)
        if len(data) > limit:
            raise FileTooLargeError(f'Файл завеликий: не більше {settings.max_upload_mb} МБ.')
    if not data:
        raise UnsupportedFileError('Файл порожній.')
    return bytes(data)


def _detect_format(data: bytes) -> str:
    """Повертає розширення (jpg/png/webp), якщо це справжня картинка дозволеного формату."""
    try:
        with Image.open(BytesIO(data)) as image:
            image_format = image.format
            image.verify()      # перевіряє цілісність файлу, не розпаковуючи всю картинку
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError):
        raise UnsupportedFileError('Це не картинка або файл пошкоджено. Дозволено JPEG, PNG, WebP.')
    if image_format not in ALLOWED_FORMATS:
        raise UnsupportedFileError('Дозволено лише картинки JPEG, PNG або WebP.')
    return ALLOWED_FORMATS[image_format]


def save_product_image(stream: BinaryIO) -> str:
    """Перевіряє й зберігає картинку. Повертає адресу для поля image_url: /media/products/<uuid>.<ext>."""
    data = _read_limited(stream)
    extension = _detect_format(data)
    filename = f'{uuid.uuid4().hex}.{extension}'
    (_products_dir() / filename).write_bytes(data)
    return f'/media/{PRODUCTS_SUBDIR}/{filename}'


def delete_local_file(image_url: str) -> None:
    """Видаляє файл, якщо адреса веде в нашу папку media/products. Зовнішні адреси не чіпає.

    resolve() + is_relative_to() — захист від виходу за межі папки: навіть якщо в базі
    опиниться /media/products/../../app/main.py, файл поза media/products не видалиться.
    """
    prefix = f'/media/{PRODUCTS_SUBDIR}/'
    if not image_url or not image_url.startswith(prefix):
        return
    folder = _products_dir().resolve()
    path = (folder / image_url.removeprefix(prefix)).resolve()
    if path.is_relative_to(folder) and path.is_file():
        path.unlink()
