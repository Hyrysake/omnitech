"""Розбиття списку на сторінки прямо в SQL (LIMIT/OFFSET), а не зрізом у Python.

Із бази приходить рівно одна сторінка, тож запит однаково швидкий і для 18 товарів, і для 18 000.
"""

from dataclasses import dataclass
from math import ceil

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session


@dataclass
class PageParams:
    """Номер сторінки (від 1) і кількість записів на ній."""

    page: int = 1
    size: int = 12

    @property
    def offset(self) -> int:
        """Скільки записів пропустити: для 3-ї сторінки по 12 — перші 24."""
        return (self.page - 1) * self.size


def paginate(db: Session, statement: Select, params: PageParams) -> dict:
    """Виконує запит для однієї сторінки й рахує загальну кількість.

    Повертає словник у форматі схеми Page: items, total, page, size, pages.
    Лічильник будується з того самого запиту (ті самі WHERE), тому total завжди
    відповідає списку. order_by(None) прибирає сортування: для підрахунку воно не потрібне.
    """
    count_statement = select(func.count()).select_from(statement.order_by(None).subquery())
    total = db.scalar(count_statement) or 0
    items = db.scalars(statement.limit(params.size).offset(params.offset)).all()
    return {
        'items': items,
        'total': total,
        'page': params.page,
        'size': params.size,
        'pages': ceil(total / params.size) if total else 0,
    }
