"""Адміністрування: лічильники для головної сторінки адмін-панелі."""

from fastapi import APIRouter

from app.api.deps import AdminUser, DbSession
from app.schemas.common import error_responses
from app.schemas.feedback import StatsOut
from app.services import stats as stats_service

router = APIRouter(prefix='/admin/stats', tags=['Адміністрування'], responses=error_responses(401, 403))


@router.get('', response_model=StatsOut, summary='Статистика магазину')
def get_stats(admin: AdminUser, db: DbSession):
    return stats_service.get_stats(db)
