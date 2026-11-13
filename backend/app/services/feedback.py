"""Логіка повідомлень з форми «Контакти»."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.db.pagination import PageParams, paginate
from app.models import Feedback
from app.schemas.feedback import FeedbackIn


def create(db: Session, data: FeedbackIn) -> Feedback:
    feedback = Feedback(**data.model_dump())
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


def list_all(db: Session, params: PageParams, unread: bool | None = None) -> dict:
    """Нові спершу. unread=true — лише непрочитані."""
    statement = select(Feedback).order_by(Feedback.created_at.desc(), Feedback.id.desc())
    if unread is not None:
        statement = statement.where(Feedback.is_read == (not unread))
    return paginate(db, statement, params)


def get(db: Session, feedback_id: int) -> Feedback:
    feedback = db.get(Feedback, feedback_id)
    if feedback is None:
        raise NotFoundError('Повідомлення не знайдено.')
    return feedback


def set_read(db: Session, feedback_id: int, is_read: bool) -> Feedback:
    feedback = get(db, feedback_id)
    feedback.is_read = is_read
    db.commit()
    db.refresh(feedback)
    return feedback


def delete(db: Session, feedback_id: int) -> None:
    db.delete(get(db, feedback_id))
    db.commit()
