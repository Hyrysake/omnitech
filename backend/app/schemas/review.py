"""Схеми відгуків."""

from datetime import datetime
from typing import Annotated

from pydantic import Field

from app.schemas.common import InputModel, OutputModel

Rating = Annotated[int, Field(ge=1, le=5, strict=True, examples=[5])]
ReviewText = Annotated[str, Field(min_length=5, max_length=1000, examples=['Легкий і тихий, батареї вистачає на весь день.'])]


class ReviewIn(InputModel):
    rating: Rating
    text: ReviewText


class ReviewUpdate(InputModel):
    rating: Rating | None = None
    text: ReviewText | None = None


class ReviewOut(OutputModel):
    id: int
    product_id: int
    user_id: int | None = Field(description='Порожньо для демонстраційних відгуків і видалених акаунтів')
    author_name: str
    rating: int
    text: str
    created_at: datetime


class AdminReviewOut(ReviewOut):
    product_name: str
