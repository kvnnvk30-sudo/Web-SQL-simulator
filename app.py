import random

from flask import Flask, jsonify, redirect, render_template, request, url_for

from core.card_loader import (
    DEFAULT_LEVEL,
    LEVELS,
    delete_card,
    load_all_cards,
    load_card,
    save_new_card,
    update_card,
)
from core.checker import compare_query
from core.db_init import init_db
from core.schema_parser import flatten_links, parse_schema
from core.schema_store import load_shared_schema

app = Flask(__name__)

# Пересоздаём учебную БД в PostgreSQL при каждом старте приложения:
# дропаем старые таблицы и заново выполняем schema/database.sql
# (CREATE TABLE + тестовые INSERT).
init_db()

SCHEMA_TABLES = parse_schema(load_shared_schema())
SCHEMA_LINKS = flatten_links(SCHEMA_TABLES)


def _parse_level(raw, default=DEFAULT_LEVEL):
    """Приводит значение из query/формы к допустимому уровню."""
    try:
        level = int(raw)
    except (TypeError, ValueError):
        return default
    return level if level in LEVELS else default


def _render_trainer(card, cards, level):
    return render_template(
        "index.html",
        card=card,
        cards=cards,
        level=level,
        levels=LEVELS,
        schema_tables=SCHEMA_TABLES,
        schema_links=SCHEMA_LINKS,
    )


@app.route("/")
def index():
    level = _parse_level(request.args.get("level"))
    cards = load_all_cards(level)
    if not cards:
        return _render_trainer(None, [], level)
    card = random.choice(cards)
    return _render_trainer(card, cards, level)


@app.route("/card/<int:card_id>")
def card_detail(card_id):
    card = load_card(card_id)
    if card is None:
        level = _parse_level(request.args.get("level"))
        return _render_trainer(None, load_all_cards(level), level), 404
    # Уровень берём у самой карточки, в списке слева — её уровень.
    return _render_trainer(card, load_all_cards(card["level"]), card["level"])


@app.route("/check", methods=["POST"])
def check():
    data = request.get_json(force=True, silent=True) or {}
    card_id = data.get("card_id")
    query = data.get("query", "")

    card = load_card(int(card_id)) if card_id is not None else None
    if card is None:
        return jsonify({
            "correct": False,
            "message": "Карточка не найдена.",
            "query": query,
            "columns": [],
            "rows": [],
        }), 404

    result = compare_query(query, card["answer"])
    return jsonify(result)


@app.route("/cards")
def cards_list():
    cards = load_all_cards()
    return render_template("cards_list.html", cards=cards)


@app.route("/cards/new", methods=["GET", "POST"])
def cards_new():
    if request.method == "POST":
        save_new_card(
            title=request.form["title"],
            task=request.form["task"],
            answer=request.form["answer"],
            level=_parse_level(request.form.get("level")),
        )
        return redirect(url_for("cards_list"))
    return render_template(
        "edit_card.html",
        card=None,
        levels=LEVELS,
        selected_level=_parse_level(request.args.get("level")),
    )


@app.route("/cards/<int:card_id>/edit", methods=["GET", "POST"])
def cards_edit(card_id):
    card = load_card(card_id)
    if card is None:
        return redirect(url_for("cards_list"))

    if request.method == "POST":
        update_card(
            card_id,
            title=request.form["title"],
            task=request.form["task"],
            answer=request.form["answer"],
            level=_parse_level(request.form.get("level"), default=card["level"]),
        )
        return redirect(url_for("cards_list"))
    return render_template(
        "edit_card.html",
        card=card,
        levels=LEVELS,
        selected_level=card["level"],
    )


@app.route("/cards/<int:card_id>/delete", methods=["POST"])
def cards_delete(card_id):
    delete_card(card_id)
    return redirect(url_for("cards_list"))


if __name__ == "__main__":
    app.run(debug=True)