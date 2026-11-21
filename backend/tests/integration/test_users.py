"""Integration-тести профілю: /api/v1/users/me (токен, зміна даних і пароля, видалення акаунта)."""

from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import settings
from app.core.security import ALGORITHM, create_access_token

ME = '/api/v1/users/me'
LOGIN = '/api/v1/auth/token'


def bearer(token):
    return {'Authorization': f'Bearer {token}'}


def test_me_without_token_returns_401(client):
    assert client.get(ME).status_code == 401


def test_me_with_forged_token_returns_401(client, user):
    # Токен підписаний чужим ключем
    forged = jwt.encode({'sub': str(user.id), 'exp': datetime.now(UTC) + timedelta(hours=1)},
                        'another-secret-key-0123456789-0123456789', algorithm=ALGORITHM)
    assert client.get(ME, headers=bearer(forged)).status_code == 401


def test_me_with_expired_token_returns_401(client, user):
    expired = jwt.encode({'sub': str(user.id), 'exp': datetime.now(UTC) - timedelta(minutes=1)},
                         settings.secret_key, algorithm=ALGORITHM)
    assert client.get(ME, headers=bearer(expired)).status_code == 401


def test_me_with_token_of_deleted_user_returns_401(client, db, user):
    # Arrange: токен ще дійсний, а акаунта вже немає
    token = create_access_token(user.id)
    db.delete(user)
    db.commit()
    # Act
    response = client.get(ME, headers=bearer(token))
    # Assert
    assert response.status_code == 401


def test_me_returns_own_profile(client, user, user_headers):
    response = client.get(ME, headers=user_headers)
    assert response.status_code == 200
    assert response.json()['email'] == user.email


def test_patch_me_changes_name(client, user_headers):
    response = client.patch(ME, json={'name': 'Нове Імʼя'}, headers=user_headers)
    assert response.status_code == 200
    assert response.json()['name'] == 'Нове Імʼя'


def test_patch_me_with_taken_email_returns_409(client, admin, user_headers):
    response = client.patch(ME, json={'email': admin.email}, headers=user_headers)
    assert response.status_code == 409


def test_patch_me_with_null_name_returns_422(client, user_headers):
    response = client.patch(ME, json={'name': None}, headers=user_headers)
    assert response.status_code == 422


def test_change_password_with_wrong_current_returns_400(client, user_headers):
    body = {'current_password': 'not-my-password', 'new_password': 'brand-new-123'}
    response = client.post(f'{ME}/password', json=body, headers=user_headers)
    assert response.status_code == 400


def test_change_password_then_login_with_new_one(client, user, user_headers):
    # Arrange
    body = {'current_password': 'client123', 'new_password': 'brand-new-123'}
    # Act
    response = client.post(f'{ME}/password', json=body, headers=user_headers)
    # Assert: новий пароль працює, старий уже ні
    assert response.status_code == 204
    new_login = client.post(LOGIN, data={'username': user.email, 'password': 'brand-new-123'})
    old_login = client.post(LOGIN, data={'username': user.email, 'password': 'client123'})
    assert new_login.status_code == 200
    assert old_login.status_code == 401


def test_delete_me_returns_204_and_account_is_gone(client, user, user_headers):
    # Act
    response = client.delete(ME, headers=user_headers)
    # Assert: з тим самим токеном акаунт уже не знайти
    assert response.status_code == 204
    assert client.get(ME, headers=user_headers).status_code == 401


def test_admin_cannot_delete_own_account(client, admin_headers):
    response = client.delete(ME, headers=admin_headers)
    assert response.status_code == 409
