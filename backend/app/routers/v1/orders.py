"""Оформлення замовлення та історія замовлень користувача."""

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession, Id, OptionalUser, Pagination
from app.schemas.common import Page, error_responses
from app.schemas.order import OrderCreate, OrderOut
from app.services import orders as orders_service

router = APIRouter(tags=['Замовлення'])


@router.post('/orders', response_model=OrderOut, status_code=status.HTTP_201_CREATED,
             summary='Оформити замовлення (гість або користувач)', responses=error_responses(401, 404, 422))
def create_order(data: OrderCreate, user: OptionalUser, db: DbSession):
    """Без токена — замовлення гостя. З токеном — замовлення прив'язується до акаунта й з'являється в історії."""
    return orders_service.create_order(db, data, user)


@router.get('/users/me/orders', response_model=Page[OrderOut], summary='Мої замовлення (нові спершу)',
            responses=error_responses(401))
def list_my_orders(user: CurrentUser, db: DbSession, pagination: Pagination):
    return orders_service.list_user_orders(db, user, pagination)


@router.get('/users/me/orders/{order_id}', response_model=OrderOut, summary='Одне моє замовлення',
            responses=error_responses(401, 404))
def get_my_order(order_id: Id, user: CurrentUser, db: DbSession):
    return orders_service.get_user_order(db, user, order_id)
