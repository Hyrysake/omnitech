"""Integration тести замовлень в адмін-панелі: /api/v1/admin/orders (список, статус, видалення)."""


def create_order(client, product):
    """Гостьове замовлення; повертає його номер."""
    body = {
        'items': [{'product_id': product.id, 'quantity': 1}],
        'customer_name': 'Олена Коваль',
        'phone': '+380501234567',
        'email': 'olena@example.com',
        'address': 'м. Луцьк, вул. Лесі Українки, 12',
    }
    return client.post('/api/v1/orders', json=body).json()['id']


def test_admin_lists_all_orders(client, product, admin_headers):
    create_order(client, product)
    create_order(client, product)

    response = client.get('/api/v1/admin/orders', headers=admin_headers)

    assert response.status_code == 200
    assert response.json()['total'] == 2


def test_admin_filters_orders_by_status(client, product, admin_headers):
    # Arrange: два замовлення, одне переводимо в shipped
    first = create_order(client, product)
    create_order(client, product)
    client.patch(f'/api/v1/admin/orders/{first}', json={'status': 'shipped'}, headers=admin_headers)

    # Act
    response = client.get('/api/v1/admin/orders?status=shipped', headers=admin_headers)

    # Assert
    items = response.json()['items']
    assert [order['id'] for order in items] == [first]


def test_admin_filter_with_unknown_status_returns_422(client, admin_headers):
    response = client.get('/api/v1/admin/orders?status=lost', headers=admin_headers)

    assert response.status_code == 422


def test_admin_changes_order_status(client, product, admin_headers):
    order_id = create_order(client, product)

    response = client.patch(f'/api/v1/admin/orders/{order_id}', json={'status': 'processing'}, headers=admin_headers)

    assert response.status_code == 200
    assert response.json()['status'] == 'processing'


def test_admin_bad_status_returns_422(client, product, admin_headers):
    order_id = create_order(client, product)

    response = client.patch(f'/api/v1/admin/orders/{order_id}', json={'status': 'lost'}, headers=admin_headers)

    assert response.status_code == 422


def test_client_cannot_list_admin_orders(client, user_headers):
    response = client.get('/api/v1/admin/orders', headers=user_headers)

    assert response.status_code == 403


def test_client_cannot_change_status(client, product, user_headers):
    order_id = create_order(client, product)

    response = client.patch(f'/api/v1/admin/orders/{order_id}', json={'status': 'completed'}, headers=user_headers)

    assert response.status_code == 403


def test_admin_orders_without_token_returns_401(client):
    response = client.get('/api/v1/admin/orders')

    assert response.status_code == 401


def test_admin_deletes_order(client, product, admin_headers):
    # Arrange
    order_id = create_order(client, product)

    # Act
    response = client.delete(f'/api/v1/admin/orders/{order_id}', headers=admin_headers)

    # Assert: після видалення замовлення вже не знайти
    assert response.status_code == 204
    assert client.get(f'/api/v1/admin/orders/{order_id}', headers=admin_headers).status_code == 404


def test_admin_delete_unknown_order_returns_404(client, admin_headers):
    response = client.delete('/api/v1/admin/orders/9999', headers=admin_headers)

    assert response.status_code == 404


def test_admin_update_unknown_order_returns_404(client, admin_headers):
    response = client.patch('/api/v1/admin/orders/9999', json={'status': 'shipped'}, headers=admin_headers)

    assert response.status_code == 404
