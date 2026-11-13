"""Логіка каталогу: категорії, товари, пошук і фільтри, рейтинги."""

from dataclasses import dataclass

from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import BadRequestError, ConflictError, NotFoundError, UnprocessableError
from app.db.pagination import PageParams, paginate
from app.models import Category, Product, Review
from app.schemas.catalog import CategoryIn, ProductCreate, ProductSort, ProductUpdate
from app.services import media

# ---------- Категорії ----------


def list_categories(db: Session) -> list[dict]:
    """Усі категорії з кількістю товарів. LEFT JOIN (isouter) — щоб порожні категорії теж потрапили."""
    rows = db.execute(
        select(Category.id, Category.name, func.count(Product.id).label('product_count'))
        .join(Product, Product.category_id == Category.id, isouter=True)
        .group_by(Category.id)
        .order_by(Category.id)
    ).all()
    return [row._asdict() for row in rows]


def get_category(db: Session, category_id: int) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise NotFoundError('Категорію не знайдено.')
    return category


def _check_category_name_free(db: Session, name: str, except_id: int | None = None) -> None:
    """Назви «Ноутбуки» і «ноутбуки» вважаємо однаковими."""
    existing = db.scalar(select(Category.id).where(func.lower(Category.name) == name.lower()))
    if existing is not None and existing != except_id:
        raise ConflictError('Категорія з такою назвою вже існує.')


def create_category(db: Session, data: CategoryIn) -> Category:
    _check_category_name_free(db, data.name)
    category = Category(name=data.name)
    db.add(category)
    db.commit()
    return category


def rename_category(db: Session, category_id: int, data: CategoryIn) -> Category:
    category = get_category(db, category_id)
    _check_category_name_free(db, data.name, except_id=category_id)
    category.name = data.name
    db.commit()
    return category


def delete_category(db: Session, category_id: int) -> None:
    category = get_category(db, category_id)
    count = db.scalar(select(func.count(Product.id)).where(Product.category_id == category_id))
    if count:
        raise ConflictError(f'У категорії є товари ({count}). Спершу перенесіть або видаліть їх.')
    db.delete(category)
    db.commit()


# ---------- Товари: пошук і фільтри ----------

# Ключ з адреси (?sort=price_asc) -> як сортувати. Користувач обирає лише ключ,
# тож у запит потрапляє тільки наш власний варіант сортування
SORT_OPTIONS = {
    'default': (Product.is_featured.desc(), Product.id),
    'price_asc': (Product.price, Product.id),
    'price_desc': (Product.price.desc(), Product.id),
    'name': (func.lower(Product.name), Product.id),
    'newest': (Product.created_at.desc(), Product.id.desc()),
}


@dataclass
class ProductFilters:
    """Умови пошуку в каталозі. Порожнє поле (None) означає «без обмеження»."""

    q: str | None = None
    category_id: int | None = None
    min_price: int | None = None
    max_price: int | None = None
    featured: bool | None = None
    sort: ProductSort = 'default'


def build_product_query(filters: ProductFilters) -> Select:
    """Будує SELECT товарів з усіма умовами. Його використовують і v1, і v2."""
    if filters.min_price is not None and filters.max_price is not None and filters.min_price > filters.max_price:
        raise BadRequestError('Мінімальна ціна не може бути більшою за максимальну.', field='min_price')
    statement = select(Product)
    if filters.q:
        # icontains = пошук підрядка без урахування регістру. autoescape=True: символи % і _
        # у тексті пошуку шукаються як звичайні символи, а не як шаблон LIKE
        statement = statement.where(
            Product.name.icontains(filters.q, autoescape=True)
            | Product.description.icontains(filters.q, autoescape=True)
        )
    if filters.category_id is not None:
        statement = statement.where(Product.category_id == filters.category_id)
    if filters.min_price is not None:
        statement = statement.where(Product.price >= filters.min_price)
    if filters.max_price is not None:
        statement = statement.where(Product.price <= filters.max_price)
    if filters.featured is not None:
        statement = statement.where(Product.is_featured == filters.featured)
    return statement.order_by(*SORT_OPTIONS[filters.sort])


