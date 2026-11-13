"""Схеми реєстрації та входу."""

from pydantic import Field, model_validator

from app.core.validators import Email, Name, Password
from app.schemas.common import InputModel, OutputModel
from app.schemas.user import UserOut


class RegisterIn(InputModel):
    name: Name
    email: Email
    password: Password
    password_confirm: str = Field(max_length=128, examples=['secret123'])

    @model_validator(mode='after')
    def passwords_match(self):
        """Перевірка, яка стосується двох полів одразу, тому вона на рівні всієї моделі."""
        if self.password != self.password_confirm:
            raise ValueError('Паролі не збігаються.')
        return self


class TokenOut(OutputModel):
    """Відповідь на вхід. Поля access_token і token_type вимагає стандарт OAuth2."""

    access_token: str
    token_type: str = 'bearer'
    expires_in: int = Field(description='Через скільки секунд токен перестане діяти')
    user: UserOut
