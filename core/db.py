"""Подключение к PostgreSQL. Параметры берутся из переменных окружения (.env)."""
import os

import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432"),
    "dbname": os.getenv("DB_NAME", "sql_trainer"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres"),
}


def get_connection():
    """Возвращает новое соединение с PostgreSQL по параметрам из .env."""
    return psycopg2.connect(**DB_CONFIG)
