"""Форма «Контакти»: надіслати повідомлення може будь-хто."""

from fastapi import APIRouter, status

from app.api.deps import DbSession
from app.schemas.common import error_responses
from app.schemas.feedback import FeedbackIn, FeedbackOut
from app.services import feedback as feedback_service

router = APIRouter(prefix='/feedback', tags=["Зворотний зв'язок"])


@router.post('', response_model=FeedbackOut, status_code=status.HTTP_201_CREATED,
             summary='Надіслати повідомлення', responses=error_responses(422))
def send_feedback(data: FeedbackIn, db: DbSession):
    return feedback_service.create(db, data)
