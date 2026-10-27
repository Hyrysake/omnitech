"""
OmniTech — інтернет-магазин електроніки (навчальний проєкт).
Лабораторна робота 04 «Реалізація бази даних для вебпроєкту», ОПІ, група ІПЗ-22.

Як це працює: кожна сторінка сайту — це маршрут (route).
Маршрут зв'язує адресу в браузері (наприклад, /about) з функцією Python,
а функція повертає HTML-сторінку, зібрану з шаблону в теці templates/.
Дані магазину (товари, категорії, користувачі, замовлення) зберігаються в базі даних SQLite:
файл db.sqlite створюється сам під час першого запуску, структура лежить у schema.sql,
а початкові дані — у seed_data.py.
"""

import os

from flask import Flask, render_template
from flask import flash, g, redirect, request, url_for

import db
from models.catalog import get_featured_products
from models.feedback import add_feedback, validate_feedback
from routes.shop import shop_bp
from routes.auth import auth_bp
from security import load_logged_in_user
from routes.admin import admin_bp
from routes.admin_catalog import admin_catalog_bp
from routes.admin_feedback import admin_feedback_bp
from routes.admin_orders import admin_orders_bp
from routes.cart import cart_bp, cart_item_count

# Створюємо застосунок. Змінна __name__ підказує Flask, де лежить цей файл,
# щоб він знайшов поруч теку templates/ з HTML-шаблонами.
app = Flask(__name__)

# Файл бази лежить поруч з app.py. Шлях можна підмінити змінною середовища OMNITECH_DB
# (так перевіряють роботу сайту на тимчасовій базі, не чіпаючи справжню).
app.config['DATABASE'] = os.environ.get('OMNITECH_DB') or os.path.join(app.root_path, 'db.sqlite')

# Ключ, яким Flask підписує cookie сесії. Без підпису користувач міг би підробити в cookie
# номер чужого акаунта. У справжньому проєкті ключ задають змінною середовища SECRET_KEY,
# а запасне значення нижче годиться лише для навчання.
app.secret_key = os.environ.get('SECRET_KEY') or 'omnitech-dev-key-change-me'
# Браузер не надсилає cookie сесії з запитами, які ініційовано чужими сайтами (захист від CSRF)
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Підключаємо базу: закривати з'єднання після кожного запиту й створити таблиці, якщо їх ще немає
db.init_app(app)
with app.app_context():
    db.init_db()

