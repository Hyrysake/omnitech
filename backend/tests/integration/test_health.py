"""Перший integration тест: сервер живий і відповідає JSON. Якщо падає він — решту можна не дивитися."""


def test_health_returns_ok(client):
    # Act
    response = client.get('/api/health')

    # Assert
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'


def test_unknown_address_returns_json_404(client):
    response = client.get('/api/v1/no-such-endpoint')

    assert response.status_code == 404
    assert 'detail' in response.json()     # навіть 404 приходить у нашому єдиному форматі помилок
