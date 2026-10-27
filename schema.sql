-- Схема бази даних OmniTech.
-- CREATE TABLE IF NOT EXISTS означає «створити таблицю, якщо її ще немає», тому файл можна
-- виконувати при кожному запуску: нові таблиці з'являються самі, наявні дані не зникають.
-- Кожен PR додає в цей файл лише свої таблиці.

-- Категорії товарів: «Ноутбуки», «Смартфони» тощо.
CREATE TABLE IF NOT EXISTS categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,   -- первинний ключ: унікальний номер рядка
    name TEXT NOT NULL UNIQUE                 -- назва не може повторюватися
);

-- Товари. Кожен товар належить одній категорії (зв'язок «один до багатьох»).
CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    -- зовнішній ключ: category_id має збігатися з id якоїсь категорії.
    -- RESTRICT забороняє видалити категорію, у якій ще є товари
    category_id INTEGER NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    price       INTEGER NOT NULL CHECK (price > 0),          -- ціна в гривнях, ціле число
    image       TEXT    NOT NULL DEFAULT '',                 -- адреса картинки
    is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1))  -- 1 = показувати на головній
);

-- Індекс прискорює пошук товарів за категорією (фільтр у каталозі).
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);

-- Користувачі сайту. Пароль зберігається лише у вигляді хеша, ніколи відкритим текстом.
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Відгуки з форми на сторінці «Контакти».
CREATE TABLE IF NOT EXISTS feedback (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    NOT NULL,
    message    TEXT    NOT NULL,
    is_read    INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),   -- 0 = нове, 1 = прочитане
    created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Замовлення. user_id порожній (NULL), якщо оформив гість без акаунта.
-- SET NULL: коли користувача видаляють, його замовлення лишаються, а зв'язок обнуляється.
CREATE TABLE IF NOT EXISTS orders (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER REFERENCES users (id) ON DELETE SET NULL,
    customer_name TEXT    NOT NULL,
    phone         TEXT    NOT NULL,
    email         TEXT    NOT NULL,
    address       TEXT    NOT NULL,
    total         INTEGER NOT NULL CHECK (total >= 0),
    status        TEXT    NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'processing', 'shipped', 'completed', 'cancelled')),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Рядки замовлення. Це «проміжна» таблиця, яка реалізує зв'язок «багато до багатьох»:
-- одне замовлення містить багато товарів, а один товар трапляється в багатьох замовленнях.
-- CASCADE: разом із замовленням видаляються його рядки.
-- price — ціна товару на момент покупки: пізніша зміна ціни не перепише старі замовлення.
CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders (id)   ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
    quantity   INTEGER NOT NULL CHECK (quantity > 0),
    price      INTEGER NOT NULL CHECK (price > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
