"""Адмін-панель: керування товарами й категоріями (створення, зміна, видалення)."""

import sqlite3

from flask import Blueprint, abort, flash, redirect, render_template, request, url_for

from models.catalog import get_categories, get_product
from models.catalog_admin import (
    create_category, create_product, delete_category, delete_product, get_all_products,
    get_categories_with_counts, get_category, rename_category, update_product,
)
from security import require_admin
from validators import to_int

admin_catalog_bp = Blueprint('admin_catalog', __name__, url_prefix='/admin')
admin_catalog_bp.before_request(require_admin)


# ==================== Товари ====================

def _read_product_form():
    """Читає поля форми товару й перевіряє їх. Повертає (дані форми, список помилок)."""
    form = {
        'name': request.form.get('name', '').strip(),
        'category_id': request.form.get('category_id', ''),
        'price': request.form.get('price', '').strip(),
        'image': request.form.get('image', '').strip(),
        'description': request.form.get('description', '').strip(),
        'is_featured': 1 if request.form.get('is_featured') else 0,   # прапорець: є у формі = 1
    }
    errors = []
    if len(form['name']) < 3:
        errors.append('Назва має містити щонайменше 3 символи.')
    category_id = to_int(form['category_id'])
    if category_id is None or get_category(category_id) is None:
        errors.append('Оберіть категорію зі списку.')
    price = to_int(form['price'])
    if price is None or price <= 0:
        errors.append('Ціна має бути цілим додатним числом.')
    if not form['image'].startswith(('http://', 'https://')):
        errors.append('Адреса картинки має починатися з http:// або https://.')
    if len(form['description']) > 1000:
        errors.append('Опис задовгий: не більше 1000 символів.')
    return form, errors


@admin_catalog_bp.route('/products')
def products():
    """Таблиця всіх товарів з кнопками «Редагувати» і «Видалити»."""
    return render_template('admin/products.html', products=get_all_products())


@admin_catalog_bp.route('/products/new', methods=['GET', 'POST'])
def product_new():
    """Додавання товару: GET показує порожню форму, POST зберігає товар."""
    form = {'name': '', 'category_id': '', 'price': '', 'image': '', 'description': '', 'is_featured': 0}
    if request.method == 'POST':
        form, errors = _read_product_form()
        if not errors:
            create_product(int(form['category_id']), form['name'], form['description'],
                           int(form['price']), form['image'], form['is_featured'])
            flash(f'Товар «{form["name"]}» додано.', 'success')
            return redirect(url_for('admin_catalog.products'))
        for error in errors:
            flash(error, 'error')
    return render_template('admin/product_form.html', form=form, categories=get_categories(), product=None)


@admin_catalog_bp.route('/products/<int:product_id>/edit', methods=['GET', 'POST'])
def product_edit(product_id):
    """Зміна товару: у форму підставляються поточні значення."""
    product = get_product(product_id)
    if product is None:
        abort(404)
    form = {
        'name': product['name'], 'category_id': product['category_id'], 'price': product['price'],
        'image': product['image'], 'description': product['description'],
        'is_featured': product['is_featured'],
    }
    if request.method == 'POST':
        form, errors = _read_product_form()
        if not errors:
            update_product(product_id, int(form['category_id']), form['name'], form['description'],
                           int(form['price']), form['image'], form['is_featured'])
            flash(f'Зміни до товару «{form["name"]}» збережено.', 'success')
            return redirect(url_for('admin_catalog.products'))
        for error in errors:
            flash(error, 'error')
    return render_template('admin/product_form.html', form=form, categories=get_categories(), product=product)


@admin_catalog_bp.route('/products/<int:product_id>/delete', methods=['POST'])
def product_delete(product_id):
    """Видалення товару. Лише POST: видаляти за посиланням (GET) небезпечно."""
    product = get_product(product_id)
    if product is None:
        abort(404)
    try:
        delete_product(product_id)
    except sqlite3.IntegrityError:
        # ON DELETE RESTRICT: товар лежить у чиємусь замовленні, база не дає його видалити
        flash(f'Товар «{product["name"]}» не можна видалити: він використовується в замовленнях.', 'error')
    else:
        flash(f'Товар «{product["name"]}» видалено.', 'success')
    return redirect(url_for('admin_catalog.products'))


# ==================== Категорії ====================

@admin_catalog_bp.route('/categories')
def categories():
    """Список категорій з кількістю товарів і формою додавання нової."""
    return render_template('admin/categories.html', categories=get_categories_with_counts())


@admin_catalog_bp.route('/categories/new', methods=['POST'])
def category_new():
    """Додавання категорії з форми на сторінці списку."""
    name = request.form.get('name', '').strip()
    if len(name) < 2:
        flash('Назва категорії має містити щонайменше 2 символи.', 'error')
    else:
        try:
            create_category(name)
        except sqlite3.IntegrityError:
            flash(f'Категорія «{name}» уже існує.', 'error')     # стовпець name має UNIQUE
        else:
            flash(f'Категорію «{name}» додано.', 'success')
    return redirect(url_for('admin_catalog.categories'))


@admin_catalog_bp.route('/categories/<int:category_id>/edit', methods=['GET', 'POST'])
def category_edit(category_id):
    """Перейменування категорії."""
    category = get_category(category_id)
    if category is None:
        abort(404)
    name = category['name']
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        if len(name) < 2:
            flash('Назва категорії має містити щонайменше 2 символи.', 'error')
        else:
            try:
                rename_category(category_id, name)
            except sqlite3.IntegrityError:
                flash(f'Категорія «{name}» уже існує.', 'error')
            else:
                flash('Назву категорії змінено.', 'success')
                return redirect(url_for('admin_catalog.categories'))
    return render_template('admin/category_form.html', category=category, name=name)


@admin_catalog_bp.route('/categories/<int:category_id>/delete', methods=['POST'])
def category_delete(category_id):
    """Видалення категорії. Непорожню категорію база видалити не дає."""
    category = get_category(category_id)
    if category is None:
        abort(404)
    try:
        delete_category(category_id)
    except sqlite3.IntegrityError:
        # ON DELETE RESTRICT: у категорії є товари
        flash(f'У категорії «{category["name"]}» є товари. Спочатку перенесіть або видаліть їх.', 'error')
    else:
        flash(f'Категорію «{category["name"]}» видалено.', 'success')
    return redirect(url_for('admin_catalog.categories'))
