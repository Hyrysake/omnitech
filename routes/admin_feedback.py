"""Адмін-панель: модерація відгуків із форми на сторінці «Контакти»."""

from flask import Blueprint, flash, redirect, render_template, request, url_for

from models.feedback import delete_feedback, get_all_feedback, set_feedback_read
from security import require_admin

admin_feedback_bp = Blueprint('admin_feedback', __name__, url_prefix='/admin/feedback')
admin_feedback_bp.before_request(require_admin)


@admin_feedback_bp.route('')
def feedback_list():
    """Усі відгуки: непрочитані зверху."""
    return render_template('admin/feedback.html', items=get_all_feedback())


@admin_feedback_bp.route('/<int:feedback_id>/read', methods=['POST'])
def feedback_read(feedback_id):
    """Позначає відгук прочитаним або повертає його в непрочитані (залежно від поля is_read)."""
    set_feedback_read(feedback_id, request.form.get('is_read') == '1')
    return redirect(url_for('admin_feedback.feedback_list'))


@admin_feedback_bp.route('/<int:feedback_id>/delete', methods=['POST'])
def feedback_delete(feedback_id):
    """Видаляє відгук назавжди."""
    delete_feedback(feedback_id)
    flash('Відгук видалено.', 'success')
    return redirect(url_for('admin_feedback.feedback_list'))
