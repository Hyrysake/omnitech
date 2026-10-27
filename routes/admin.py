"""Адмін-панель: головна сторінка зі статистикою. Розділи зі списками лежать у сусідніх модулях."""

from flask import Blueprint, render_template, request

from models.catalog_admin import count_categories, count_products
from models.feedback import count_unread_feedback
from models.users import count_users
from security import require_admin

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')
# Одна перевірка на весь blueprint: жоден маршрут адмінки неможливо «забути» захистити
admin_bp.before_request(require_admin)


@admin_bp.route('')
def dashboard():
    """Огляд: скільки в магазині товарів, категорій і користувачів."""
    stats = {
        'products': count_products(),
        'categories': count_categories(),
        'users': count_users(),
    }
    return render_template('admin/dashboard.html', stats=stats)


@admin_bp.app_context_processor
def inject_admin_counters():
    """Числа для значків у бічному меню адмінки. Рахуються лише на сторінках адмінки,
    а решта сайту ці запити не виконує."""
    if not (request.blueprint or '').startswith('admin'):
        return {}
    return {
        'unread_feedback': count_unread_feedback(),
    }
