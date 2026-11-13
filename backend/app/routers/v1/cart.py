"""Кошик. Сам кошик зберігає клієнт; сервер лише перераховує його за актуальними цінами."""

from fastapi import APIRouter

from app.api.deps import DbSession
from app.schemas.common import error_responses
from app.schemas.order import CartIn, CartPreviewOut
from app.services import orders as orders_service

router = APIRouter(prefix='/cart', tags=['Кошик'])


@router.post('/preview', response_model=CartPreviewOut, summary='Порахувати кошик', responses=error_responses(422))
def preview_cart(data: CartIn, db: DbSession):
    """POST, а не GET, бо список товарів передається в тілі запиту. Нічого не зберігає."""
    return orders_service.preview_cart(db, data.items)
