"""Товари (API v1): каталог з пошуком і сторінками, зміни для адміністратора, картинки."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, Request, Response, UploadFile, status

from app.api.deps import MAX_ID, AdminUser, DbSession, Id, Pagination
from app.schemas.catalog import ProductCreate, ProductOut, ProductSort, ProductUpdate
from app.schemas.common import Page, error_responses
from app.services import catalog as catalog_service
from app.services import media
from app.services.catalog import ProductFilters

router = APIRouter(prefix='/products', tags=['Товари'])

ADMIN_ERRORS = error_responses(401, 403, 404, 422)


def get_product_filters(
    q: Annotated[str | None, Query(max_length=100, description='Пошук у назві й описі')] = None,
    category_id: Annotated[int | None, Query(gt=0, le=MAX_ID, description='Лише ця категорія')] = None,
    min_price: Annotated[int | None, Query(ge=0, le=10_000_000, description='Ціна від, грн')] = None,
    max_price: Annotated[int | None, Query(ge=0, le=10_000_000, description='Ціна до, грн')] = None,
    featured: Annotated[bool | None, Query(description='true — лише товари з головної')] = None,
    sort: Annotated[ProductSort, Query(description='Порядок: default, price_asc, price_desc, name, newest')] = 'default',
) -> ProductFilters:
    """Параметри адреси ?q=&category_id=&… -> один об'єкт. Цю ж функцію використовує API v2."""
    return ProductFilters(q=q or None, category_id=category_id, min_price=min_price,
                          max_price=max_price, featured=featured, sort=sort)



@router.get('', response_model=Page[ProductOut], summary='Каталог: пошук, фільтри, сторінки',
            responses=error_responses(400, 422))
def list_products(db: DbSession, pagination: Pagination,
                  filters: Annotated[ProductFilters, Depends(get_product_filters)]):
    return catalog_service.list_products(db, filters, pagination)


@router.get('/{product_id}', response_model=ProductOut, summary='Один товар', responses=error_responses(404))
def get_product(product_id: Id, db: DbSession):
    return catalog_service.get_product(db, product_id)


@router.post('', response_model=ProductOut, status_code=status.HTTP_201_CREATED,
             summary='Новий товар', responses=ADMIN_ERRORS)
def create_product(data: ProductCreate, admin: AdminUser, db: DbSession, request: Request, response: Response):
    """Після створення заголовок Location містить адресу нового товару (так вимагає стандарт для 201)."""
    product = catalog_service.create_product(db, data)
    response.headers['Location'] = str(request.url_for('get_product', product_id=product.id))
    return product


@router.put('/{product_id}', response_model=ProductOut, summary='Замінити товар повністю', responses=ADMIN_ERRORS)
def replace_product(product_id: Id, data: ProductCreate, admin: AdminUser, db: DbSession):
    """PUT передає товар цілком: поле, якого немає в запиті, отримає значення за замовчуванням."""
    return catalog_service.replace_product(db, product_id, data)


@router.patch('/{product_id}', response_model=ProductOut, summary='Змінити частину полів', responses=ADMIN_ERRORS)
def update_product(product_id: Id, data: ProductUpdate, admin: AdminUser, db: DbSession):
    """PATCH змінює лише передані поля: {"price": 17999} змінить тільки ціну."""
    return catalog_service.update_product(db, product_id, data)


@router.delete('/{product_id}', status_code=status.HTTP_204_NO_CONTENT, summary='Видалити товар',
               responses=error_responses(401, 403, 404, 409))
def delete_product(product_id: Id, admin: AdminUser, db: DbSession):
    """Товар із замовлень видалити не можна (409). Відгуки й записи в списках бажань видаляються разом з ним."""
    catalog_service.delete_product(db, product_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post('/{product_id}/image', response_model=ProductOut, summary='Завантажити картинку товару',
             responses=error_responses(401, 403, 404, 413, 415, 422))
def upload_image(product_id: Id, admin: AdminUser, db: DbSession,
                 file: Annotated[UploadFile, File(description='JPEG, PNG або WebP, до 5 МБ')]):
    """Файл надсилається як multipart/form-data у полі file. Стара завантажена картинка видаляється."""
    catalog_service.get_product(db, product_id)        # 404 ще до збереження файлу
    image_url = media.save_product_image(file.file)
    try:
        return catalog_service.set_product_image(db, product_id, image_url)
    except Exception:
        media.delete_local_file(image_url)             # не лишати «осиротілий» файл
        raise


@router.delete('/{product_id}/image', status_code=status.HTTP_204_NO_CONTENT, summary='Прибрати картинку товару',
               responses=error_responses(401, 403, 404))
def delete_image(product_id: Id, admin: AdminUser, db: DbSession):
    catalog_service.set_product_image(db, product_id, '')
    return Response(status_code=status.HTTP_204_NO_CONTENT)