# Blueprint — окремий файл зі своїми маршрутами. Підключаємо їх до застосунку.
app.register_blueprint(shop_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(admin_catalog_bp)
app.register_blueprint(admin_feedback_bp)
app.register_blueprint(admin_orders_bp)
app.register_blueprint(cart_bp)

# Перед кожним запитом з'ясовуємо, хто зараз користується сайтом (результат лежить у g.user)
app.before_request(load_logged_in_user)


@app.context_processor
def inject_cart_count():
    """Робить змінну cart_count доступною в усіх шаблонах (число біля іконки кошика в шапці)."""
    return {'cart_count': cart_item_count()}


@app.template_filter('money')
def money(value):
    """Фільтр для шаблонів: 32999 -> «32 999». Використання: {{ product.price|money }} грн."""
    return f'{value:,}'.replace(',', ' ')


# ==================== Головна сторінка ====================

@app.route('/')
def home():
    """Головна сторінка: вітальний банер, переваги магазину, популярні товари."""
    # Популярні товари тепер читаються з бази, а не зі списку в коді
    return render_template('home.html', products=get_featured_products())


# ==================== Сторінка «Про нас» ====================

@app.route('/about')
def about():
    """Сторінка «Про нас»: історія магазину, цінності, команда проєкту."""
    return render_template('about.html')


# ==================== Сторінка «Контакти» ====================

# Контактні дані зібрані в одному словнику: щоб змінити телефон чи адресу,
# достатньо виправити їх тут, а не шукати по HTML.
CONTACTS = {
    "address": "м. Луцьк, просп. Волі, 1",
    "phone": "+38 (050) 123-45-67",
    "phone_link": "+380501234567",          # той самий номер без пробілів — для посилання tel:
    "email": "support@omnitech.example",    # домен .example зарезервований для прикладів
    "schedule": [
        {"days": "Понеділок-п'ятниця", "hours": "09:00-20:00"},
        {"days": "Субота", "hours": "10:00-18:00"},
        {"days": "Неділя", "hours": "вихідний"},
    ],
    # Вбудована карта OpenStreetMap: bbox — межі ділянки карти (довгота і широта двох кутів),
    # marker — точка магазину. Координати адреси просп. Волі, 1 перевірено геокодером OSM (Nominatim)
    "map_url": (
        "https://www.openstreetmap.org/export/embed.html"
        "?bbox=25.3215%2C50.7454%2C25.3315%2C50.7494&layer=mapnik&marker=50.7474%2C25.3265"
    ),
}


@app.route('/contacts', methods=['GET', 'POST'])
def contacts():
    """Сторінка «Контакти»: адреса, телефон, email, графік роботи, карта і форма відгуку.

    GET показує сторінку. POST приймає форму: якщо все гаразд, зберігає відгук у базу
    і перенаправляє назад (патерн PRG: Post -> Redirect -> Get), щоб оновлення сторінки
    не відправило ту саму форму вдруге.
    """
    form = {'name': '', 'email': '', 'message': ''}
    errors = []
    if request.method == 'POST':
        for field in form:
            form[field] = request.form.get(field, '').strip()
        errors = validate_feedback(form['name'], form['email'], form['message'])
        if not errors:
            add_feedback(form['name'], form['email'], form['message'])
            flash('Дякуємо! Ваше повідомлення отримано, ми відповімо протягом робочого дня.', 'success')
            return redirect(url_for('contacts'))
    elif g.user:
        # Залогінений користувач не вводить ім'я та пошту вдруге
        form['name'] = g.user['name']
        form['email'] = g.user['email']
    # Помилки показуємо просто над формою (errors), а не вгорі сторінки, щоб їх було видно одразу
    return render_template('contacts.html', contacts=CONTACTS, form=form, errors=errors)


# ==================== Сторінка «Часті питання» (FAQ) ====================

# Список питань і відповідей. Щоб додати нове питання, достатньо дописати
# ще один словник — шаблон сам згенерує для нього блок завдяки циклу for.
FAQ = [
    {
        "question": "Скільки триває доставка?",
        "answer": "Доставка Новою поштою займає 1-2 дні. По Луцьку працює кур'єр: "
                  "замовлення, оформлене до 14:00, привеземо того ж дня.",
    },
    {
        "question": "Які способи оплати ви приймаєте?",
        "answer": "Карткою на сайті, накладеним платежем у відділенні Нової пошти "
                  "або готівкою чи карткою в нашому магазині.",
    },
    {
        "question": "Чи є гарантія на техніку?",
        "answer": "Так. Уся техніка має офіційну гарантію виробника від 12 місяців. "
                  "Гарантійний талон видаємо разом із товаром.",
    },
    {
        "question": "Чи можна повернути товар?",
        "answer": "Так, протягом 14 днів після покупки, якщо товар не був у використанні "
                  "і збережено упаковку та чек.",
    },
    {
        "question": "Чи можна забрати замовлення самостійно?",
        "answer": "Так. Оберіть «Самовивіз» під час оформлення, і ми напишемо, "
                  "коли замовлення буде готове до видачі в магазині.",
    },
    {
        "question": "Чи допоможете налаштувати новий пристрій?",
        "answer": "Так. Під час видачі консультант безкоштовно перенесе дані зі старого "
                  "телефона та налаштує основні програми.",
    },
]


@app.route('/faq')
def faq():
    """Сторінка «Часті питання»: список питань, що розгортаються по кліку."""
    return render_template('faq.html', faq_items=FAQ)


# ==================== Сторінки помилок ====================

@app.errorhandler(404)
def page_not_found(error):
    """Сторінка не знайдена (наприклад, товару з таким номером немає)."""
    return render_template('error.html', code=404, title='Сторінку не знайдено',
                           text='Можливо, адресу введено з помилкою або товар уже прибрали з каталогу.'), 404


@app.errorhandler(403)
def forbidden(error):
    """Доступ заборонено (клієнт намагається відкрити адмін-панель)."""
    return render_template('error.html', code=403, title='Доступ заборонено',
                           text='Цей розділ доступний лише адміністратору магазину.'), 403


# ==================== Запуск ====================

# Цей блок виконується лише тоді, коли файл запущено напряму (python app.py),
# а не імпортовано з іншого файлу.
if __name__ == '__main__':
    # debug=True: автоматичний перезапуск після змін у коді та детальні повідомлення про помилки.
    # Використовується лише під час розробки.
    app.run(debug=True)
