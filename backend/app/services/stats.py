"""Лічильники для адмін-панелі (як на головній сторінці адмінки в Lab 04)."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Category, Feedback, Order, OrderStatus, Product, Review, User


def _count(db: Session, column) -> int:
    return db.scalar(select(func.count(column))) or 0


def get_stats(db: Session) -> dict:
    by_status = dict(db.execute(select(Order.status, func.count(Order.id)).group_by(Order.status)).all())
    return {
        'products': _count(db, Product.id),
        'categories': _count(db, Category.id),
        'users': _count(db, User.id),
        'reviews': _count(db, Review.id),
        'orders': _count(db, Order.id),
        # усі статуси, навіть ті, де 0 замовлень, щоб клієнту не перевіряти відсутні ключі
        'orders_by_status': {status.value: by_status.get(status, 0) for status in OrderStatus},
        'unread_feedback': db.scalar(select(func.count(Feedback.id)).where(Feedback.is_read.is_(False))) or 0,
        'revenue': db.scalar(select(func.coalesce(func.sum(Order.total), 0))
                             .where(Order.status == OrderStatus.COMPLETED)) or 0,
    }
