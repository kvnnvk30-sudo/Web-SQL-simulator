"""Текстовая нормализация и сравнение SQL-запросов."""
import re

_STRING_LITERAL = re.compile(r"('(?:[^'\\]|\\.)*')")
_WHITESPACE = re.compile(r"\s+")
_SPACE_AROUND_COMMA = re.compile(r"\s*,\s*")
_SPACE_AROUND_PAREN_OPEN = re.compile(r"\s*\(\s*")
_SPACE_AROUND_PAREN_CLOSE = re.compile(r"\s*\)\s*")


def normalize_sql(query: str) -> str:
    """Приводит запрос к каноническому виду для сравнения.

    - убирает пробелы по краям и завершающую ';'
    - lower() для всего, кроме содержимого строковых литералов в кавычках
    - схлопывает пробелы/переносы строк в один пробел
    - убирает пробелы вокруг , ( )
    """
    query = query.strip()
    if query.endswith(";"):
        query = query[:-1].rstrip()

    # Разбиваем на куски: чётные индексы - обычный SQL, нечётные - строки в кавычках
    parts = _STRING_LITERAL.split(query)
    for i in range(0, len(parts), 2):
        parts[i] = parts[i].lower()
    result = "".join(parts)

    result = _WHITESPACE.sub(" ", result).strip()
    result = _SPACE_AROUND_COMMA.sub(",", result)
    result = _SPACE_AROUND_PAREN_OPEN.sub("(", result)
    result = _SPACE_AROUND_PAREN_CLOSE.sub(")", result)
    return result


def _first_diff_message(user_norm: str, answer_norm: str) -> str:
    """Находит первое расхождение и описывает его человеко-читаемо."""
    min_len = min(len(user_norm), len(answer_norm))
    idx = 0
    while idx < min_len and user_norm[idx] == answer_norm[idx]:
        idx += 1

    context = 12
    start = max(0, idx - context)

    if idx >= len(user_norm) and idx < len(answer_norm):
        return (
            f"Запрос обрывается раньше, чем нужно. После "
            f"«...{user_norm[start:idx]}» ожидалось продолжение: "
            f"«{answer_norm[idx:idx + context]}...»"
        )
    if idx >= len(answer_norm) and idx < len(user_norm):
        return (
            f"В запросе есть лишнее в конце. После «...{answer_norm[start:idx]}» "
            f"не должно быть: «{user_norm[idx:idx + context]}...»"
        )

    got = user_norm[idx:idx + context]
    expected = answer_norm[idx:idx + context]
    return (
        f"Расхождение примерно на позиции {idx}: "
        f"у тебя «...{got}...», а ожидается «...{expected}...»"
    )


def compare_query(user_input: str, answer: str) -> tuple[bool, str]:
    """Сравнивает запрос пользователя с эталоном. Возвращает (correct, message)."""
    if not user_input or not user_input.strip():
        return False, "Пустой запрос."

    user_norm = normalize_sql(user_input)
    answer_norm = normalize_sql(answer)

    if user_norm == answer_norm:
        return True, "Верно!"

    return False, _first_diff_message(user_norm, answer_norm)