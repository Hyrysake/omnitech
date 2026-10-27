"""Кошик і оформлення замовлення.

Кошик зберігається в сесії (підписаному cookie браузера) як словник
{номер товару: кількість}. Ціни в сесію НЕ записуємо: при показі кошика й під час оформлення
вони щоразу беруться з бази, тож підмінити ціну через cookie неможливо.
"""

from flask import Blueprint, abort, flash, g, redirect, render_template, request, session, url_for

from models.catalog import get_product, get_products_by_ids
from models.orders import create_order, get_order, get_order_items
from security import safe_next_url
from validators import is_valid_email, is_valid_phone, to_int

cart_bp = Blueprint('cart', __name__)

MAX_QUANTITY = 99     # більше штук одного товару в кошик не покласти


def _get_cart():
    """Кошик із сесії. Ключі — рядки, бо сесія зберігається у форматі JSON."""
    cart = session.get('cart')
    return cart if isinstance(cart, dict) else {}


def cart_item_count():
    """Скільки штук лежить у кошику (число біля іконки в шапці сайту)."""
    return sum(quantity for quantity in _get_cart().values() if isinstance(quantity, int))


def _cart_lines():
    """Рядки кошика з актуальними даними з бази. Повертає (рядки, загальна сума).

    Товар, який адмін видалив після додавання в кошик, у списку просто пропускається.
    """
    cart = _get_cart()
    ids = [int(key) for key in cart if key.isdigit()]
    products = {product['id']: product for product in get_products_by_ids(ids)}
    lines = []
    for key, quantity in cart.items():
        product = products.get(int(key)) if key.isdigit() else None
        if product is None or not isinstance(quantity, int) or quantity < 1:
            continue
        lines.append({'product': product, 'quantity': quantity, 'line_total': product['price'] * quantity})
    return lines, sum(line['line_total'] for line in lines)


@cart_bp.route('/cart')
def view():
    """Сторінка кошика."""
    lines, total = _cart_lines()
    return render_template('cart.html', lines=lines, total=total)


@cart_bp.route('/cart/add/<int:product_id>', methods=['POST'])
def add(product_id):
    """Додає товар у кошик і повертає людину на ту сторінку, з якої вона натиснула кнопку."""
    product = get_product(product_id)
    if product is None:
        abort(404)
    quantity = to_int(request.form.get('quantity')) or 1
    cart = dict(_get_cart())
    key = str(product_id)
    cart[key] = max(1, min(MAX_QUANTITY, cart.get(key, 0) + quantity))
    session['cart'] = cart
    flash(f'«{product["name"]}» додано в кошик.', 'success')
    return redirect(safe_next_url(request.form.get('next')) or url_for('cart.view'))


@cart_bp.route('/cart/update/<int:product_id>', methods=['POST'])
def update(product_id):
    """Змінює кількість товару в кошику; нуль або менше прибирає рядок."""
    cart = dict(_get_cart())
    key = str(product_id)
    quantity = to_int(request.form.get('quantity'))
    if key in cart and quantity is not None:
        if quantity < 1:
            del cart[key]
        else:
            cart[key] = min(MAX_QUANTITY, quantity)
        session['cart'] = cart
    return redirect(url_for('cart.view'))


@cart_bp.route('/cart/remove/<int:product_id>', methods=['POST'])
def remove(product_id):
    """Прибирає товар із кошика."""
    cart = dict(_get_cart())
    if cart.pop(str(product_id), None) is not None:
        session['cart'] = cart
    return redirect(url_for('cart.view'))


@cart_bp.route('/checkout', methods=['GET', 'POST'])
def checkout():
    """Оформлення замовлення. Гість теж може купити: акаунт не обов'язковий."""
    lines, total = _cart_lines()
    if not lines:
        flash('Кошик порожній. Додайте товари, щоб оформити замовлення.', 'error')
        return redirect(url_for('shop.catalog'))

    # Залогінений клієнт отримує поля вже заповненими своїми даними
    form = {
        'name': g.user['name'] if g.user else '',
        'phone': '',
        'email': g.user['email'] if g.user else '',
        'address': '',
    }
    if request.method == 'POST':
        for field in form:
            form[field] = request.form.get(field, '').strip()
        errors = []
        if len(form['name']) < 2:
            errors.append('Вкажіть ім\'я (щонайменше 2 літери).')
        if not is_valid_phone(form['phone']):
            errors.append('Вкажіть коректний номер телефону, наприклад +380501234567.')
        if not is_valid_email(form['email']):
            errors.append('Вкажіть коректну адресу пошти, наприклад name@example.com.')
        if len(form['address']) < 5:
            errors.append('Вкажіть адресу доставки (щонайменше 5 символів).')

        if not errors:
            order_lines = [(line['product']['id'], line['quantity'], line['product']['price']) for line in lines]
            order_id = create_order(g.user['id'] if g.user else None, form['name'], form['phone'],
                                    form['email'], form['address'], order_lines)
            session.pop('cart', None)
            # Номер замовлення запам'ятовуємо в сесії: сторінку «Дякуємо» покаже лише його власнику
            session['last_order_id'] = order_id
            return redirect(url_for('cart.done'))
        for error in errors:
            flash(error, 'error')
    return render_template('checkout.html', lines=lines, total=total, form=form)


@cart_bp.route('/order/done')
def done():
    """Сторінка «Дякуємо за замовлення». Показує лише останнє замовлення цього браузера."""
    order_id = session.get('last_order_id')
    order = get_order(order_id) if order_id else None
    if order is None:
        return redirect(url_for('shop.catalog'))
    return render_template('order_done.html', order=order, items=get_order_items(order['id']))
