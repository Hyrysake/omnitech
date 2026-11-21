# Тести: Бардюк Станіслав

Таблиці тестів учасника (лабораторна 07). Загальний опис, запуск, результати й покриття команди — у [TESTING.md](../TESTING.md).

## Unit тести (Станіслав)

| Тест | Що перевіряє | Очікуваний результат |
|---|---|---|
| `test_image_url_accepts_valid_values` | Адреса картинки: порожня, http, https, наш `/media/products/<32 hex>.png/jpg/webp` | Адреса повертається без змін |
| `test_image_url_rejects_invalid_values` | 31 символ hex, великі літери, розширення `.gif`, `../`, `ftp://`, просто ім'я файлу | `ValueError` |
| `test_price_accepts_values_inside_limits` | Межі Price: 1, 15999, 10 000 000 | Значення приймається |
| `test_price_rejects_values_outside_limits_or_wrong_type` | 0, -5, 10 000 001, рядок `"15999"`, дріб 12.5, `True` | `ValidationError` |
| `test_build_query_raises_when_min_price_greater_than_max_price` | Фільтр min_price=500 > max_price=100 | `BadRequestError` |
| `test_build_query_allows_valid_price_range` | min == max, min < max, одна межа, жодної | Запит будується без помилки |
| `test_detect_format_recognizes_allowed_images` | Справжні PNG, JPEG, WebP 1×1 | Розширення `png`, `jpg`, `webp` |
| `test_detect_format_rejects_gif` | GIF (картинка не з дозволеного списку) | `UnsupportedFileError` |
| `test_detect_format_rejects_plain_text` | Звичайний текст замість картинки | `UnsupportedFileError` |
| `test_read_limited_returns_file_content` | Читання файлу в межах ліміту | Повертаються ті самі байти |
| `test_read_limited_empty_file_raises_unsupported` | Порожній файл | Помилка зі статусом 415 |
| `test_read_limited_file_over_limit_raises_too_large` | Файл на 1 байт більший за ліміт | Помилка зі статусом 413 |
| `test_read_limited_file_exactly_at_limit_is_allowed` | Файл рівно в ліміт | Файл прочитано повністю |
| `test_delete_local_file_removes_own_file` | Видалення збереженого файлу за його адресою | Файлу на диску більше немає |
| `test_delete_local_file_refuses_path_traversal` | Адреса `/media/products/../secret.txt` | Файл поза `products` лишається |
| `test_delete_local_file_ignores_foreign_urls` | Порожня адреса, зовнішня адреса, чужий шлях | Нічого не видаляється, помилки немає |

## Integration тести (Станіслав)

