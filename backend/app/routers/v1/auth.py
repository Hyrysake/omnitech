"""Реєстрація та вхід.

Виходу (logout) на сервері немає: сервер не зберігає токени, тож «вийти» = клієнт видаляє
свій токен. Токен, який хтось скопіював, перестане діяти, коли мине його термін (exp).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import DbSession
from app.core.config import settings
from app.core.security import create_access_token
from app.schemas.auth import RegisterIn, TokenOut
from app.schemas.common import error_responses
from app.schemas.user import UserOut
from app.services import users as users_service

router = APIRouter(prefix='/auth', tags=['Авторизація'])


@router.post('/register', response_model=UserOut, status_code=status.HTTP_201_CREATED,
             summary='Реєстрація нового клієнта', responses=error_responses(409, 422))
def register(data: RegisterIn, db: DbSession):
    """Створює акаунт з роллю client. Пароль зберігається лише як хеш."""
    return users_service.register(db, data)


@router.post('/token', response_model=TokenOut, summary='Вхід (отримати токен)',
             responses=error_responses(401, 422))
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession):
    """Вхід за стандартом OAuth2: дані приходять як форма (username + password), а не JSON.

    У полі username передається пошта. Саме так працює кнопка Authorize у /docs.
    Для неправильної пошти й неправильного пароля повідомлення однакове: вхід не підказує,
    чи існує акаунт. (Реєстрація все ж відповідає 409 «пошта зайнята» — інакше людина не зрозуміє,
    чому не може зареєструватися. Від масового перебору на справжньому сервері захищає обмеження
    кількості запитів, у навчальному проєкті його немає.)
    """
    user = users_service.authenticate(db, form.username, form.password)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Неправильна пошта або пароль.',
                            headers={'WWW-Authenticate': 'Bearer'})
    return TokenOut(
        access_token=create_access_token(user.id),
        expires_in=settings.access_token_minutes * 60,
        user=UserOut.model_validate(user),
    )
