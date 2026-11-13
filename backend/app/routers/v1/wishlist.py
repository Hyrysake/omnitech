"""Список бажань користувача, який увійшов."""

from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DbSession, Id
from app.schemas.catalog import ProductOut
from app.schemas.common import error_responses
from app.services import wishlist as wishlist_service

router = APIRouter(prefix='/users/me/wishlist', tags=['Список бажань'], responses=error_responses(401))


@router.get('', response_model=list[ProductOut], summary='Мій список бажань')
def list_wishlist(user: CurrentUser, db: DbSession):
    return wishlist_service.list_products(db, user)


@router.put('/{product_id}', status_code=status.HTTP_204_NO_CONTENT, summary='Додати товар до списку',
            responses=error_responses(404))
def add_to_wishlist(product_id: Id, user: CurrentUser, db: DbSession):
    """PUT, а не POST: результат однаковий, скільки разів не повтори (ідемпотентно)."""
    wishlist_service.add(db, user, product_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete('/{product_id}', status_code=status.HTTP_204_NO_CONTENT, summary='Прибрати товар зі списку')
def remove_from_wishlist(product_id: Id, user: CurrentUser, db: DbSession):
    """Якщо товару в списку й так немає — теж 204: бажаний стан («товару в списку немає») досягнуто."""
    wishlist_service.remove(db, user, product_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