| Тест | Запит | Очікуваний код |
|---|---|---|
| `test_list_categories_shows_product_count` | `GET /api/v1/categories` | 200, `product_count` = 2 |
| `test_list_categories_empty_category_has_zero_count` | `GET /api/v1/categories` (порожня категорія) | 200, `product_count` = 0 |
| `test_admin_creates_category` | `POST /api/v1/categories` (адмін) | 201 |
| `test_create_duplicate_category_returns_409` | `POST /api/v1/categories` з наявною назвою | 409 |
| `test_create_category_by_client_returns_403` | `POST /api/v1/categories` (клієнт) | 403 |
| `test_create_category_by_guest_returns_401` | `POST /api/v1/categories` (гість) | 401 |
| `test_admin_renames_category` | `PATCH /api/v1/categories/{id}` | 200 |
| `test_admin_deletes_empty_category` | `DELETE /api/v1/categories/{id}` | 204 |
| `test_delete_category_with_products_returns_409` | `DELETE /api/v1/categories/{id}` з товарами | 409 |
| `test_delete_unknown_category_returns_404` | `DELETE /api/v1/categories/99999` | 404 |
| `test_list_products_returns_page_envelope` | `GET /api/v1/products?size=2` | 200, total=3, pages=2 |
| `test_list_products_size_over_max_returns_422` | `GET /api/v1/products?size=51` | 422 |
| `test_list_products_page_past_the_end_returns_empty_items` | `GET /api/v1/products?page=5` | 200, `items` порожній |
| `test_search_is_case_insensitive_for_cyrillic` | `GET /api/v1/products?q=НОУТБУК` | 200, знайдено «Ноутбук Alpha» |
| `test_search_percent_sign_is_literal` | `GET /api/v1/products?q=%` | 200, лише товар зі знаком % |
| `test_filter_by_category` | `GET /api/v1/products?category_id=N` | 200, лише товари категорії |
| `test_filter_by_price_range_includes_both_borders` | `GET /api/v1/products?min_price=1000&max_price=2000` | 200, ціни 1000 і 2000 |
| `test_filter_min_price_greater_than_max_returns_400` | `GET /api/v1/products?min_price=500&max_price=100` | 400 |
| `test_sort_by_price` | `GET /api/v1/products?sort=price_asc` / `price_desc` | 200, правильний порядок цін |
| `test_sort_unknown_value_returns_422` | `GET /api/v1/products?sort=random` | 422 |
| `test_get_product_by_id` | `GET /api/v1/products/{id}` | 200 |
| `test_get_unknown_product_returns_404` | `GET /api/v1/products/99999` | 404 |
| `test_admin_creates_product_with_location_header` | `POST /api/v1/products` (адмін) | 201, заголовок `Location` |
| `test_client_cannot_create_product` | `POST /api/v1/products` (клієнт) | 403 |
| `test_create_product_with_unknown_category_returns_422` | `POST /api/v1/products` з неіснуючою категорією | 422 |
| `test_patch_changes_only_given_fields` | `PATCH /api/v1/products/{id}` `{"price": 777}` | 200, назва не змінилась |
| `test_patch_with_unknown_field_returns_422` | `PATCH /api/v1/products/{id}` із зайвим полем | 422 |
| `test_admin_deletes_product` | `DELETE /api/v1/products/{id}` | 204 |
| `test_delete_product_that_is_in_order_returns_409` | `DELETE /api/v1/products/{id}` після `POST /api/v1/orders` | 409 |
| `test_upload_png_sets_image_url_and_saves_file` | `POST /api/v1/products/{id}/image` (PNG) | 200, файл існує |
| `test_upload_text_file_returns_415` | `POST /api/v1/products/{id}/image` (текст) | 415 |
| `test_upload_too_big_file_returns_413` | `POST /api/v1/products/{id}/image` (понад ліміт) | 413 |
| `test_upload_for_unknown_product_returns_404` | `POST /api/v1/products/99999/image` | 404 |
| `test_delete_image_clears_url_and_removes_file` | `DELETE /api/v1/products/{id}/image` | 204 |
| `test_client_cannot_upload_image` | `POST /api/v1/products/{id}/image` (клієнт) | 403 |
| `test_client_cannot_delete_image` | `DELETE /api/v1/products/{id}/image` (клієнт) | 403 |
| `test_create_review_returns_201` | `POST /api/v1/products/{id}/reviews` | 201 |
| `test_second_review_by_same_user_returns_409` | Другий `POST /api/v1/products/{id}/reviews` | 409 |
| `test_create_review_with_rating_out_of_range_returns_422` | `POST /api/v1/products/{id}/reviews` з rating 0 і 6 | 422 |
| `test_create_review_by_guest_returns_401` | `POST /api/v1/products/{id}/reviews` (гість) | 401 |
| `test_list_reviews_returns_created_review` | `GET /api/v1/products/{id}/reviews` | 200 |
| `test_user_edits_own_review` | `PATCH /api/v1/reviews/{id}` (автор) | 200 |
| `test_another_user_cannot_edit_review` | `PATCH /api/v1/reviews/{id}` (інший користувач) | 403 |
| `test_admin_deletes_any_review` | `DELETE /api/v1/reviews/{id}` (адмін) | 204 |
| `test_product_rating_is_average_of_reviews` | `GET /api/v2/products/{id}` після двох відгуків | 200, середня 3.5, count 2 |
| `test_put_is_idempotent` | Двічі `PUT /api/v1/users/me/wishlist/{id}` | 204 і 204, у списку один товар |
| `test_get_lists_added_product` | `GET /api/v1/users/me/wishlist` | 200 |
| `test_delete_removes_product_from_wishlist` | `DELETE /api/v1/users/me/wishlist/{id}` | 204 |
| `test_delete_product_not_in_wishlist_still_returns_204` | `DELETE /api/v1/users/me/wishlist/{id}` без додавання | 204 |
| `test_wishlist_as_guest_returns_401` | `GET /api/v1/users/me/wishlist` (гість) | 401 |
| `test_put_unknown_product_returns_404` | `PUT /api/v1/users/me/wishlist/99999` | 404 |
| `test_v2_product_nests_category_and_rating` | `GET /api/v2/products/{id}` | 200, є `category` і `rating`, немає `category_id` |
| `test_v2_list_has_category_object_for_each_item` | `GET /api/v2/products` | 200 |
| `test_v1_product_still_has_category_id_and_no_rating` | `GET /api/v1/products/{id}` | 200, є `category_id`, немає `rating` |
| `test_v2_unknown_product_returns_404` | `GET /api/v2/products/99999` | 404 |
