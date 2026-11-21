"""Integration тести товарів (Станіслав): /api/v1/products.

Каталог: сторінки, пошук, фільтри, сортування. Зміни товарів доступні лише адміністратору.
"""

import pytest

URL = '/api/v1/products'


def new_product_body(category_id, **changes):
    body = {'category_id': category_id, 'name': 'Смартфон Test X', 'price': 12000}
    body.update(changes)
    return body


# ---------- Список і сторінки ----------

def test_list_products_returns_page_envelope(client, make_product):
    # Arrange
    for number in range(3):
        make_product(name=f'Ноутбук №{number}')

    # Act
    response = client.get(URL, params={'size': 2})

    # Assert
    body = response.json()
    assert response.status_code == 200
    assert (body['total'], body['page'], body['size'], body['pages']) == (3, 1, 2, 2)
    assert len(body['items']) == 2


def test_list_products_size_over_max_returns_422(client):
    response = client.get(URL, params={'size': 51})     # максимум 50

    assert response.status_code == 422


def test_list_products_page_past_the_end_returns_empty_items(client, make_product):
    make_product()

    response = client.get(URL, params={'page': 5})

    body = response.json()
    assert response.status_code == 200
    assert body['items'] == []
    assert body['total'] == 1       # total не залежить від номера сторінки


# ---------- Пошук ----------

def test_search_is_case_insensitive_for_cyrillic(client, make_product):
    # Arrange: SQLite без налаштувань не вміє lower() для кирилиці, тому це варто перевірити
    make_product(name='Ноутбук Alpha')
    make_product(name='Смартфон Beta')

    # Act
    response = client.get(URL, params={'q': 'НОУТБУК'})

    # Assert
    names = [item['name'] for item in response.json()['items']]
    assert names == ['Ноутбук Alpha']


def test_search_percent_sign_is_literal(client, make_product):
    # Arrange
    make_product(name='Ноутбук Alpha')
    make_product(name='Знижка 50% на кабель')

    # Act: якби % працював як шаблон LIKE, знайшлися б усі товари
    response = client.get(URL, params={'q': '%'})

    # Assert
    names = [item['name'] for item in response.json()['items']]
    assert names == ['Знижка 50% на кабель']


# ---------- Фільтри й сортування ----------

def test_filter_by_category(client, make_category, make_product):
    # Arrange
    phones = make_category('Смартфони')
    make_product(name='Ноутбук Alpha')
    make_product(name='Смартфон Beta', category_id=phones.id)

    # Act
    response = client.get(URL, params={'category_id': phones.id})

    # Assert
    assert [item['name'] for item in response.json()['items']] == ['Смартфон Beta']


def test_filter_by_price_range_includes_both_borders(client, make_product):
    # Arrange
    for price in (900, 1000, 2000, 2100):
        make_product(name=f'Товар за {price}', price=price)

    # Act
    response = client.get(URL, params={'min_price': 1000, 'max_price': 2000, 'sort': 'price_asc'})

    # Assert: межі 1000 і 2000 входять
    assert [item['price'] for item in response.json()['items']] == [1000, 2000]


def test_filter_min_price_greater_than_max_returns_400(client):
    response = client.get(URL, params={'min_price': 500, 'max_price': 100})

    assert response.status_code == 400


@pytest.mark.parametrize('sort, expected_prices', [
    ('price_asc', [100, 200, 300]),
    ('price_desc', [300, 200, 100]),
])
def test_sort_by_price(client, make_product, sort, expected_prices):
    for price in (200, 300, 100):
        make_product(name=f'Товар за {price}', price=price)

    response = client.get(URL, params={'sort': sort})

    assert [item['price'] for item in response.json()['items']] == expected_prices


def test_sort_unknown_value_returns_422(client):
    response = client.get(URL, params={'sort': 'random'})

    assert response.status_code == 422


# ---------- Один товар ----------

def test_get_product_by_id(client, product):
    response = client.get(f'{URL}/{product.id}')

    assert response.status_code == 200
    assert response.json()['name'] == product.name


def test_get_unknown_product_returns_404(client):
    response = client.get(f'{URL}/99999')

    assert response.status_code == 404


# ---------- Зміни (адміністратор) ----------

def test_admin_creates_product_with_location_header(client, admin_headers, category):
    # Act
    response = client.post(URL, json=new_product_body(category.id), headers=admin_headers)

    # Assert: 201 і заголовок Location з адресою нового товару
    assert response.status_code == 201
    product_id = response.json()['id']
    assert response.headers['Location'].endswith(f'{URL}/{product_id}')


def test_client_cannot_create_product(client, user_headers, category):
    response = client.post(URL, json=new_product_body(category.id), headers=user_headers)

    assert response.status_code == 403


def test_create_product_with_unknown_category_returns_422(client, admin_headers):
    response = client.post(URL, json=new_product_body(99999), headers=admin_headers)

    assert response.status_code == 422


def test_patch_changes_only_given_fields(client, admin_headers, product):
    # Act
    response = client.patch(f'{URL}/{product.id}', json={'price': 777}, headers=admin_headers)

    # Assert: ціна змінилась, назва залишилась
    body = response.json()
    assert response.status_code == 200
    assert body['price'] == 777
    assert body['name'] == product.name


def test_patch_with_unknown_field_returns_422(client, admin_headers, product):
    response = client.patch(f'{URL}/{product.id}', json={'colour': 'red'}, headers=admin_headers)

    assert response.status_code == 422      # зайві поля заборонені схемою


def test_admin_deletes_product(client, admin_headers, product):
    response = client.delete(f'{URL}/{product.id}', headers=admin_headers)

    assert response.status_code == 204
    assert client.get(f'{URL}/{product.id}').status_code == 404


def test_delete_product_that_is_in_order_returns_409(client, admin_headers, product):
    # Arrange: замовлення, у якому є цей товар
    order = {
        'customer_name': 'Олена Коваль', 'phone': '+380501234567', 'email': 'olena@example.com',
        'address': 'м. Луцьк, вул. Лесі Українки, 12',
        'items': [{'product_id': product.id, 'quantity': 1}],
    }
    assert client.post('/api/v1/orders', json=order).status_code == 201

    # Act
    response = client.delete(f'{URL}/{product.id}', headers=admin_headers)

    # Assert: історію замовлень база не дасть зіпсувати
    assert response.status_code == 409
