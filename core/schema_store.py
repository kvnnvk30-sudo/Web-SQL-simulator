"""Загрузка единой схемы БД, общей для всех карточек."""
from pathlib import Path

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "schema" / "database.sql"


def load_shared_schema() -> str:
    """Возвращает текст общей схемы БД (CREATE TABLE ...) для всех заданий."""
    if not SCHEMA_PATH.exists():
        return ""
    return SCHEMA_PATH.read_text(encoding="utf-8")