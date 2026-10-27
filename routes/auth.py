"""Реєстрація, вхід і вихід."""

import sqlite3

from flask import Blueprint, flash, g, redirect, render_template, request, session, url_for

from models.users import check_password, create_user, get_user_by_email
from security import safe_next_url
from validators import is_valid_email

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    """Реєстрація: GET показує форму, POST обробляє її."""
    if g.user:
        return redirect(url_for('home'))

    form = {'name': '', 'email': ''}      # значення, які підставимо назад у форму, якщо є помилки
    if request.method == 'POST':
        form['name'] = request.form.get('name', '').strip()
        form['email'] = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        password_repeat = request.form.get('password_repeat', '')

        errors = []
        if len(form['name']) < 2:
            errors.append('Вкажіть ім\'я (щонайменше 2 літери).')
        if not is_valid_email(form['email']):
            errors.append('Вкажіть коректну адресу пошти, наприклад name@example.com.')
        if len(password) < 6:
            errors.append('Пароль має містити щонайменше 6 символів.')
        if password != password_repeat:
            errors.append('Паролі не збігаються.')

        if not errors:
            try:
                user_id = create_user(form['name'], form['email'], password)
            except sqlite3.IntegrityError:
                # Стовпець email має обмеження UNIQUE: така пошта вже є в базі
                errors.append('Акаунт із такою поштою вже існує. Спробуйте увійти.')
            else:
                session['user_id'] = user_id         # реєстрація одразу виконує вхід
                flash(f'Вітаємо, {form["name"]}! Акаунт створено.', 'success')
                return redirect(safe_next_url(request.values.get('next')) or url_for('home'))

        for error in errors:
            flash(error, 'error')
    return render_template('register.html', form=form, next_url=request.values.get('next', ''))


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Вхід: GET показує форму, POST перевіряє пошту й пароль."""
    if g.user:
        return redirect(url_for('home'))

    email = ''
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        user = get_user_by_email(email)
        # Повідомлення однакове для «немає такої пошти» і «неправильний пароль»,
        # щоб не підказувати стороннім, які адреси зареєстровані
        if user is None or not check_password(user, password):
            flash('Невірна пошта або пароль.', 'error')
        else:
            session['user_id'] = user['id']
            flash(f'Ви увійшли як {user["name"]}.', 'success')
            return redirect(safe_next_url(request.values.get('next')) or url_for('home'))
    return render_template('login.html', email=email, next_url=request.values.get('next', ''))


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Вихід. Лише POST: посилання (GET) не повинно змінювати стан сайту."""
    session.pop('user_id', None)
    flash('Ви вийшли з акаунта.', 'success')
    return redirect(url_for('home'))
