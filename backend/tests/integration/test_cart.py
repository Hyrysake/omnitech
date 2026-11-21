"""Integration тести кошика: POST /api/v1/cart/preview.

Сервер сам рахує кошик за цінами з бази, тож перевіряємо ціни, суму, неіснуючі товари й дублікати.
"""


def test_preview_uses_price_from_database(client, product):
    # Act
    response = client.post('/api/v1/cart/preview', json={'items': [{'product_id': product.id, 'quantity': 2}]})

    # Assert
    assert response.status_code == 200
    line = response.json()['lines'][0]
    assert line['product']['price'] == 25000
    assert line['quantity'] == 2
    assert line['line_total'] == 50000


def test_preview_rejects_price_sent_by_client(client, product):
    # Клієнт не може підставити свою ціну: extra='forbid' дає 422
    item = {'product_id': product.id, 'quantity': 1, 'price': 1}

    response = client.post('/api/v1/cart/preview', json={'items': [item]})

    assert response.status_code == 422


def test_preview_total_is_sum_of_lines(client, make_product):
    # Arrange
    cheap = make_product(name='Мишка', price=500)
    dear = make_product(name='Монітор', price=8000)
    items = [{'product_id': cheap.id, 'quantity': 3}, {'product_id': dear.id, 'quantity': 2}]

    # Act
    response = client.post('/api/v1/cart/preview', json={'items': items})

    # Assert
    body = response.json()
    assert body['total'] == 500 * 3 + 8000 * 2
    assert body['count'] == 5
    assert body['missing'] == []


def test_preview_lists_missing_products(client, product):
    # Arrange: один товар існує, другого немає в каталозі
    items = [{'product_id': product.id, 'quantity': 1}, {'product_id': 9999, 'quantity': 1}]

    # Act
    response = client.post('/api/v1/cart/preview', json={'items': items})

    # Assert: це не помилка, а список missing; сума рахується лише за існуючим
    assert response.status_code == 200
    body = response.json()
    assert body['missing'] == [9999]
    assert len(body['lines']) == 1
    assert body['total'] == 25000


def test_preview_rejects_empty_items(client):
    response = client.post('/api/v1/cart/preview', json={'items': []})

    assert response.status_code == 422


def test_preview_rejects_quantity_over_limit(client, product):
    response = client.post('/api/v1/cart/preview', json={'items': [{'product_id': product.id, 'quantity': 100}]})

    assert response.status_code == 422


def test_preview_merges_duplicate_ids(client, product):
    # Arrange
    items = [{'product_id': product.id, 'quantity': 2}, {'product_id': product.id, 'quantity': 3}]

    # Act
    response = client.post('/api/v1/cart/preview', json={'items': items})

    # Assert: один рядок із сумарною кількістю
    body = response.json()
    assert len(body['lines']) == 1
    assert body['lines'][0]['quantity'] == 5
    assert body['total'] == 25000 * 5


def test_preview_rejects_duplicates_over_max_quantity(client, product):
    # Кожен рядок у межах 99, але разом більше: це перевіряє сервіс, і поле в помилці 'items'
    items = [{'product_id': product.id, 'quantity': 60}, {'product_id': product.id, 'quantity': 60}]

    response = client.post('/api/v1/cart/preview', json={'items': items})

    assert response.status_code == 422
    assert response.json()['errors'][0]['field'] == 'items'
