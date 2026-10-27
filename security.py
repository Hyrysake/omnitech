"""Вхід у систему: хто зараз користується сайтом і хто має право заходити в адмінку."""

from flask import abort, flash, g, redirect, request, session, url_for

from models.users import get_user_by_id


def load_logged_in_user():
    """Виконується перед кожним запитом: кладе поточного користувача в g.user (або None).

    У сесії (підписаному cookie браузера) зберігається лише номер користувача.
    Усі інші дані щоразу беремо з бази, тож зміна ролі чи видалення акаунта діє одразу.
    """
    user_id = session.get('user_id')
    g.user = get_user_by_id(user_id) if user_id is not None else None
    if user_id is not None and g.user is None:
        session.pop('user_id')      # акаунт видалили, а номер у cookie лишився


def safe_next_url(url):
    """Повертає адресу, якщо вона веде всередину нашого сайту, інакше None.

    Після входу ми повертаємо людину на сторінку, з якої вона прийшла (параметр next).
    Без перевірки зловмисник міг би підставити next=https://чужий-сайт, і ми відправили б
    користувача туди (атака «відкрите перенаправлення»).
    """
    if not url:
        return None
    url = url.rstrip('?')       # request.full_path без параметрів закінчується на «?»
    if url.startswith('/') and not url.startswith('//') and '\\' not in url:
        return url
    return None


def require_admin():
    """Пропускає в розділ лише адміністратора. Підключається до blueprint-ів адмін-панелі.

    Гість потрапляє на сторінку входу, а залогінений клієнт отримує помилку 403.
    Якщо функція повертає відповідь, Flask віддає її замість сторінки.
    """
    if g.user is None:
        flash('Увійдіть як адміністратор, щоб відкрити адмін-панель.', 'error')
        # Повертатися після входу можна лише на сторінку, яку відкривають через GET
        next_url = request.full_path if request.method == 'GET' else None
        return redirect(url_for('auth.login', next=next_url))
    if g.user['role'] != 'admin':
        abort(403)
