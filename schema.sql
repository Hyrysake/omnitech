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
