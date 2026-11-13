"""Профіль користувача, який увійшов: /users/me."""

from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.common import error_responses
from app.schemas.user import PasswordChange, UserOut, UserUpdate
from app.services import users as users_service

router = APIRouter(prefix='/users/me', tags=['Профіль'], responses=error_responses(401))


@router.get('', response_model=UserOut, summary='Мій профіль')
def read_me(user: CurrentUser):
    return user


@router.patch('', response_model=UserOut, summary="Змінити ім'я чи пошту", responses=error_responses(409, 422))
def update_me(data: UserUpdate, user: CurrentUser, db: DbSession):
    """PATCH: змінюються лише передані поля. Після зміни пошти входити треба вже з новою."""
    return users_service.update_profile(db, user, data)


@router.post('/password', status_code=status.HTTP_204_NO_CONTENT, summary='Змінити пароль',
             responses=error_responses(400, 422))
def change_password(data: PasswordChange, user: CurrentUser, db: DbSession):
    users_service.change_password(db, user, data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete('', status_code=status.HTTP_204_NO_CONTENT, summary='Видалити свій акаунт',
               responses=error_responses(409))
def delete_me(user: CurrentUser, db: DbSession):
    """Акаунт видаляється назавжди. Адміністратор свій акаунт видалити не може (409)."""
    users_service.delete_account(db, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