def list_products(db: Session, filters: ProductFilters, params: PageParams) -> dict:
    return paginate(db, build_product_query(filters), params)


def get_product(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise NotFoundError('Товар не знайдено.')
    return product


def rating_summary(db: Session, product_ids: list[int]) -> dict[int, dict]:
    """Середня оцінка й кількість відгуків для кількох товарів одним запитом (GROUP BY)."""
    summary = {product_id: {'average': None, 'count': 0} for product_id in product_ids}
    if not product_ids:
        return summary
    rows = db.execute(
        select(Review.product_id, func.avg(Review.rating), func.count(Review.id))
        .where(Review.product_id.in_(product_ids))
        .group_by(Review.product_id)
    ).all()
    for product_id, average, count in rows:
        summary[product_id] = {'average': round(float(average), 1), 'count': count}
    return summary


# ---------- Товари: зміни (адміністратор) ----------


def _ensure_category_exists(db: Session, category_id: int) -> None:
    if db.get(Category, category_id) is None:
        raise UnprocessableError(f'Категорії №{category_id} не існує.', field='category_id')


def _check_media_url(product: Product | None, image_url: str | None) -> None:
    """Адресу /media/... можна лише залишити такою, як є: нова з'являється тільки через завантаження файлу.

    Інакше в товар Б можна було б вписати адресу картинки товару А, і коли Б змінять чи видалять,
    файл товару А зник би з диска.
    """
    if image_url and image_url.startswith('/media/') and (product is None or image_url != product.image_url):
        raise UnprocessableError('Картинку з /media/ можна встановити лише завантаженням файлу '
                                 '(POST /products/{id}/image).', field='image_url')


def _apply_changes(db: Session, product: Product, changes: dict) -> Product:
    """Записує зміни в товар і, якщо картинку замінили, видаляє старий завантажений файл."""
    old_image = product.image_url
    for field, value in changes.items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    if old_image != product.image_url:
        media.delete_local_file(old_image)     # цей файл належав лише цьому товару (див. _check_media_url)
    return product


def create_product(db: Session, data: ProductCreate) -> Product:
    _ensure_category_exists(db, data.category_id)
    _check_media_url(None, data.image_url)
    product = Product(**data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def replace_product(db: Session, product_id: int, data: ProductCreate) -> Product:
    """PUT: замінює ВСІ поля. Чого немає в запиті — стає значенням за замовчуванням."""
    product = get_product(db, product_id)
    _ensure_category_exists(db, data.category_id)
    _check_media_url(product, data.image_url)
    return _apply_changes(db, product, data.model_dump())


def update_product(db: Session, product_id: int, data: ProductUpdate) -> Product:
    """PATCH: змінює лише передані поля (exclude_unset — поля, яких не було в запиті, пропускаємо)."""
    product = get_product(db, product_id)
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if value is None:
            raise UnprocessableError('Поле не можна очистити значенням null: просто не передавайте його.', field=field)
    if 'category_id' in changes:
        _ensure_category_exists(db, changes['category_id'])
    _check_media_url(product, changes.get('image_url'))
    return _apply_changes(db, product, changes)


def delete_product(db: Session, product_id: int) -> None:
    """Видаляє товар разом з відгуками й записами у списках бажань (CASCADE у базі).

    Товар, який є в замовленнях, база видалити не дасть (ON DELETE RESTRICT в order_items):
    ловимо IntegrityError і пояснюємо це клієнту кодом 409.
    """
    product = get_product(db, product_id)
    image = product.image_url
    db.delete(product)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()       # скасувати невдалу транзакцію, інакше сесія лишиться в стані помилки
        raise ConflictError('Товар є в замовленнях, тому його не можна видалити.')
    media.delete_local_file(image)


def set_product_image(db: Session, product_id: int, image_url: str) -> Product:
    """Записує товару нову адресу картинки (після завантаження файлу) і прибирає стару."""
    product = get_product(db, product_id)
    return _apply_changes(db, product, {'image_url': image_url})
