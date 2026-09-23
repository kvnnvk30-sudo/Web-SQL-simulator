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


def compare_query(user_input: str, answer: str) -> tuple[bool, str]:
    """Сравнивает запрос пользователя с эталоном, выполняя оба в PostgreSQL.

    Порядок строк не важен (сравниваются как мультимножества), порядок и
    названия колонок — важны, они сверяются как список.
    """
    if not user_input or not user_input.strip():
        return False, "Пустой запрос."

    conn = get_connection()
    try:
        answer_cols, answer_rows, answer_err = _execute_select(conn, answer)
        if answer_err:
            return False, (
                f"Ошибка в эталонном запросе карточки (сообщите об этом "
                f"преподавателю): {answer_err}"
            )

        user_cols, user_rows, user_err = _execute_select(conn, user_input)
        if user_err:
            return False, user_err
    finally:
        conn.close()

    if user_cols != answer_cols:
        return False, (
            f"Названия колонок не совпадают: ожидалось {answer_cols}, "
            f"получено {user_cols}"
        )

    if len(user_rows) != len(answer_rows):
        return False, (
            f"Количество строк не совпадает: ожидалось {len(answer_rows)}, "
            f"получено {len(user_rows)}"
        )

    if sorted(user_rows, key=_row_sort_key) != sorted(answer_rows, key=_row_sort_key):
        return False, "Данные в строках различаются."

    return True, "Верно!"