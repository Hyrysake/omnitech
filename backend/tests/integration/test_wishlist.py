"""Integration тести списку бажань (Станіслав): /api/v1/users/me/wishlist."""

URL = '/api/v1/users/me/wishlist'


def test_put_is_idempotent(client, user_headers, product):
    # Act: додаємо той самий товар двічі
    first = client.put(f'{URL}/{product.id}', headers=user_headers)
    second = client.put(f'{URL}/{product.id}', headers=user_headers)

    # Assert: обидва рази 204, а в списку товар один
    assert first.status_code == 204
    assert second.status_code == 204
    assert len(client.get(URL, headers=user_headers).json()) == 1


def test_get_lists_added_product(client, user_headers, product):
    client.put(f'{URL}/{product.id}', headers=user_headers)

    response = client.get(URL, headers=user_headers)

    assert response.status_code == 200
    assert [item['id'] for item in response.json()] == [product.id]


def test_delete_removes_product_from_wishlist(client, user_headers, product):
    # Arrange
    client.put(f'{URL}/{product.id}', headers=user_headers)

    # Act
    response = client.delete(f'{URL}/{product.id}', headers=user_headers)

    # Assert
    assert response.status_code == 204
    assert client.get(URL, headers=user_headers).json() == []


def test_delete_product_not_in_wishlist_still_returns_204(client, user_headers, product):
    response = client.delete(f'{URL}/{product.id}', headers=user_headers)

    assert response.status_code == 204      # бажаного стану досягнуто


def test_wishlist_as_guest_returns_401(client):
    assert client.get(URL).status_code == 401


def test_put_unknown_product_returns_404(client, user_headers):
    response = client.put(f'{URL}/99999', headers=user_headers)

    assert response.status_code == 404
