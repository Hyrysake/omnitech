"""Integration тести статистики адмін-панелі: GET /api/v1/admin/stats."""

STATUSES = {'new', 'processing', 'shipped', 'completed', 'cancelled'}


def create_order(client, product, quantity=1):
    body = {
        'items': [{'product_id': product.id, 'quantity': quantity}],
        'customer_name': 'Олена Коваль',
        'phone': '+380501234567',
        'email': 'olena@example.com',
        'address': 'м. Луцьк, вул. Лесі Українки, 12',
    }
    return client.post('/api/v1/orders', json=body).json()['id']


def test_stats_on_empty_database_are_zero(client, admin_headers):
    # Act: у базі є лише сам адмін
    response = client.get('/api/v1/admin/stats', headers=admin_headers)

    # Assert
    assert response.status_code == 200
    body = response.json()
    assert body['products'] == 0
    assert body['orders'] == 0
    assert body['revenue'] == 0
    assert body['unread_feedback'] == 0
    assert body['users'] == 1


def test_stats_contain_every_status_key(client, admin_headers):
    body = client.get('/api/v1/admin/stats', headers=admin_headers).json()

    # Навіть статуси без замовлень присутні зі значенням 0
    assert set(body['orders_by_status']) == STATUSES
    assert all(count == 0 for count in body['orders_by_status'].values())


def test_revenue_counts_only_completed_orders(client, product, admin_headers):
    # Arrange: три замовлення на 50000, 25000 і 75000
    done = create_order(client, product, quantity=2)
    create_order(client, product, quantity=1)
    cancelled = create_order(client, product, quantity=3)
    client.patch(f'/api/v1/admin/orders/{done}', json={'status': 'completed'}, headers=admin_headers)
    client.patch(f'/api/v1/admin/orders/{cancelled}', json={'status': 'cancelled'}, headers=admin_headers)

    # Act
    body = client.get('/api/v1/admin/stats', headers=admin_headers).json()

    # Assert: у виручку потрапило лише виконане замовлення
    assert body['revenue'] == 50000
    assert body['orders'] == 3
    assert body['orders_by_status']['new'] == 1
    assert body['orders_by_status']['completed'] == 1
    assert body['orders_by_status']['cancelled'] == 1


def test_stats_count_unread_feedback(client, admin_headers):
    body = {'name': 'Олена Коваль', 'email': 'olena@example.com', 'message': 'Чи є ноутбуки в наявності?'}
    # Arrange: гість надіслав повідомлення
    assert client.post('/api/v1/feedback', json=body).status_code == 201

    # Act
    response = client.get('/api/v1/admin/stats', headers=admin_headers)

    # Assert
    assert response.status_code == 200
    assert response.json()['unread_feedback'] == 1


def test_client_cannot_see_stats(client, user_headers):
    response = client.get('/api/v1/admin/stats', headers=user_headers)

    assert response.status_code == 403


def test_stats_without_token_returns_401(client):
    response = client.get('/api/v1/admin/stats')

    assert response.status_code == 401
