"""Integration тести версії API v2 (Станіслав): категорія й рейтинг усередині товару, v1 не змінилась."""


def test_v2_product_nests_category_and_rating(client, category, product):
    response = client.get(f'/api/v2/products/{product.id}')

    body = response.json()
    assert response.status_code == 200
    assert body['category'] == {'id': category.id, 'name': category.name}
    assert body['rating'] == {'average': None, 'count': 0}      # відгуків ще немає
    assert 'category_id' not in body


def test_v2_list_has_category_object_for_each_item(client, category, product):
    response = client.get('/api/v2/products')

    item = response.json()['items'][0]
    assert item['category']['id'] == category.id
    assert 'rating' in item


def test_v1_product_still_has_category_id_and_no_rating(client, category, product):
    # v1 не можна ламати: старі клієнти розраховують на category_id
    response = client.get(f'/api/v1/products/{product.id}')

    body = response.json()
    assert body['category_id'] == category.id
    assert 'category' not in body
    assert 'rating' not in body


def test_v2_unknown_product_returns_404(client):
    assert client.get('/api/v2/products/99999').status_code == 404
