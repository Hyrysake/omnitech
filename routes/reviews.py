"""Відгуки покупців про товари: додати чи змінити свій відгук і видалити його."""

from flask import Blueprint, abort, flash, g, redirect, request, url_for

from models.catalog import get_product
from models.reviews import delete_user_review, save_review, validate_review
from routes.shop import render_product_page

reviews_bp = Blueprint('reviews', __name__)


def _login_redirect(product_id):
    """Гостя відправляємо входити й після входу повертаємо на сторінку цього товару."""
    flash('Увійдіть в акаунт, щоб залишити відгук.', 'error')
    return redirect(url_for('auth.login', next=url_for('shop.product', product_id=product_id)))


@reviews_bp.route('/product/<int:product_id>/review', methods=['GET', 'POST'])
def save(product_id):
    """Зберігає відгук. Форма стоїть на сторінці товару, тому помилки показуємо там само."""
    if get_product(product_id) is None:
        abort(404)
    if request.method == 'GET':
        # Сюди можна потрапити лише повторним відкриттям адреси: показуємо сторінку товару
        return redirect(url_for('shop.product', product_id=product_id))
    if g.user is None:
        return _login_redirect(product_id)

    form = {'rating': request.form.get('rating', ''), 'text': request.form.get('text', '').strip()}
    rating, errors = validate_review(form['rating'], form['text'])
    if errors:
        # Показуємо сторінку товару знову: з введеним текстом і списком помилок над формою
        return render_product_page(product_id, review_form=form, review_errors=errors)

    save_review(product_id, g.user, rating, form['text'])
    flash('Дякуємо! Ваш відгук збережено.', 'success')
    return redirect(url_for('shop.product', product_id=product_id))


@reviews_bp.route('/product/<int:product_id>/review/delete', methods=['POST'])
def delete(product_id):
    """Видаляє відгук поточного користувача (чужі видаляти може лише адмін в адмін-панелі)."""
    if get_product(product_id) is None:
        abort(404)
    if g.user is None:
        return _login_redirect(product_id)
    delete_user_review(product_id, g.user['id'])
    flash('Ваш відгук видалено.', 'success')
    return redirect(url_for('shop.product', product_id=product_id))
