"""Чтение и запись карточек в виде *.yaml файлов в папке cards/."""
import re
import unicodedata
from pathlib import Path

import yaml

CARDS_DIR = Path(__file__).resolve().parent.parent / "cards"

REQUIRED_FIELDS = ("id", "title", "task", "answer")


def _slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_").lower()
    return text or "card"


def _card_files():
    CARDS_DIR.mkdir(exist_ok=True)
    return sorted(CARDS_DIR.glob("*.yaml"))


def load_all_cards() -> list[dict]:
    """Возвращает все карточки, отсортированные по id."""
    cards = []
    for path in _card_files():
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        data["_path"] = path.name
        cards.append(data)
    cards.sort(key=lambda c: c.get("id", 0))
    return cards


def load_card(card_id: int) -> dict | None:
    for card in load_all_cards():
        if card.get("id") == card_id:
            return card
    return None


def _next_id() -> int:
    ids = [c.get("id", 0) for c in load_all_cards()]
    return max(ids, default=0) + 1


def save_new_card(title: str, task: str, answer: str) -> dict:
    new_id = _next_id()
    data = {
        "id": new_id,
        "title": title,
        "task": task,
        "answer": answer,
    }
    filename = f"{new_id:03d}_{_slugify(title)}.yaml"
    path = CARDS_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False)
    return data


def update_card(card_id: int, title: str, task: str, answer: str) -> dict | None:
    for path in _card_files():
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        if data.get("id") == card_id:
            data.update(title=title, task=task, answer=answer)
            with open(path, "w", encoding="utf-8") as f:
                yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False)
            return data
    return None


def delete_card(card_id: int) -> bool:
    for path in _card_files():
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        if data.get("id") == card_id:
            path.unlink()
            return True
    return False