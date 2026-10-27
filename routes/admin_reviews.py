"""Адмін-панель: модерація відгуків про товари."""

from flask import Blueprint, flash, redirect, render_template, url_for

from models.reviews import delete_review, get_all_reviews
from security import require_admin

admin_reviews_bp = Blueprint('admin_reviews', __name__, url_prefix='/admin/reviews')
admin_reviews_bp.before_request(require_admin)


@admin_reviews_bp.route('')
def reviews():
    """Усі відгуки про товари, найновіші першими."""
    return render_template('admin/reviews.html', items=get_all_reviews())


@admin_reviews_bp.route('/<int:review_id>/delete', methods=['POST'])
def review_delete(review_id):
    """Видаляє відгук (наприклад, образливий). Лише POST."""
    delete_review(review_id)
    flash('Відгук видалено.', 'success')
    return redirect(url_for('admin_reviews.reviews'))
