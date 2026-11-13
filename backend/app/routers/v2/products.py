"""Товари, API v2.

Чим відрізняється від v1 (тому це окрема версія, а не зміна v1):
- замість category_id — об'єкт category {id, name}: клієнту не треба окремо запитувати категорії;
- є rating {average, count}: середня оцінка й кількість відгуків.
Клієнти, написані під v1, працюють як і раніше, бо v1 не змінилась.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, Id, Pagination
from app.routers.v1.products import get_product_filters
from app.schemas.catalog import ProductOutV2
from app.schemas.common import Page, error_responses
from app.services import catalog as catalog_service
from app.services.catalog import ProductFilters

router = APIRouter(prefix='/products', tags=['Товари v2'])


def _to_v2(product, rating: dict) -> ProductOutV2:
    return ProductOutV2.model_validate({**ProductOutV2.base_fields(product), 'rating': rating})


@router.get('', response_model=Page[ProductOutV2], summary='Каталог v2 (з категорією й рейтингом)',
            responses=error_responses(400, 422))
def list_products_v2(db: DbSession, pagination: Pagination,
                     filters: Annotated[ProductFilters, Depends(get_product_filters)]):
    page = catalog_service.list_products(db, filters, pagination)
    # Рейтинги для всієї сторінки одним запитом, а не окремим запитом на кожен товар
    ratings = catalog_service.rating_summary(db, [product.id for product in page['items']])
    page['items'] = [_to_v2(product, ratings[product.id]) for product in page['items']]
    return page


@router.get('/{product_id}', response_model=ProductOutV2, summary='Один товар v2', responses=error_responses(404))
def get_product_v2(product_id: Id, db: DbSession):
    product = catalog_service.get_product(db, product_id)
    return _to_v2(product, catalog_service.rating_summary(db, [product_id])[product_id])
