"""Чтение и запись карточек в виде *.yaml файлов в папке cards/.

Уровень карточки определяется папкой, в которой лежит файл:
cards/level1/, cards/level2/. Поля level в самом YAML нет, поэтому
папка и уровень не могут разойтись. Для обратной совместимости
файлы, лежащие прямо в cards/, считаются карточками уровня 1.
"""
import re
import unicodedata
from pathlib import Path

import yaml

CARDS_DIR = Path(__file__).resolve().parent.parent / "cards"

REQUIRED_FIELDS = ("id", "title", "task", "answer")

LEVELS = (1, 2)
DEFAULT_LEVEL = 1


def _level_dir(level: int) -> Path:
    return CARDS_DIR / f"level{level}"


def _slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_").lower()
    return text or "card"


def _card_files(level: int | None = None) -> list[tuple[int, Path]]:
    """Возвращает [(уровень, путь)] для всех карточек или только одного уровня."""
    for lv in LEVELS:
        _level_dir(lv).mkdir(parents=True, exist_ok=True)
    files = []
    for lv in LEVELS:
        if level in (None, lv):
            files += [(lv, p) for p in sorted(_level_dir(lv).glob("*.yaml"))]
    if level in (None, DEFAULT_LEVEL):
        # Старый формат: файлы прямо в cards/ — это уровень 1.
        files += [(DEFAULT_LEVEL, p) for p in sorted(CARDS_DIR.glob("*.yaml"))]
    return files


def load_all_cards(level: int | None = None) -> list[dict]:
    """Возвращает карточки (все или одного уровня), отсортированные по id.

    В каждый словарь добавляется поле level (из папки, не из YAML).
    """
    cards = []
    for lv, path in _card_files(level):
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        data["_path"] = path.name
        data["level"] = lv
        cards.append(data)
    cards.sort(key=lambda c: c.get("id", 0))
    return cards


def load_card(card_id: int) -> dict | None:
    for card in load_all_cards():
        if card.get("id") == card_id:
            return card
    return None


def _next_id() -> int:
    # id сквозные по всем уровням: роуты /card/<id> и /check ищут по одному id.
    ids = [c.get("id", 0) for c in load_all_cards()]
    return max(ids, default=0) + 1


def save_new_card(title: str, task: str, answer: str,
                  level: int = DEFAULT_LEVEL) -> dict:
    if level not in LEVELS:
        raise ValueError(f"Неизвестный уровень: {level}")
    new_id = _next_id()
    data = {
        "id": new_id,
        "title": title,
        "task": task,
        "answer": answer,
    }
    filename = f"{new_id:03d}_{_slugify(title)}.yaml"
    target_dir = _level_dir(level)
    target_dir.mkdir(parents=True, exist_ok=True)
    path = target_dir / filename
    with open(path, "w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False)
    return data


def update_card(card_id: int, title: str, task: str, answer: str,
                level: int | None = None) -> dict | None:
    """Обновляет карточку. Если level задан и отличается от текущего,
    файл переезжает в папку нового уровня."""
    if level is not None and level not in LEVELS:
        raise ValueError(f"Неизвестный уровень: {level}")
    for current_level, path in _card_files():
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        if data.get("id") == card_id:
            data.update(title=title, task=task, answer=answer)
            if level is None or level == current_level:
                new_path = path
            else:
                new_path = _level_dir(level) / path.name
            with open(new_path, "w", encoding="utf-8") as f:
                yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False)
            if new_path != path:
                path.unlink()
            return data
    return None


def delete_card(card_id: int) -> bool:
    for _level, path in _card_files():
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        if data.get("id") == card_id:
            path.unlink()
            return True
    return False