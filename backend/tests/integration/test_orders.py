"""Integration тести оформлення замовлень: POST /api/v1/orders та історія /api/v1/users/me/orders."""

from tests.conftest import auth_headers


def order_body(product, quantity=1, **changes):
    """Правильне тіло замовлення; тест змінює лише потрібне поле."""
    body = {
        'items': [{'product_id': product.id, 'quantity': quantity}],
        'customer_name': 'Олена Коваль',
        'phone': '+380501234567',
        'email': 'olena@example.com',
        'address': 'м. Луцьк, вул. Лесі Українки, 12',
    }
    body.update(changes)
    return body


def test_guest_can_create_order(client, product):
    # Act: без заголовка Authorization
    response = client.post('/api/v1/orders', json=order_body(product, quantity=2))

    # Assert
    assert response.status_code == 201
    body = response.json()
    assert body['user_id'] is None
    assert body['status'] == 'new'
    assert body['total'] == 50000
    assert body['items'][0]['price'] == 25000


def test_logged_in_order_appears_in_my_orders(client, product, user, user_headers):
    # Arrange
    created = client.post('/api/v1/orders', json=order_body(product), headers=user_headers)

    # Act
    response = client.get('/api/v1/users/me/orders', headers=user_headers)

    # Assert
    assert created.json()['user_id'] == user.id
    assert response.status_code == 200
    assert [order['id'] for order in response.json()['items']] == [created.json()['id']]


def test_guest_order_not_in_my_orders(client, product, user_headers):
    client.post('/api/v1/orders', json=order_body(product))

    response = client.get('/api/v1/users/me/orders', headers=user_headers)

    assert response.json()['total'] == 0


def test_my_orders_requires_login(client):
    response = client.get('/api/v1/users/me/orders')

    assert response.status_code == 401


def test_order_with_unknown_product_returns_404(client, product):
    body = order_body(product)
    body['items'][0]['product_id'] = 9999

    response = client.post('/api/v1/orders', json=body)

    assert response.status_code == 404


def test_order_with_invalid_phone_returns_422(client, product):
    response = client.post('/api/v1/orders', json=order_body(product, phone='12345'))

    assert response.status_code == 422


def test_order_with_price_field_returns_422(client, product):
    response = client.post('/api/v1/orders', json=order_body(product, price=1))

    assert response.status_code == 422


def test_other_users_order_returns_404(client, product, make_user, user_headers):
    # Arrange: замовлення належить іншому користувачеві
    other = make_user(email='other@test.example', name='Інший Клієнт')
    created = client.post('/api/v1/orders', json=order_body(product), headers=auth_headers(other))
    order_id = created.json()['id']

    # Act
    response = client.get(f'/api/v1/users/me/orders/{order_id}', headers=user_headers)

    # Assert: 404, а не 403, щоб не підказувати, що такий номер існує
    assert response.status_code == 404


def test_own_order_is_returned_by_id(client, product, user_headers):
    created = client.post('/api/v1/orders', json=order_body(product), headers=user_headers)

    response = client.get(f"/api/v1/users/me/orders/{created.json()['id']}", headers=user_headers)

    assert response.status_code == 200
    assert response.json()['id'] == created.json()['id']


def test_order_keeps_price_after_product_price_changes(client, db, product, user_headers):
    # Arrange: замовляємо за 25000
    created = client.post('/api/v1/orders', json=order_body(product), headers=user_headers)
    order_id = created.json()['id']

    # Act: магазин підняв ціну
    product.price = 30000
    db.commit()
    response = client.get(f'/api/v1/users/me/orders/{order_id}', headers=user_headers)

    # Assert: у замовленні лишилась стара ціна
    body = response.json()
    assert body['items'][0]['price'] == 25000
    assert body['total'] == 25000
