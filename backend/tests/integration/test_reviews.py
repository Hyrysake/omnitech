"""Integration тести відгуків (Станіслав): /api/v1/products/{id}/reviews та /api/v1/reviews/{id}."""

import pytest

from app.core.security import create_access_token

REVIEW = {'rating': 5, 'text': 'Чудовий товар, рекомендую.'}


def reviews_url(product):
    return f'/api/v1/products/{product.id}/reviews'


def headers_of(user):
    return {'Authorization': f'Bearer {create_access_token(user.id)}'}


def test_create_review_returns_201(client, user, user_headers, product):
    response = client.post(reviews_url(product), json=REVIEW, headers=user_headers)

    body = response.json()
    assert response.status_code == 201
    assert body['rating'] == 5
    assert body['user_id'] == user.id
    assert body['author_name'] == user.name      # ім'я береться з профілю, а не з запиту


def test_second_review_by_same_user_returns_409(client, user_headers, product):
    # Arrange
    client.post(reviews_url(product), json=REVIEW, headers=user_headers)

    # Act
    response = client.post(reviews_url(product), json=REVIEW, headers=user_headers)

    # Assert
    assert response.status_code == 409


@pytest.mark.parametrize('rating', [0, 6])      # межі: допустимо лише 1–5
def test_create_review_with_rating_out_of_range_returns_422(client, user_headers, product, rating):
    response = client.post(reviews_url(product), json={**REVIEW, 'rating': rating}, headers=user_headers)

    assert response.status_code == 422


def test_create_review_by_guest_returns_401(client, product):
    response = client.post(reviews_url(product), json=REVIEW)

    assert response.status_code == 401


def test_list_reviews_returns_created_review(client, user_headers, product):
    client.post(reviews_url(product), json=REVIEW, headers=user_headers)

    response = client.get(reviews_url(product))

    body = response.json()
    assert response.status_code == 200
    assert body['total'] == 1
    assert body['items'][0]['text'] == REVIEW['text']


def test_user_edits_own_review(client, user_headers, product):
    # Arrange
    review_id = client.post(reviews_url(product), json=REVIEW, headers=user_headers).json()['id']

    # Act
    response = client.patch(f'/api/v1/reviews/{review_id}', json={'rating': 3}, headers=user_headers)

    # Assert
    assert response.status_code == 200
    assert response.json()['rating'] == 3


def test_another_user_cannot_edit_review(client, make_user, user_headers, product):
    # Arrange
    review_id = client.post(reviews_url(product), json=REVIEW, headers=user_headers).json()['id']
    stranger = make_user(email='other@test.example', name='Інший Клієнт')

    # Act
    response = client.patch(f'/api/v1/reviews/{review_id}', json={'rating': 1}, headers=headers_of(stranger))

    # Assert
    assert response.status_code == 403


def test_admin_deletes_any_review(client, user_headers, admin_headers, product):
    # Arrange
    review_id = client.post(reviews_url(product), json=REVIEW, headers=user_headers).json()['id']

    # Act
    response = client.delete(f'/api/v1/reviews/{review_id}', headers=admin_headers)

    # Assert
    assert response.status_code == 204
    assert client.get(reviews_url(product)).json()['total'] == 0


def test_product_rating_is_average_of_reviews(client, make_user, user_headers, product):
    # Arrange: дві оцінки, 5 і 2
    second = make_user(email='second@test.example', name='Другий Клієнт')
    client.post(reviews_url(product), json=REVIEW, headers=user_headers)
    client.post(reviews_url(product), json={'rating': 2, 'text': 'Не сподобалось.'}, headers=headers_of(second))

    # Act
    response = client.get(f'/api/v2/products/{product.id}')

    # Assert: (5 + 2) / 2 = 3.5
    assert response.json()['rating'] == {'average': 3.5, 'count': 2}
