"""Unit тести збереження картинок (Станіслав): визначення формату, читання з обмеженням, безпечне видалення.

Файли тут — маленькі картинки 1×1, зроблені в пам'яті через Pillow, тож нічого не лежить у репозиторії.
"""

import io

import pytest
from PIL import Image

from app.core.config import settings
from app.services import media


def make_image_bytes(image_format):
    buffer = io.BytesIO()
    Image.new('RGB', (1, 1)).save(buffer, format=image_format)
    return buffer.getvalue()


# ---------- Формат за вмістом ----------

@pytest.mark.parametrize('image_format, extension', [
    ('PNG', 'png'),
    ('JPEG', 'jpg'),
    ('WEBP', 'webp'),
])
def test_detect_format_recognizes_allowed_images(image_format, extension):
    data = make_image_bytes(image_format)

    assert media._detect_format(data) == extension


def test_detect_format_rejects_gif():
    # GIF — справжня картинка, але не з дозволеного списку
    data = make_image_bytes('GIF')

    with pytest.raises(media.UnsupportedFileError):
        media._detect_format(data)


def test_detect_format_rejects_plain_text():
    with pytest.raises(media.UnsupportedFileError):
        media._detect_format('просто текст, не картинка'.encode())


# ---------- Читання з обмеженням ----------

def test_read_limited_returns_file_content():
    data = make_image_bytes('PNG')

    assert media._read_limited(io.BytesIO(data)) == data


def test_read_limited_empty_file_raises_unsupported():
    with pytest.raises(media.UnsupportedFileError) as error:
        media._read_limited(io.BytesIO(b''))

    assert error.value.status_code == 415


def test_read_limited_file_over_limit_raises_too_large(monkeypatch):
    monkeypatch.setattr(settings, 'max_upload_mb', 1)
    too_big = io.BytesIO(b'0' * (1024 * 1024 + 1))      # на 1 байт більше за ліміт

    with pytest.raises(media.FileTooLargeError) as error:
        media._read_limited(too_big)

    assert error.value.status_code == 413


def test_read_limited_file_exactly_at_limit_is_allowed(monkeypatch):
    monkeypatch.setattr(settings, 'max_upload_mb', 1)
    exactly_limit = io.BytesIO(b'0' * (1024 * 1024))    # межа: рівно 1 МБ ще можна

    assert len(media._read_limited(exactly_limit)) == 1024 * 1024


# ---------- Видалення файлу ----------

def test_delete_local_file_removes_own_file():
    # Arrange
    url = media.save_product_image(io.BytesIO(make_image_bytes('PNG')))
    path = settings.media_dir / media.PRODUCTS_SUBDIR / url.rsplit('/', 1)[1]
    assert path.is_file()

    # Act
    media.delete_local_file(url)

    # Assert
    assert not path.exists()


def test_delete_local_file_refuses_path_traversal():
    # Arrange: файл ПОЗА папкою products, але в межах media
    outside = settings.media_dir / 'secret.txt'
    outside.parent.mkdir(parents=True, exist_ok=True)
    outside.write_text('не видаляти')

    # Act: адреса веде нагору через ../
    media.delete_local_file('/media/products/../secret.txt')

    # Assert
    assert outside.exists()


@pytest.mark.parametrize('url', ['', 'https://example.com/a.png', '/other/a.png'])
def test_delete_local_file_ignores_foreign_urls(url):
    # Arrange: у папці картинок лежить файл з такою самою назвою
    own = settings.media_dir / media.PRODUCTS_SUBDIR / 'a.png'
    own.parent.mkdir(parents=True, exist_ok=True)
    own.write_bytes(b'png')

    # Act: адреса не наша (/media/products/...), тож функція не має нічого видаляти й не має падати
    media.delete_local_file(url)

    # Assert
    assert own.exists()
