"""Адміністрування: замовлення."""

from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import AdminUser, DbSession, Id, Pagination
from app.models import OrderStatus
from app.schemas.common import Page, error_responses
from app.schemas.order import OrderOut, OrderStatusUpdate
from app.services import orders as orders_service

router = APIRouter(prefix='/admin/orders', tags=['Адміністрування'], responses=error_responses(401, 403))


@router.get('', response_model=Page[OrderOut], summary='Усі замовлення', responses=error_responses(422))
def list_orders(admin: AdminUser, db: DbSession, pagination: Pagination,
                status_filter: Annotated[OrderStatus | None, Query(alias='status', description='Лише з цим статусом')] = None):
    return orders_service.list_orders(db, pagination, status_filter)


@router.get('/{order_id}', response_model=OrderOut, summary='Одне замовлення', responses=error_responses(404))
def get_order(order_id: Id, admin: AdminUser, db: DbSession):
    return orders_service.get_order(db, order_id)


@router.patch('/{order_id}', response_model=OrderOut, summary='Змінити статус замовлення',
              responses=error_responses(404, 422))
def update_status(order_id: Id, data: OrderStatusUpdate, admin: AdminUser, db: DbSession):
    return orders_service.set_status(db, order_id, data.status)


@router.delete('/{order_id}', status_code=status.HTTP_204_NO_CONTENT, summary='Видалити замовлення',
               responses=error_responses(404))
def delete_order(order_id: Id, admin: AdminUser, db: DbSession):
    orders_service.delete_order(db, order_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
