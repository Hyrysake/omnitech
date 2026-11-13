"""Схеми користувача: що API віддає і що приймає для профілю."""

from datetime import datetime

from pydantic import Field

from app.core.validators import Email, Name, Password
from app.schemas.common import InputModel, OutputModel


class UserOut(OutputModel):
    """Користувач у відповіді. Хеша пароля тут немає й бути не може: у схемі його просто не оголошено."""

    id: int
    name: str
    email: str
    role: str = Field(examples=['client'])
    created_at: datetime


class UserUpdate(InputModel):
    """Зміна профілю (PATCH): передають лише ті поля, які треба змінити."""

    name: Name | None = None
    email: Email | None = None


class PasswordChange(InputModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: Password
