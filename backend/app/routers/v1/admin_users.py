"""Адміністрування: список користувачів."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import AdminUser, DbSession, Pagination
from app.schemas.common import Page, error_responses
from app.schemas.user import UserOut
from app.services import users as users_service

router = APIRouter(prefix='/admin/users', tags=['Адміністрування'], responses=error_responses(401, 403))


@router.get('', response_model=Page[UserOut], summary='Усі користувачі (сторінками)')
def list_users(admin: AdminUser, db: DbSession, pagination: Pagination,
               q: Annotated[str | None, Query(max_length=100, description="Пошук в імені чи пошті")] = None):
    return users_service.list_users(db, pagination, q)
