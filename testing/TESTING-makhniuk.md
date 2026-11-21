# Тести: Махнюк Андрій

Таблиці тестів учасника (лабораторна 07). Загальний опис, запуск, результати й покриття команди — у [TESTING.md](../TESTING.md).

## Unit тести (Андрій)

| Тест | Що перевіряє | Очікуваний результат |
|---|---|---|
| test_order_total_sums_price_times_quantity | order_total для порожнього списку, одного рядка, кількох рядків і кількості 99 | Сума ціна × кількість; для порожнього списку 0 |
| test_order_total_accepts_generator | order_total приймає генератор пар, як у сервісі | 120 |
| test_merge_items_keeps_different_products_separate | різні товари не зливаються | {1: 2, 2: 5} |
| test_merge_items_sums_duplicates | однаковий товар у двох рядках | Кількості додаються: {7: 5} |
| test_merge_items_allows_exactly_max_quantity | межа: рівно 99 штук | Проходить без помилки |
| test_merge_items_allows_max_quantity_split_in_two_lines | 90 + 9 = 99 | {1: 99} |
| test_merge_items_rejects_sum_over_max_quantity | 90 + 10 = 100 | UnprocessableError з field='items' |
| test_order_item_line_total_is_price_times_quantity | OrderItem.line_total без бази | ціна × кількість |
| test_cart_accepts_valid_number_of_lines | CartIn з 1, 2 і 50 рядками | Схема створюється |
| test_cart_rejects_wrong_number_of_lines | CartIn з 0 і 51 рядком | ValidationError |
| test_cart_accepts_valid_quantity | кількість 1, 2, 99 | Схема створюється |
| test_cart_rejects_wrong_quantity | кількість 0, -1, 100 | ValidationError |
| test_cart_rejects_quantity_as_string | кількість "2" як рядок (strict) | ValidationError |
| test_cart_rejects_non_positive_product_id | product_id 0 і -5 | ValidationError |
| test_order_accepts_good_phone | чотири правильні формати телефону | Схема створюється |
| test_order_rejects_bad_phone | замало цифр, 9 цифр, літери, забагато цифр | ValidationError |
| test_order_rejects_extra_price_field | зайве поле price в замовленні | ValidationError для поля price |
| test_cart_item_rejects_extra_price_field | зайве поле price в рядку кошика | ValidationError |
| test_order_rejects_short_address | адреса коротша за 5 символів | ValidationError |

## Integration тести (Андрій)

| Тест | Запит | Очікуваний код |
|---|---|---|
| test_preview_uses_price_from_database | POST /api/v1/cart/preview | 200 |
| test_preview_rejects_price_sent_by_client | POST /api/v1/cart/preview з полем price | 422 |
| test_preview_total_is_sum_of_lines | POST /api/v1/cart/preview з двома товарами | 200 |
| test_preview_lists_missing_products | POST /api/v1/cart/preview з неіснуючим id | 200 |
| test_preview_rejects_empty_items | POST /api/v1/cart/preview з порожнім items | 422 |
| test_preview_rejects_quantity_over_limit | POST /api/v1/cart/preview, quantity 100 | 422 |
| test_preview_merges_duplicate_ids | POST /api/v1/cart/preview з дублікатами | 200 |
| test_preview_rejects_duplicates_over_max_quantity | POST /api/v1/cart/preview, 60 + 60 | 422 |
| test_guest_can_create_order | POST /api/v1/orders без токена | 201 |
| test_logged_in_order_appears_in_my_orders | POST /api/v1/orders, потім GET /api/v1/users/me/orders | 200 |
| test_guest_order_not_in_my_orders | GET /api/v1/users/me/orders після гостьового замовлення | 200 (порожній список) |
| test_my_orders_requires_login | GET /api/v1/users/me/orders без токена | 401 |
| test_order_with_unknown_product_returns_404 | POST /api/v1/orders з product_id 9999 | 404 |
| test_order_with_invalid_phone_returns_422 | POST /api/v1/orders з телефоном 12345 | 422 |
| test_order_with_price_field_returns_422 | POST /api/v1/orders з полем price | 422 |
| test_other_users_order_returns_404 | GET /api/v1/users/me/orders/{id} чужого замовлення | 404 |
| test_own_order_is_returned_by_id | GET /api/v1/users/me/orders/{id} свого замовлення | 200 |
| test_order_keeps_price_after_product_price_changes | GET /api/v1/users/me/orders/{id} після зміни ціни | 200 |
| test_admin_lists_all_orders | GET /api/v1/admin/orders | 200 |
| test_admin_filters_orders_by_status | GET /api/v1/admin/orders?status=shipped | 200 |
| test_admin_filter_with_unknown_status_returns_422 | GET /api/v1/admin/orders?status=lost | 422 |
| test_admin_changes_order_status | PATCH /api/v1/admin/orders/{id} | 200 |
| test_admin_bad_status_returns_422 | PATCH /api/v1/admin/orders/{id} зі статусом lost | 422 |
| test_client_cannot_list_admin_orders | GET /api/v1/admin/orders токеном клієнта | 403 |
| test_client_cannot_change_status | PATCH /api/v1/admin/orders/{id} токеном клієнта | 403 |
| test_admin_orders_without_token_returns_401 | GET /api/v1/admin/orders без токена | 401 |
| test_admin_deletes_order | DELETE /api/v1/admin/orders/{id} | 204 |
| test_admin_delete_unknown_order_returns_404 | DELETE /api/v1/admin/orders/9999 | 404 |
| test_admin_update_unknown_order_returns_404 | PATCH /api/v1/admin/orders/9999 | 404 |
| test_guest_can_send_feedback | POST /api/v1/feedback | 201 |
| test_too_short_message_returns_422 | POST /api/v1/feedback з коротким повідомленням | 422 |
| test_admin_sees_feedback_list | GET /api/v1/admin/feedback | 200 |
| test_admin_unread_filter_hides_read_messages | GET /api/v1/admin/feedback?unread=true | 200 |
| test_admin_marks_feedback_read | PATCH /api/v1/admin/feedback/{id} з is_read=true | 200 |
| test_mark_feedback_requires_boolean | PATCH /api/v1/admin/feedback/{id} з is_read="yes" | 422 |
| test_admin_deletes_feedback | DELETE /api/v1/admin/feedback/{id} | 204 |
| test_admin_delete_unknown_feedback_returns_404 | DELETE /api/v1/admin/feedback/9999 | 404 |
| test_client_cannot_read_admin_feedback | GET /api/v1/admin/feedback токеном клієнта | 403 |
| test_stats_on_empty_database_are_zero | GET /api/v1/admin/stats на порожній базі | 200 |
| test_stats_contain_every_status_key | GET /api/v1/admin/stats | 200 |
| test_revenue_counts_only_completed_orders | GET /api/v1/admin/stats після зміни статусів | 200 |
| test_stats_count_unread_feedback | GET /api/v1/admin/stats після повідомлення | 200 |
| test_client_cannot_see_stats | GET /api/v1/admin/stats токеном клієнта | 403 |
| test_stats_without_token_returns_401 | GET /api/v1/admin/stats без токена | 401 |
