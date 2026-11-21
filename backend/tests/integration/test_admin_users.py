"""Integration-тести списку користувачів для адміністратора: GET /api/v1/admin/users."""

import pytest

URL = '/api/v1/admin/users'


def test_guest_gets_401(client):
    assert client.get(URL).status_code == 401


def test_client_gets_403(client, user_headers):
    assert client.get(URL, headers=user_headers).status_code == 403


def test_admin_gets_paginated_list(client, admin, user, admin_headers):
    # Act
    response = client.get(URL, headers=admin_headers)
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data['total'] == 2
    assert len(data['items']) == 2
    assert (data['page'], data['size'], data['pages']) == (1, 12, 1)


def test_list_does_not_expose_password_hash(client, admin, admin_headers):
    response = client.get(URL, headers=admin_headers)
    assert 'password_hash' not in response.json()['items'][0]


def test_second_page_has_remaining_users(client, make_user, admin, admin_headers):
    # Arrange: 1 адмін + 2 клієнти = 3 записи, по 2 на сторінці
    make_user(email='a@test.example')
    make_user(email='b@test.example')
    # Act
    response = client.get(URL, params={'page': 2, 'size': 2}, headers=admin_headers)
    # Assert
    data = response.json()
    assert data['pages'] == 2
    assert len(data['items']) == 1


@pytest.mark.parametrize('query', ['клієнт', 'КЛІЄНТ', 'Клієнт'])
def test_search_cyrillic_is_case_insensitive(client, user, admin, admin_headers, query):
    response = client.get(URL, params={'q': query}, headers=admin_headers)
    emails = [item['email'] for item in response.json()['items']]
    assert emails == [user.email]


def test_search_by_email_part(client, user, admin, admin_headers):
    response = client.get(URL, params={'q': 'ADMIN@'}, headers=admin_headers)
    assert [item['email'] for item in response.json()['items']] == [admin.email]


def test_search_without_match_returns_empty_page(client, admin_headers, admin):
    data = client.get(URL, params={'q': 'нема-такого'}, headers=admin_headers).json()
    assert data['items'] == []
    assert data['total'] == 0
    assert data['pages'] == 0


@pytest.mark.parametrize(('params'), [
    {'size': 0},      # менше мінімуму (1)
    {'size': 51},     # більше максимуму (50)
    {'page': 0},      # сторінки нумеруються з 1
])
def test_invalid_page_params_return_422(client, admin_headers, params):
    assert client.get(URL, params=params, headers=admin_headers).status_code == 422


def test_size_50_is_allowed(client, admin, admin_headers):
    # Верхня межа ще допустима
    response = client.get(URL, params={'size': 50}, headers=admin_headers)
    assert response.status_code == 200
    assert response.json()['size'] == 50
