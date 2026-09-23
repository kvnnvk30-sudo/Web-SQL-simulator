"""Пересоздание учебной БД при старте приложения из schema/database.sql."""
from core.db import get_connection
from core.schema_store import load_shared_schema

# Порядок важен: сначала удаляем таблицы, у которых есть FK на другие,
# иначе DROP без CASCADE упадёт на зависимостях (хотя CASCADE и так
# подчистит связи, порядок оставлен для читаемости).
_DROP_ORDER = ["Pass_in_trip", "Trip", "Passenger", "Company", "Country"]


def init_db() -> None:
    """Удаляет старые таблицы и создаёт их заново из schema/database.sql.

    Вызывается один раз при старте Flask-приложения. schema/database.sql
    теперь содержит и CREATE TABLE, и INSERT INTO с тестовыми данными —
    выполняется одним запросом (psycopg2 поддерживает несколько
    ;-разделённых стейтментов в execute(), если нет параметров).
    """
    conn = get_connection()
    try:
        cur = conn.cursor()
        for table in _DROP_ORDER:
            cur.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")

        schema_sql = load_shared_schema()
        if schema_sql.strip():
            cur.execute(schema_sql)

        conn.commit()
        cur.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
