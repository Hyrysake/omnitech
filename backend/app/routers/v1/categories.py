"""Категорії товарів. Читати може будь-хто, змінювати — лише адміністратор."""

from fastapi import APIRouter, Response, status

from app.api.deps import AdminUser, DbSession, Id
from app.schemas.catalog import CategoryIn, CategoryOut, CategoryWithCount
from app.schemas.common import error_responses
from app.services import catalog as catalog_service

router = APIRouter(prefix='/categories', tags=['Категорії'])

ADMIN_ERRORS = error_responses(401, 403, 404, 409, 422)


@router.get('', response_model=list[CategoryWithCount], summary='Усі категорії з кількістю товарів')
def list_categories(db: DbSession):
    return catalog_service.list_categories(db)


@router.post('', response_model=CategoryOut, status_code=status.HTTP_201_CREATED,
             summary='Нова категорія', responses=ADMIN_ERRORS)
def create_category(data: CategoryIn, admin: AdminUser, db: DbSession):
    return catalog_service.create_category(db, data)


@router.patch('/{category_id}', response_model=CategoryOut, summary='Перейменувати категорію', responses=ADMIN_ERRORS)
def rename_category(category_id: Id, data: CategoryIn, admin: AdminUser, db: DbSession):
    return catalog_service.rename_category(db, category_id, data)


@router.delete('/{category_id}', status_code=status.HTTP_204_NO_CONTENT,
               summary='Видалити порожню категорію', responses=ADMIN_ERRORS)
def delete_category(category_id: Id, admin: AdminUser, db: DbSession):
    """Категорію з товарами видалити не можна (409): спершу перенесіть або видаліть товари."""
    catalog_service.delete_category(db, category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
