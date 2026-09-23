"""Парсинг текста схемы (CREATE TABLE ...) в структуру для ER-диаграммы."""
import re

_CREATE_RE = re.compile(r"CREATE\s+TABLE\s+(\w+)\s*\(", re.IGNORECASE)
_FK_RE = re.compile(
    r"FOREIGN\s+KEY\s*\(\s*(\w+)\s*\)\s*REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)",
    re.IGNORECASE,
)
_INLINE_REF_RE = re.compile(r"REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)", re.IGNORECASE)
_TYPE_RE = re.compile(r"([A-Za-z0-9_]+(?:\([^)]*\))?)")


def _find_matching_paren(text: str, start: int) -> int:
    """start - индекс сразу после открывающей '('. Возвращает индекс закрывающей ')'."""
    depth = 1
    i = start
    while i < len(text) and depth > 0:
        if text[i] == "(":
            depth += 1
        elif text[i] == ")":
            depth -= 1
        i += 1
    return i - 1


def _split_top_level(body: str) -> list[str]:
    """Делит тело таблицы по запятым верхнего уровня (игнорируя запятые внутри скобок)."""
    parts, current, depth = [], [], 0
    for ch in body:
        if ch == "(":
            depth += 1
            current.append(ch)
        elif ch == ")":
            depth -= 1
            current.append(ch)
        elif ch == "," and depth == 0:
            parts.append("".join(current).strip())
            current = []
        else:
            current.append(ch)
    tail = "".join(current).strip()
    if tail:
        parts.append(tail)
    return [p for p in parts if p]


def parse_schema(schema_text: str) -> list[dict]:
    """Парсит одну или несколько CREATE TABLE-инструкций.

    Возвращает список таблиц:
    [{"name", "columns": [{"name","type","pk"}], "foreign_keys": [{"column","ref_table","ref_column"}]}]
    """
    tables = []
    for match in _CREATE_RE.finditer(schema_text or ""):
        table_name = match.group(1)
        body_start = match.end()
        body_end = _find_matching_paren(schema_text, body_start)
        body = schema_text[body_start:body_end]

        columns, foreign_keys = [], []

        for part in _split_top_level(body):
            upper = part.upper()

            if upper.startswith("FOREIGN KEY"):
                fk = _FK_RE.search(part)
                if fk:
                    foreign_keys.append({
                        "column": fk.group(1),
                        "ref_table": fk.group(2),
                        "ref_column": fk.group(3),
                    })
                continue

            if upper.startswith(("PRIMARY KEY", "UNIQUE", "CHECK", "CONSTRAINT")):
                continue

            tokens = part.split(None, 1)
            if not tokens:
                continue
            col_name = tokens[0]
            rest = tokens[1] if len(tokens) > 1 else ""

            is_pk = "PRIMARY KEY" in rest.upper()

            inline_ref = _INLINE_REF_RE.search(rest)
            if inline_ref:
                foreign_keys.append({
                    "column": col_name,
                    "ref_table": inline_ref.group(1),
                    "ref_column": inline_ref.group(2),
                })
                rest = _INLINE_REF_RE.sub("", rest)

            type_match = _TYPE_RE.match(rest.strip())
            col_type = type_match.group(1) if type_match else rest.strip()

            columns.append({"name": col_name, "type": col_type.upper(), "pk": is_pk})

        tables.append({"name": table_name, "columns": columns, "foreign_keys": foreign_keys})

    return tables


def flatten_links(tables: list[dict]) -> list[dict]:
    """Превращает foreign_keys таблиц в плоский список связей для отрисовки линий."""
    links = []
    for table in tables:
        for fk in table["foreign_keys"]:
            links.append({
                "from_table": table["name"],
                "from_col": fk["column"],
                "to_table": fk["ref_table"],
                "to_col": fk["ref_column"],
            })
    return links