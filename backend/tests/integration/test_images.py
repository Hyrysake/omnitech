"""Integration тести картинок товарів (Станіслав): POST і DELETE /api/v1/products/{id}/image."""

import io

from PIL import Image

from app.core.config import settings


def png_bytes():
    buffer = io.BytesIO()
    Image.new('RGB', (2, 2)).save(buffer, format='PNG')
    return buffer.getvalue()


def upload(client, product_id, headers, content, filename='photo.png', content_type='image/png'):
    return client.post(f'/api/v1/products/{product_id}/image', headers=headers,
                       files={'file': (filename, content, content_type)})


def test_upload_png_sets_image_url_and_saves_file(client, admin_headers, product):
    # Act
    response = upload(client, product.id, admin_headers, png_bytes())

    # Assert
    assert response.status_code == 200
    image_url = response.json()['image_url']
    assert image_url.startswith('/media/products/') and image_url.endswith('.png')
    assert (settings.media_dir / 'products' / image_url.rsplit('/', 1)[1]).is_file()


def test_upload_text_file_returns_415(client, admin_headers, product):
    # Content-Type підроблений під картинку: сервер дивиться на вміст, а не на заголовок
    response = upload(client, product.id, admin_headers, 'це текст'.encode(), 'fake.png', 'image/png')

    assert response.status_code == 415


def test_upload_too_big_file_returns_413(client, admin_headers, product, monkeypatch):
    # Arrange: зменшуємо ліміт до 1 МБ, щоб не створювати великий файл
    monkeypatch.setattr(settings, 'max_upload_mb', 1)

    # Act
    response = upload(client, product.id, admin_headers, b'0' * (1024 * 1024 + 1))

    # Assert
    assert response.status_code == 413


def test_upload_for_unknown_product_returns_404(client, admin_headers):
    response = upload(client, 99999, admin_headers, png_bytes())

    assert response.status_code == 404


def test_delete_image_clears_url_and_removes_file(client, admin_headers, product):
    # Arrange
    image_url = upload(client, product.id, admin_headers, png_bytes()).json()['image_url']
    path = settings.media_dir / 'products' / image_url.rsplit('/', 1)[1]

    # Act
    response = client.delete(f'/api/v1/products/{product.id}/image', headers=admin_headers)

    # Assert
    assert response.status_code == 204
    assert client.get(f'/api/v1/products/{product.id}').json()['image_url'] == ''
    assert not path.exists()


def test_client_cannot_upload_image(client, user_headers, product):
    response = upload(client, product.id, user_headers, png_bytes())

    assert response.status_code == 403


def test_client_cannot_delete_image(client, user_headers, product):
    response = client.delete(f'/api/v1/products/{product.id}/image', headers=user_headers)

    assert response.status_code == 403
