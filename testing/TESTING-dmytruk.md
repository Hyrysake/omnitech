# Тести: Дмитрук Назар

Таблиці тестів учасника (лабораторна 07). Загальний опис, запуск, результати й покриття команди — у [TESTING.md](../TESTING.md).

## Unit тести (Назар)

| Тест | Що перевіряє | Очікуваний результат |
|---|---|---|
| test_hash_and_verify_round_trip | хешування й перевірка того самого пароля | verify_password повертає True |
| test_hash_is_not_plain_password | хеш не містить пароль у відкритому вигляді | рядка пароля в хеші немає |
| test_wrong_password_does_not_verify | перевірка неправильного пароля | False |
| test_same_password_gives_different_hashes | сіль: два хеші одного пароля | хеші різні |
| test_access_token_subject_is_user_id_as_string | поле sub у токені для id=42 | sub == '42' |
| test_access_token_lifetime_matches_settings | різниця exp - iat | дорівнює access_token_minutes * 60 |
| test_tampered_signature_is_rejected | токен з підміненим підписом | jwt.InvalidSignatureError |
| test_token_signed_with_other_key_is_rejected | токен, підписаний чужим ключем | jwt.InvalidTokenError |
| test_expired_token_is_rejected | токен із простроченим exp | jwt.ExpiredSignatureError |
| test_alg_none_token_is_rejected | токен без підпису (alg=none) | jwt.InvalidTokenError |
| test_token_without_required_claim_is_rejected (no_exp, no_sub) | токен без exp; токен без sub | jwt.MissingRequiredClaimError |
| test_garbage_string_is_rejected | випадковий рядок замість токена | jwt.InvalidTokenError |
| test_valid_phone_is_returned_unchanged ('0501234567', '+380501234567', '+38 (050) 123-45-67', '050 123 45 67', '(050)1234567') | коректні телефони, 10 і 13 цифр та дозволені символи | значення повертається без змін |
| test_invalid_phone_raises_value_error ('', '050123456', '+38050123456789', '050abc1234567', '050.123.4567', '++++++++++', '050/123/4567') | порожній, 9 цифр, 14 цифр, літери, крапка, немає цифр, слеш | ValueError |
| test_phone_error_message_has_example | текст помилки телефону | містить приклад +380501234567 |
| test_lower_email_makes_everything_lowercase ('Olena@Example.COM', 'already@lower.com', 'ADMIN@OMNITECH.EXAMPLE') | приведення пошти до малих літер | 'olena@example.com', 'already@lower.com', 'admin@omnitech.example' |
| test_field_name_builds_dotted_path (('body','items',0,'quantity'), ('body','email'), ('query','page'), ('body',)) | побудова назви поля з loc | 'items.0.quantity', 'email', 'page', 'body' |
| test_translate_known_type_with_context | переклад string_too_short з ctx | 'Мінімальна довжина — 6 симв.' |
| test_translate_known_type_without_context | переклад missing | "Обов'язкове поле." |
| test_translate_unknown_type_falls_back_to_original_message | невідомий тип помилки | повертається оригінальний msg |
| test_translate_literal_error_lists_allowed_values | переклад literal_error | 'Допустимі значення: new, paid.' |
| test_translate_missing_context_key_falls_back | шаблон просить ключ, якого немає в ctx | повертається оригінальний msg |
| test_error_body_without_errors_has_only_detail | тіло помилки без списку errors | {'detail': 'Не знайдено.'} |
| test_error_body_with_empty_list_has_no_errors_key | порожній список errors | ключа errors немає |
| test_error_body_with_errors_keeps_them | непорожній список errors | errors збережено |
| test_app_error_classes_have_right_status_code (BadRequestError, NotFoundError, ConflictError) | HTTP-код класу помилки | 400, 404, 409 |
| test_page_count ((0,12), (1,12), (12,12), (13,12), (24,12), (25,12)) | кількість сторінок | 0, 1, 1, 2, 2, 3 |
| test_page_params_offset ((1,12), (2,12), (3,12), (4,5)) | зсув для SQL OFFSET | 0, 12, 24, 15 |
| test_page_params_defaults | значення за замовчуванням | page=1, size=12 |
| test_sqlite_lower_handles_cyrillic | lower() для «НОУТБУК» | 'ноутбук' |
| test_sqlite_lower_keeps_none | lower() для None | None |
| test_sqlite_lower_keeps_numbers | lower() для числа 42 | 42 |

## Integration тести (Назар)

