"""Integration-тести початкових даних (app/seed): повторний запуск не має створювати дублікатів."""

from sqlalchemy import func, select

from app.models import Category, Product, User
from app.seed.__main__ import SEEDERS


def run_seeders(db):
    # Так само, як у main(): усі функції по черзі, потім один commit
    for seeder in SEEDERS:
        seeder(db)
    db.commit()


def count(db, model):
    return db.scalar(select(func.count()).select_from(model))


def test_seed_creates_expected_rows(db):
    run_seeders(db)
    assert count(db, Category) == 7
    assert count(db, Product) == 18
    assert count(db, User) == 2


def test_seed_twice_creates_no_duplicates(db):
    # Arrange / Act
    run_seeders(db)
    run_seeders(db)
    # Assert
    assert count(db, Category) == 7
    assert count(db, Product) == 18
    assert count(db, User) == 2


def test_seed_product_names_are_unique(db):
    run_seeders(db)
    run_seeders(db)
    names = db.scalars(select(Product.name)).all()
    assert len(names) == len(set(names))


def test_seeded_admin_exists(db):
    run_seeders(db)
    admin = db.scalar(select(User).where(User.email == 'admin@omnitech.example'))
    assert admin is not None
    assert admin.role == 'admin'
