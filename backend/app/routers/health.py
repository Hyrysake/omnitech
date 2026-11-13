"""Службова адреса: чи живий сервер і чи доступна база. Знадобиться в Lab 08 (перевірка контейнера)."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import DbSession

router = APIRouter(tags=['Службові'])


@router.get('/health', summary='Стан сервера і бази')
def health(db: DbSession):
    """200, якщо сервер працює й база відповідає; 503, якщо база недоступна."""
    try:
        db.execute(text('SELECT 1'))
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={'status': 'error', 'database': 'unavailable'})
    return {'status': 'ok', 'database': 'ok'}
