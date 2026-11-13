"""Спільні типи полів із перевірками. Ті самі правила, що були у формах сайту в Lab 04.

Annotated[тип, правила...] — це тип із прикріпленими правилами. Його можна використати в будь-якій
схемі: Pydantic сам перевірить значення й поверне 422 з поясненням, якщо щось не так.
"""

import re
from typing import Annotated

from pydantic import AfterValidator, EmailStr, Field


def check_phone(phone: str) -> str:
    """Телефон: від 10 до 13 цифр, а ще можуть бути пробіли, дужки, плюс і дефіс."""
    digits = re.sub(r'\D', '', phone)
    if not (10 <= len(digits) <= 13 and re.fullmatch(r'[\d\s()+-]+', phone)):
        # Текст ValueError Pydantic покаже клієнту в полі message
        raise ValueError('Вкажіть коректний номер телефону, наприклад +380501234567.')
    return phone


def lower_email(email: str) -> str:
    """Пошту зберігаємо малими літерами: Olena@Example.com і olena@example.com — один акаунт."""
    return email.lower()


Name = Annotated[str, Field(min_length=2, max_length=100, examples=['Олена Коваль'])]
Email = Annotated[EmailStr, AfterValidator(lower_email), Field(max_length=254, examples=['olena@example.com'])]
Password = Annotated[str, Field(min_length=6, max_length=128, examples=['secret123'])]
Phone = Annotated[str, Field(max_length=20, examples=['+380501234567']), AfterValidator(check_phone)]
