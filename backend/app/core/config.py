"""Налаштування застосунку.

Усе, що відрізняється між комп'ютерами (секретний ключ, адреса бази, дозволені джерела CORS),
читається зі змінних оточення або з файлу backend/.env, а не пишеться в коді.
Так секрет не потрапляє в Git, а в Lab 08 Docker передасть ті самі значення через оточення.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Папка backend/. Від неї рахуються всі шляхи, тож сервер можна запускати з будь-якої папки
BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Усі налаштування в одному місці. Назва поля = назва змінної оточення (без різниці регістру)."""

    model_config = SettingsConfigDict(env_file=BASE_DIR / '.env', env_file_encoding='utf-8', extra='ignore')

    app_name: str = 'OmniTech API'

    # Адреса бази для SQLAlchemy. За замовчуванням файл backend/data/omnitech.db
    database_url: str = f'sqlite:///{(BASE_DIR / "data" / "omnitech.db").as_posix()}'

    # Ключ, яким підписуються токени входу. Без нього сервер не запуститься (значення по
    # замовчуванню немає навмисно): хто знає ключ, той може підробити вхід будь-якого користувача
    secret_key: str = Field(min_length=32)

    # Скільки хвилин діє токен після входу
    access_token_minutes: int = Field(default=60, ge=1, le=1440)

    # Сторінки з яких адрес можуть звертатися до API з браузера (CORS).
    # Дев-сервер Vite з Lab 06 працює на порту 5173
    cors_origins: list[str] = ['http://localhost:5173', 'http://127.0.0.1:5173']

    # Docker (лабораторна 08): режим роботи, рівень логів, заповнення порожньої бази при старті контейнера
    app_env: str = 'development'         # production = JSON-логи, development = читабельні
    log_level: str = 'INFO'              # DEBUG, INFO, WARNING, ERROR, CRITICAL
    seed_on_start: bool = False          # true: entrypoint заповнює ПОРОЖНЮ базу демо-даними

    # Папка для завантажених файлів і найбільший дозволений розмір картинки
    media_dir: Path = BASE_DIR / 'media'
    max_upload_mb: int = Field(default=5, ge=1, le=50)

    @field_validator('log_level')
    @classmethod
    def normalize_log_level(cls, value: str) -> str:
        """info -> INFO; невідомий рівень не пропускаємо, щоб помилка в .env була видна одразу."""
        value = value.upper()
        if value not in ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'):
            raise ValueError('LOG_LEVEL має бути DEBUG, INFO, WARNING, ERROR або CRITICAL.')
        return value

    @field_validator('secret_key')
    @classmethod
    def reject_example_key(cls, value: str) -> str:
        """Ключ-зразок з .env.example лежить у публічному репозиторії, тож ним може підписати токен будь-хто."""
        if value.startswith('replace-me'):
            raise ValueError('Замініть SECRET_KEY у backend/.env на власний випадковий ключ (див. README).')
        return value


@lru_cache
def get_settings() -> Settings:
    """Створює налаштування один раз і далі повертає той самий об'єкт (lru_cache запам'ятовує результат)."""
    return Settings()


settings = get_settings()
