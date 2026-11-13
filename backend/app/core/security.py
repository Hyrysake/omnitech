"""Паролі й токени входу.

Паролі зберігаються лише як хеш (argon2): за хешем пароль не відновити, а перевірити — можна.
Після входу користувач отримує JWT-токен і надсилає його з кожним запитом у заголовку
Authorization: Bearer <токен>. Сервер нічого не запам'ятовує: усе потрібне лежить у самому
токені й захищене підписом.
"""

from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.core.config import settings

ALGORITHM = 'HS256'   # підпис HMAC-SHA256 одним секретним ключем

# Рекомендований алгоритм бібліотеки pwdlib (argon2). Сіль генерується для кожного пароля сама
password_hash = PasswordHash.recommended()

# Хеш вигаданого пароля. Коли користувача з такою поштою немає, ми все одно перевіряємо пароль
# проти цього хеша: відповідь займає стільки ж часу, і за часом не вгадати, чи існує акаунт
DUMMY_HASH = password_hash.hash('dummy-password-for-timing')


def hash_password(password: str) -> str:
    """Повертає хеш пароля для збереження в базі."""
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """True, якщо пароль відповідає хешу."""
    return password_hash.verify(password, hashed)


def create_access_token(user_id: int) -> str:
    """Створює підписаний JWT з номером користувача й терміном дії.

    sub (subject) — кого стосується токен; exp — коли він перестане діяти;
    iat (issued at) — коли виданий. Вміст токена може прочитати будь-хто (це не шифрування),
    тому паролів і особистих даних у ньому немає. Змінити вміст не можна: зламається підпис.
    Ролі в токені немає навмисно: сервер щоразу бере її з бази (app/api/deps.py).
    """
    now = datetime.now(UTC)
    payload = {
        'sub': str(user_id),
        'iat': now,
        'exp': now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Перевіряє підпис і термін дії токена й повертає його вміст.

    Кидає jwt.ExpiredSignatureError, якщо термін минув, і jwt.InvalidTokenError,
    якщо токен підроблений чи пошкоджений. algorithms задано явно: інакше зловмисник
    міг би підсунути токен з алгоритмом «none» без підпису. require: токен без терміну дії (exp)
    чи без номера користувача (sub) недійсний — «вічний» токен не пройде.
    """
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM], options={'require': ['exp', 'sub']})
