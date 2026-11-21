"""Unit-тести app/core/security.py: хешування паролів і JWT-токени.

Тут немає бази й HTTP: перевіряємо чисті функції. Для токенів "ламаємо" їх вручну
(через jwt.encode), щоб переконатися, що decode_access_token відхиляє підробки.
"""

from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import settings
from app.core.security import (
    ALGORITHM,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_hash_and_verify_round_trip():
    hashed = hash_password('secret123')
    assert verify_password('secret123', hashed) is True


def test_hash_is_not_plain_password():
    # У базі не має лежати сам пароль
    assert 'secret123' not in hash_password('secret123')


def test_wrong_password_does_not_verify():
    hashed = hash_password('secret123')
    assert verify_password('secret124', hashed) is False


def test_same_password_gives_different_hashes():
    # Сіль генерується щоразу, тому хеші однакових паролів різні
    assert hash_password('secret123') != hash_password('secret123')


def test_access_token_subject_is_user_id_as_string():
    token = create_access_token(42)
    payload = decode_access_token(token)
    assert payload['sub'] == '42'


def test_access_token_lifetime_matches_settings():
    # Arrange
    token = create_access_token(1)
    # Act
    payload = decode_access_token(token)
    # Assert
    assert payload['exp'] - payload['iat'] == settings.access_token_minutes * 60


def test_tampered_signature_is_rejected():
    # Arrange: підміняємо підпис на неправильний, решту токена лишаємо
    header, payload, signature = create_access_token(1).split('.')
    forged = f'{header}.{payload}.{"A" * len(signature)}'
    # Act / Assert
    with pytest.raises(jwt.InvalidSignatureError):
        decode_access_token(forged)


def test_token_signed_with_other_key_is_rejected():
    forged = jwt.encode({'sub': '1', 'exp': datetime.now(UTC) + timedelta(hours=1)},
                        'another-secret-key-0123456789-0123456789', algorithm=ALGORITHM)
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(forged)


def test_expired_token_is_rejected():
    # Arrange: токен, термін дії якого минув годину тому
    expired = jwt.encode({'sub': '1', 'exp': datetime.now(UTC) - timedelta(hours=1)},
                         settings.secret_key, algorithm=ALGORITHM)
    # Act / Assert
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(expired)


def test_alg_none_token_is_rejected():
    # Токен без підпису (alg=none) не має проходити, інакше підробити його може будь-хто
    unsigned = jwt.encode({'sub': '1', 'exp': datetime.now(UTC) + timedelta(hours=1)},
                          key=None, algorithm='none')
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(unsigned)


@pytest.mark.parametrize('payload', [
    {'sub': '1'},                                                  # немає exp: "вічний" токен
    {'exp': datetime.now(UTC) + timedelta(hours=1)},               # немає sub: невідомо, чий токен
], ids=['no_exp', 'no_sub'])
def test_token_without_required_claim_is_rejected(payload):
    token = jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
    with pytest.raises(jwt.MissingRequiredClaimError):
        decode_access_token(token)


def test_garbage_string_is_rejected():
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token('not-a-token')
