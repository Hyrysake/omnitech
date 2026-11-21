"""Спільні fixtures для всіх тестів. pytest підключає цей файл сам — імпортувати його не треба.

Fixture — функція, яка готує все потрібне для тесту. Тест «замовляє» її, просто вказавши назву
як параметр: def test_x(client, admin_headers). pytest викличе fixtures і передасть результат.
"""

import os
import tempfile
from pathlib import Path

# ---------- 1. Налаштування для тестів — ДО імпорту застосунку ----------
# app.core.config читає налаштування в момент першого імпорту. Змінні оточення важливіші за backend/.env,
# тож тести ніколи не торкнуться вашої робочої бази data/omnitech.db і не потребують .env (зручно для GitHub Actions)
_TMP = Path(tempfile.mkdtemp(prefix='omnitech-tests-'))
os.environ['SECRET_KEY'] = 'tests-only-secret-key-not-for-production-0123456789'
os.environ['DATABASE_URL'] = f'sqlite:///{(_TMP / "test.db").as_posix()}'
os.environ['MEDIA_DIR'] = str(_TMP / 'media')

import pytest  # noqa: E402 — імпорти після налаштувань навмисно
from fastapi.testclient import TestClient  # noqa: E402
from pwdlib import PasswordHash  # noqa: E402
from pwdlib.hashers.argon2 import Argon2Hasher  # noqa: E402

import app.models  # noqa: E402, F401 — реєструє всі таблиці в Base.metadata
from app.core import security  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Category, Product, User  # noqa: E402

# Запобіжник: якщо налаштування чомусь не підхопились, краще впасти одразу, ніж стерти робочу базу
assert 'omnitech-tests-' in str(engine.url), f'тести мають працювати з тимчасовою базою, а не {engine.url}'

# Справжній argon2 навмисно повільний (~50 мс на пароль), щоб пароль було важко підібрати.
# Для тестів беремо найлегші параметри: перевіряється та сама логіка, а сотні тестів ідуть за секунди
security.password_hash = PasswordHash((Argon2Hasher(time_cost=1, memory_cost=1024, parallelism=1),))


# ---------- 2. База й клієнт ----------

@pytest.fixture
def db():
    """Чиста база для КОЖНОГО тесту: таблиці видаляються й створюються заново.

    Так тести не залежать один від одного: що б не створив попередній тест, наступний почне з порожньої бази.
    """
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client(db):
    """Тестовий клієнт: надсилає запити застосунку напряму, без запуску справжнього сервера (uvicorn)."""
    with TestClient(app) as test_client:
        yield test_client


# ---------- 3. Тестові дані ----------
# Фабрика — fixture, що повертає функцію: тест сам вирішує, скільки об'єктів і з якими полями створити

@pytest.fixture
def make_user(db):
    def _make(email='client@test.example', password='client123', name='Тестовий Клієнт', role='client'):
        user = User(name=name, email=email, password_hash=hash_password(password), role=role)
        db.add(user)
        db.commit()
        return user
    return _make


@pytest.fixture
def user(make_user):
    """Звичайний покупець (пароль client123)."""
    return make_user()


@pytest.fixture
def admin(make_user):
    """Адміністратор (пароль admin123)."""
    return make_user(email='admin@test.example', password='admin123', name='Тестовий Адмін', role='admin')


def auth_headers(user):
    """Заголовок входу для користувача. Токен створюємо напряму, щоб не входити через API в кожному тесті."""
    return {'Authorization': f'Bearer {create_access_token(user.id)}'}


@pytest.fixture
def user_headers(user):
    return auth_headers(user)


@pytest.fixture
def admin_headers(admin):
    return auth_headers(admin)


@pytest.fixture
def make_category(db):
    def _make(name='Ноутбуки'):
        category = Category(name=name)
        db.add(category)
        db.commit()
        return category
    return _make


@pytest.fixture
def category(make_category):
    return make_category()


@pytest.fixture
def make_product(db, category):
    def _make(name='Ноутбук Test 14', price=25000, category_id=None, description='Тестовий товар', is_featured=False):
        product = Product(name=name, price=price, category_id=category_id or category.id,
                          description=description, is_featured=is_featured)
        db.add(product)
        db.commit()
        return product
    return _make


@pytest.fixture
def product(make_product):
    return make_product()
