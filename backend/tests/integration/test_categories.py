"""Integration тести категорій (Станіслав): /api/v1/categories.

Читати можна всім, змінювати — лише адміністратору. Перевіряємо коди відповідей і стан бази.
"""

URL = '/api/v1/categories'


def test_list_categories_shows_product_count(client, category, make_product):
    # Arrange
    make_product(name='Ноутбук One')
    make_product(name='Ноутбук Two')

    # Act
    response = client.get(URL)

    # Assert
    assert response.status_code == 200
    assert response.json() == [{'id': category.id, 'name': 'Ноутбуки', 'product_count': 2}]


def test_list_categories_empty_category_has_zero_count(client, category):
    response = client.get(URL)

    assert response.json()[0]['product_count'] == 0     # LEFT JOIN не губить порожні категорії


def test_admin_creates_category(client, admin_headers):
    response = client.post(URL, json={'name': 'Смартфони'}, headers=admin_headers)

    assert response.status_code == 201
    assert response.json()['name'] == 'Смартфони'


def test_create_duplicate_category_returns_409(client, admin_headers, category):
    # Назви порівнюються без урахування регістру
    response = client.post(URL, json={'name': 'НОУТБУКИ'}, headers=admin_headers)

    assert response.status_code == 409


def test_create_category_by_client_returns_403(client, user_headers):
    response = client.post(URL, json={'name': 'Смартфони'}, headers=user_headers)

    assert response.status_code == 403


def test_create_category_by_guest_returns_401(client):
    response = client.post(URL, json={'name': 'Смартфони'})

    assert response.status_code == 401


def test_admin_renames_category(client, admin_headers, category):
    response = client.patch(f'{URL}/{category.id}', json={'name': 'Лептопи'}, headers=admin_headers)

    assert response.status_code == 200
    assert response.json()['name'] == 'Лептопи'


def test_admin_deletes_empty_category(client, admin_headers, category):
    # Act
    response = client.delete(f'{URL}/{category.id}', headers=admin_headers)

    # Assert: 204 і категорії більше немає у списку
    assert response.status_code == 204
    assert client.get(URL).json() == []


def test_delete_category_with_products_returns_409(client, admin_headers, category, product):
    response = client.delete(f'{URL}/{category.id}', headers=admin_headers)

    assert response.status_code == 409


def test_delete_unknown_category_returns_404(client, admin_headers):
    response = client.delete(f'{URL}/99999', headers=admin_headers)

    assert response.status_code == 404
