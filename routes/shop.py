"""Каталог товарів: пошук, фільтри і сторінка окремого товару."""

from flask import Blueprint, abort, render_template, request

from models.catalog import SORT_OPTIONS, get_categories, get_product, search_products
from validators import to_int

shop_bp = Blueprint('shop', __name__)


@shop_bp.route('/shop')
def catalog():
    """Каталог: список товарів, відфільтрований за параметрами з адреси.

    Форма пошуку відправляється методом GET, тому вибрані фільтри видно в адресі:
    /shop?q=ноутбук&category=1&sort=price_asc. Таку адресу можна зберегти чи надіслати другові.
    """
    # request.args — це параметри після «?» в адресі
    filters = {
        'q': request.args.get('q', '').strip(),
        'category': to_int(request.args.get('category')),
        'min': to_int(request.args.get('min')),
        'max': to_int(request.args.get('max')),
        'sort': request.args.get('sort', 'default'),
    }
    products = search_products(
        query=filters['q'],
        category_id=filters['category'],
        min_price=filters['min'],
        max_price=filters['max'],
        sort=filters['sort'],
    )
    # Чи вибрано хоч один фільтр: від цього залежить, що показати, коли нічого не знайдено
    is_filtered = bool(filters['q'] or filters['category'] is not None
                       or filters['min'] is not None or filters['max'] is not None)
    return render_template(
        'shop.html',
        products=products,
        categories=get_categories(),
        sort_options=SORT_OPTIONS,
        filters=filters,
        is_filtered=is_filtered,
    )


@shop_bp.route('/product/<int:product_id>')
def product(product_id):
    """Сторінка одного товару. <int:product_id> бере номер з адреси: /product/5."""
    item = get_product(product_id)
    if item is None:
        abort(404)      # такого товару немає: відповідаємо «Сторінку не знайдено»
    # Інші товари тієї самої категорії, без поточного
    similar = [p for p in search_products(category_id=item['category_id']) if p['id'] != item['id']][:4]
    return render_template('product.html', product=item, similar=similar)
