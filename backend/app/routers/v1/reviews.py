"""Відгуки про товари та їх модерація."""

from fastapi import APIRouter, Response, status

from app.api.deps import AdminUser, CurrentUser, DbSession, Id, Pagination
from app.schemas.common import Page, error_responses
from app.schemas.review import AdminReviewOut, ReviewIn, ReviewOut, ReviewUpdate
from app.services import reviews as reviews_service

router = APIRouter(tags=['Відгуки'])
admin_router = APIRouter(prefix='/admin/reviews', tags=['Адміністрування'], responses=error_responses(401, 403))


@router.get('/products/{product_id}/reviews', response_model=Page[ReviewOut],
            summary='Відгуки про товар (нові спершу)', responses=error_responses(404))
def list_reviews(product_id: Id, db: DbSession, pagination: Pagination):
    return reviews_service.list_for_product(db, product_id, pagination)


@router.post('/products/{product_id}/reviews', response_model=ReviewOut, status_code=status.HTTP_201_CREATED,
             summary='Залишити відгук', responses=error_responses(401, 404, 409, 422))
def create_review(product_id: Id, data: ReviewIn, user: CurrentUser, db: DbSession):
    """Один відгук на товар від одного користувача. Ім'я автора береться з профілю."""
    return reviews_service.create(db, product_id, user, data)


@router.patch('/reviews/{review_id}', response_model=ReviewOut, summary='Змінити свій відгук',
              responses=error_responses(401, 403, 404, 422))
def update_review(review_id: Id, data: ReviewUpdate, user: CurrentUser, db: DbSession):
    return reviews_service.update(db, review_id, user, data)


@router.delete('/reviews/{review_id}', status_code=status.HTTP_204_NO_CONTENT,
               summary='Видалити відгук (автор або адміністратор)', responses=error_responses(401, 403, 404))
def delete_review(review_id: Id, user: CurrentUser, db: DbSession):
    reviews_service.delete(db, review_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@admin_router.get('', response_model=Page[AdminReviewOut], summary='Усі відгуки для модерації')
def list_all_reviews(admin: AdminUser, db: DbSession, pagination: Pagination):
    return reviews_service.list_all(db, pagination)
