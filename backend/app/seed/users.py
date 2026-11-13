"""Демонстраційні акаунти.

Паролі відомі всім, бо лежать у README: для локальної навчальної бази це нормально,
на справжньому сервері так робити не можна.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import User

# (ім'я, email, пароль, роль)
USERS = [
    ('Адміністратор OmniTech', 'admin@omnitech.example', 'admin123', 'admin'),
    ('Олена Коваль', 'client@omnitech.example', 'client123', 'client'),
]


def seed_users(db: Session) -> None:
    if db.scalar(select(User.id).limit(1)) is not None:
        return      # таблиця вже не порожня
    db.add_all(User(name=name, email=email, password_hash=hash_password(password), role=role)
               for name, email, password, role in USERS)
    db.flush()      # надіслати INSERT зараз, щоб наступні функції бачили id користувачів