| Тест | Запит | Очікуваний код |
|---|---|---|
| `test_health_returns_ok` | `GET /api/health` | 200, `status: ok` |
| `test_unknown_address_returns_json_404` | `GET /api/v1/no-such-endpoint` | 404 у форматі `{detail}` |
| test_register_returns_201_and_user | POST /api/v1/auth/register, коректні дані | 201, role=client |
| test_register_response_has_no_password | POST /api/v1/auth/register | 201, у відповіді немає пароля й хеша |
| test_register_lowercases_email | POST /api/v1/auth/register, пошта з великими літерами | 201, пошта малими літерами |
| test_register_duplicate_email_returns_409 | POST /api/v1/auth/register двічі з тією самою поштою | 409 |
| test_register_invalid_fields_return_422_with_errors (короткий пароль, погана пошта, порожнє ім'я) | POST /api/v1/auth/register з однією неправильною полем | 422, у errors є потрібне поле |
| test_register_passwords_mismatch_returns_422 | POST /api/v1/auth/register, password_confirm інший | 422 |
| test_login_returns_token | POST /api/v1/auth/token, форма username+password | 200, access_token і user |
| test_login_token_works_for_users_me | POST /api/v1/auth/token, потім GET /api/v1/users/me з токеном | 200 |
| test_wrong_password_returns_401 | POST /api/v1/auth/token, неправильний пароль | 401 |
| test_unknown_email_returns_same_body_as_wrong_password | POST /api/v1/auth/token, невідома пошта | 401, тіло те саме, що для неправильного пароля |
| test_login_without_form_fields_returns_422 | POST /api/v1/auth/token без полів | 422 |
| test_me_without_token_returns_401 | GET /api/v1/users/me без токена | 401 |
| test_me_with_forged_token_returns_401 | GET /api/v1/users/me, токен чужим ключем | 401 |
| test_me_with_expired_token_returns_401 | GET /api/v1/users/me, прострочений токен | 401 |
| test_me_with_token_of_deleted_user_returns_401 | GET /api/v1/users/me, токен видаленого користувача | 401 |
| test_me_returns_own_profile | GET /api/v1/users/me з токеном | 200 |
| test_patch_me_changes_name | PATCH /api/v1/users/me, {name} | 200, ім'я змінено |
| test_patch_me_with_taken_email_returns_409 | PATCH /api/v1/users/me, пошта адміна | 409 |
| test_patch_me_with_null_name_returns_422 | PATCH /api/v1/users/me, {name: null} | 422 |
| test_change_password_with_wrong_current_returns_400 | POST /api/v1/users/me/password, неправильний поточний пароль | 400 |
| test_change_password_then_login_with_new_one | POST /api/v1/users/me/password, потім вхід зі старим і новим | 204, новий пароль 200, старий 401 |
| test_delete_me_returns_204_and_account_is_gone | DELETE /api/v1/users/me, потім GET /api/v1/users/me | 204, потім 401 |
| test_admin_cannot_delete_own_account | DELETE /api/v1/users/me від адміна | 409 |
| test_guest_gets_401 | GET /api/v1/admin/users без токена | 401 |
| test_client_gets_403 | GET /api/v1/admin/users з токеном клієнта | 403 |
| test_admin_gets_paginated_list | GET /api/v1/admin/users від адміна | 200, total=2, page=1, size=12, pages=1 |
| test_list_does_not_expose_password_hash | GET /api/v1/admin/users | 200, немає password_hash |
| test_second_page_has_remaining_users | GET /api/v1/admin/users?page=2&size=2 при 3 користувачах | 200, pages=2, 1 запис |
| test_search_cyrillic_is_case_insensitive (клієнт, КЛІЄНТ, Клієнт) | GET /api/v1/admin/users?q=... | 200, знайдено лише клієнта |
| test_search_by_email_part | GET /api/v1/admin/users?q=ADMIN@ | 200, знайдено адміна |
| test_search_without_match_returns_empty_page | GET /api/v1/admin/users?q=нема-такого | 200, items=[], total=0, pages=0 |
| test_invalid_page_params_return_422 (size=0, size=51, page=0) | GET /api/v1/admin/users з неправильними параметрами | 422 |
| test_size_50_is_allowed | GET /api/v1/admin/users?size=50 | 200 |
| test_seed_creates_expected_rows | запуск SEEDERS один раз | 7 категорій, 18 товарів, 2 користувачі |
| test_seed_twice_creates_no_duplicates | запуск SEEDERS двічі | кількості ті самі: 7, 18, 2 |
| test_seed_product_names_are_unique | запуск SEEDERS двічі | назви товарів унікальні |
| test_seeded_admin_exists | запуск SEEDERS | admin@omnitech.example має роль admin |
