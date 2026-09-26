"""Проверка SQL-запросов через реальное выполнение в PostgreSQL."""
import psycopg2

from core.db import get_connection


def _row_sort_key(row):
    """Ключ сортировки, устойчивый к NULL и разнотипным значениям в колонке.

    Сравнивать сырые значения напрямую (sorted(rows)) небезопасно: если в
    одной колонке встречаются и NULL, и обычные значения, Python не умеет
    их сравнивать между собой и падает с TypeError. Строковый ключ решает
    это и заодно даёт стабильный порядок для сравнения "как мультимножеств".
    """
    return tuple((value is None, str(value)) for value in row)


def _serialize_rows(rows):
    """Приводит строки результата к JSON-сериализуемому виду.

    psycopg2 может вернуть datetime/date/Decimal и т.п. — стандартный
    json (и, соответственно, flask.jsonify) их не сериализует, поэтому
    всё, что не является str/int/float/bool/None, приводим к str().
    """
    def _value(v):
        if v is None or isinstance(v, (str, int, float, bool)):
            return v
        return str(v)

    return [[_value(v) for v in row] for row in rows]


def _execute_select(conn, query: str):
    """Выполняет один SELECT-запрос в отдельном курсоре.

    Возвращает (columns, rows, error_message). Изменения запроса всегда
    откатываются (ROLLBACK) сразу после выполнения — даже если запрос
    вернул результат без ошибок, — чтобы в БД ничего не сохранялось.
    """
    cur = conn.cursor()
    try:
        cur.execute(query)
        if cur.description is None:
            return None, None, "Запрос должен быть SELECT-запросом (нет набора строк для вывода)."
        columns = [col.name for col in cur.description]
        rows = cur.fetchall()
        return columns, rows, None
    except psycopg2.Error as exc:
        message = (exc.pgerror or str(exc)).strip()
        return None, None, f"Ошибка выполнения запроса: {message}"
    finally:
        cur.close()
        conn.rollback()


def compare_query(user_input: str, answer: str) -> dict:
    """Сравнивает запрос пользователя с эталоном, выполняя оба в PostgreSQL.

    Порядок строк не важен (сравниваются как мультимножества), порядок и
    названия колонок — важны, они сверяются как список.

    Возвращает словарь:
        {"correct": bool, "message": str, "query": str,
         "columns": list[str], "rows": list[list]}

    Если запрос пользователя падает с ошибкой PostgreSQL (или это не
    SELECT), correct=False, message содержит текст ошибки, а columns/rows
    остаются пустыми списками.
    """
    if not user_input or not user_input.strip():
        return {
            "correct": False,
            "message": "Пустой запрос.",
            "query": user_input,
            "columns": [],
            "rows": [],
        }

    conn = get_connection()
    try:
        answer_cols, answer_rows, answer_err = _execute_select(conn, answer)
        if answer_err:
            return {
                "correct": False,
                "message": (
                    f"Ошибка в эталонном запросе карточки (сообщите об этом "
                    f"преподавателю): {answer_err}"
                ),
                "query": user_input,
                "columns": [],
                "rows": [],
            }

        user_cols, user_rows, user_err = _execute_select(conn, user_input)
        if user_err:
            return {
                "correct": False,
                "message": user_err,
                "query": user_input,
                "columns": [],
                "rows": [],
            }
    finally:
        conn.close()

    user_rows_serialized = _serialize_rows(user_rows)

    if user_cols != answer_cols:
        return {
            "correct": False,
            "message": (
                f"Названия колонок не совпадают: ожидалось {answer_cols}, "
                f"получено {user_cols}"
            ),
            "query": user_input,
            "columns": user_cols,
            "rows": user_rows_serialized,
        }

    if len(user_rows) != len(answer_rows):
        return {
            "correct": False,
            "message": (
                f"Количество строк не совпадает: ожидалось {len(answer_rows)}, "
                f"получено {len(user_rows)}"
            ),
            "query": user_input,
            "columns": user_cols,
            "rows": user_rows_serialized,
        }

    if sorted(user_rows, key=_row_sort_key) != sorted(answer_rows, key=_row_sort_key):
        return {
            "correct": False,
            "message": "Данные в строках различаются.",
            "query": user_input,
            "columns": user_cols,
            "rows": user_rows_serialized,
        }

    return {
        "correct": True,
        "message": "Верно!",
        "query": user_input,
        "columns": user_cols,
        "rows": user_rows_serialized,
    }