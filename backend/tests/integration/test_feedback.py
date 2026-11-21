"""Integration тести форми «Контакти»: POST /api/v1/feedback і керування в /api/v1/admin/feedback."""


def send_feedback(client, message='Чи можна відкласти ноутбук на два дні?'):
    body = {'name': 'Олена Коваль', 'email': 'olena@example.com', 'message': message}
    return client.post('/api/v1/feedback', json=body)


def test_guest_can_send_feedback(client):
    response = send_feedback(client)

    assert response.status_code == 201
    assert response.json()['is_read'] is False


def test_too_short_message_returns_422(client):
    # Мінімум 10 символів
    response = send_feedback(client, message='Привіт')

    assert response.status_code == 422


def test_admin_sees_feedback_list(client, admin_headers):
    send_feedback(client)

    response = client.get('/api/v1/admin/feedback', headers=admin_headers)

    assert response.status_code == 200
    assert response.json()['total'] == 1


def test_admin_unread_filter_hides_read_messages(client, admin_headers):
    # Arrange: два повідомлення, перше позначаємо прочитаним
    first = send_feedback(client).json()['id']
    second = send_feedback(client, message='Друге повідомлення для магазину').json()['id']
    client.patch(f'/api/v1/admin/feedback/{first}', json={'is_read': True}, headers=admin_headers)

    # Act
    response = client.get('/api/v1/admin/feedback?unread=true', headers=admin_headers)

    # Assert
    assert [item['id'] for item in response.json()['items']] == [second]


def test_admin_marks_feedback_read(client, admin_headers):
    feedback_id = send_feedback(client).json()['id']

    response = client.patch(f'/api/v1/admin/feedback/{feedback_id}', json={'is_read': True}, headers=admin_headers)

    assert response.status_code == 200
    assert response.json()['is_read'] is True


def test_mark_feedback_requires_boolean(client, admin_headers):
    feedback_id = send_feedback(client).json()['id']

    response = client.patch(f'/api/v1/admin/feedback/{feedback_id}', json={'is_read': 'yes'}, headers=admin_headers)

    assert response.status_code == 422


def test_admin_deletes_feedback(client, admin_headers):
    # Arrange
    feedback_id = send_feedback(client).json()['id']

    # Act
    response = client.delete(f'/api/v1/admin/feedback/{feedback_id}', headers=admin_headers)

    # Assert
    assert response.status_code == 204
    assert client.get('/api/v1/admin/feedback', headers=admin_headers).json()['total'] == 0


def test_admin_delete_unknown_feedback_returns_404(client, admin_headers):
    response = client.delete('/api/v1/admin/feedback/9999', headers=admin_headers)

    assert response.status_code == 404


def test_client_cannot_read_admin_feedback(client, user_headers):
    response = client.get('/api/v1/admin/feedback', headers=user_headers)

    assert response.status_code == 403
