"""Адмін-панель: перегляд замовлень, зміна їх статусу і видалення."""

from flask import Blueprint, abort, flash, redirect, render_template, request, url_for

from models.orders import (
    ORDER_STATUSES, delete_order, get_order, get_order_items, get_orders, update_order_status,
)
from security import require_admin

admin_orders_bp = Blueprint('admin_orders', __name__, url_prefix='/admin/orders')
admin_orders_bp.before_request(require_admin)


@admin_orders_bp.route('')
def orders():
    """Список замовлень. Параметр ?status=new залишає лише замовлення з цим статусом."""
    status = request.args.get('status', '')
    if status not in ORDER_STATUSES:
        status = ''
    return render_template('admin/orders.html', orders=get_orders(status or None),
                           statuses=ORDER_STATUSES, current_status=status)


@admin_orders_bp.route('/<int:order_id>')
def order_detail(order_id):
    """Одне замовлення: дані покупця, склад і форма зміни статусу."""
    order = get_order(order_id)
    if order is None:
        abort(404)
    return render_template('admin/order_detail.html', order=order, items=get_order_items(order_id),
                           statuses=ORDER_STATUSES)


@admin_orders_bp.route('/<int:order_id>/status', methods=['POST'])
def order_status(order_id):
    """Зберігає новий статус замовлення."""
    if get_order(order_id) is None:
        abort(404)
    if update_order_status(order_id, request.form.get('status', '')):
        flash('Статус замовлення змінено.', 'success')
    else:
        flash('Невідомий статус.', 'error')
    return redirect(url_for('admin_orders.order_detail', order_id=order_id))


@admin_orders_bp.route('/<int:order_id>/delete', methods=['POST'])
def order_delete(order_id):
    """Видаляє замовлення разом з його рядками (каскадно)."""
    if get_order(order_id) is None:
        abort(404)
    delete_order(order_id)
    flash(f'Замовлення №{order_id} видалено.', 'success')
    return redirect(url_for('admin_orders.orders'))
