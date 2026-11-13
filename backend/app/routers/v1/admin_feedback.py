"""Адміністрування: повідомлення з форми «Контакти»."""

from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import AdminUser, DbSession, Id, Pagination
from app.schemas.common import Page, error_responses
from app.schemas.feedback import FeedbackOut, FeedbackUpdate
from app.services import feedback as feedback_service

router = APIRouter(prefix='/admin/feedback', tags=['Адміністрування'], responses=error_responses(401, 403))


@router.get('', response_model=Page[FeedbackOut], summary='Усі повідомлення (нові спершу)')
def list_feedback(admin: AdminUser, db: DbSession, pagination: Pagination,
                  unread: Annotated[bool | None, Query(description='true — лише непрочитані')] = None):
    return feedback_service.list_all(db, pagination, unread)


@router.patch('/{feedback_id}', response_model=FeedbackOut, summary='Позначити прочитаним / непрочитаним',
              responses=error_responses(404, 422))
def mark_feedback(feedback_id: Id, data: FeedbackUpdate, admin: AdminUser, db: DbSession):
    return feedback_service.set_read(db, feedback_id, data.is_read)


@router.delete('/{feedback_id}', status_code=status.HTTP_204_NO_CONTENT, summary='Видалити повідомлення',
               responses=error_responses(404))
def delete_feedback(feedback_id: Id, admin: AdminUser, db: DbSession):
    feedback_service.delete(db, feedback_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
