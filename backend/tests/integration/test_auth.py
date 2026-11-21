"""Integration-тести реєстрації та входу: /api/v1/auth/register і /api/v1/auth/token.

Тут працює весь ланцюжок: запит -> валідація -> сервіс -> база -> відповідь.
Вхід іде формою (data=...), а не JSON, бо так вимагає стандарт OAuth2.
"""

import pytest

REGISTER = '/api/v1/auth/register'
LOGIN = '/api/v1/auth/token'


def register_body(**changes):
    body = {'name': 'Олена Коваль', 'email': 'olena@example.com',
            'password': 'secret123', 'password_confirm': 'secret123'}
    body.update(changes)
    return body


def test_register_returns_201_and_user(client):
    # Act
    response = client.post(REGISTER, json=register_body())
    # Assert
    assert response.status_code == 201
    data = response.json()
    assert data['email'] == 'olena@example.com'
    assert data['role'] == 'client'


def test_register_response_has_no_password(client):
    response = client.post(REGISTER, json=register_body())
    # Ні пароля, ні його хеша у відповіді бути не має
    assert 'password' not in response.json()
    assert 'password_hash' not in response.json()
    assert 'secret123' not in response.text


def test_register_lowercases_email(client):
    response = client.post(REGISTER, json=register_body(email='Olena@Example.COM'))
    assert response.json()['email'] == 'olena@example.com'


def test_register_duplicate_email_returns_409(client):
    # Arrange
    client.post(REGISTER, json=register_body())
    # Act: та сама пошта, але в іншому регістрі
    response = client.post(REGISTER, json=register_body(email='OLENA@example.com'))
    # Assert
    assert response.status_code == 409


@pytest.mark.parametrize(('changes', 'field'), [
    ({'password': '12345', 'password_confirm': '12345'}, 'password'),   # 5 символів, мінімум 6
    ({'email': 'not-an-email'}, 'email'),
    ({'name': ''}, 'name'),
])
def test_register_invalid_fields_return_422_with_errors(client, changes, field):
    response = client.post(REGISTER, json=register_body(**changes))
    assert response.status_code == 422
    errors = response.json()['errors']
    assert field in [error['field'] for error in errors]


def test_register_passwords_mismatch_returns_422(client):
    response = client.post(REGISTER, json=register_body(password_confirm='other123'))
    assert response.status_code == 422


def test_login_returns_token(client, user):
    # Act
    response = client.post(LOGIN, data={'username': user.email, 'password': 'client123'})
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data['token_type'] == 'bearer'
    assert data['access_token']
    assert data['user']['email'] == user.email


def test_login_token_works_for_users_me(client, user):
    token = client.post(LOGIN, data={'username': user.email, 'password': 'client123'}).json()['access_token']
    response = client.get('/api/v1/users/me', headers={'Authorization': f'Bearer {token}'})
    assert response.status_code == 200
    assert response.json()['id'] == user.id


def test_wrong_password_returns_401(client, user):
    response = client.post(LOGIN, data={'username': user.email, 'password': 'wrong-password'})
    assert response.status_code == 401


def test_unknown_email_returns_same_body_as_wrong_password(client, user):
    # Arrange / Act
    wrong_password = client.post(LOGIN, data={'username': user.email, 'password': 'wrong-password'})
    unknown_email = client.post(LOGIN, data={'username': 'nobody@test.example', 'password': 'client123'})
    # Assert: однакові код і тіло, щоб не підказувати, чи існує акаунт
    assert unknown_email.status_code == 401
    assert unknown_email.json() == wrong_password.json()


def test_login_without_form_fields_returns_422(client):
    assert client.post(LOGIN, data={}).status_code == 422
