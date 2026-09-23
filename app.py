import random

from flask import Flask, jsonify, redirect, render_template, request, url_for

from core.card_loader import (
    delete_card,
    load_all_cards,
    load_card,
    save_new_card,
    update_card,
)
from core.checker import compare_query
from core.schema_parser import flatten_links, parse_schema
from core.schema_store import load_shared_schema

app = Flask(__name__)

SCHEMA_TABLES = parse_schema(load_shared_schema())
SCHEMA_LINKS = flatten_links(SCHEMA_TABLES)


def _render_trainer(card, cards):
    return render_template(
        "index.html",
        card=card,
        cards=cards,
        schema_tables=SCHEMA_TABLES,
        schema_links=SCHEMA_LINKS,
    )


@app.route("/")
def index():
    cards = load_all_cards()
    if not cards:
        return _render_trainer(None, [])
    card = random.choice(cards)
    return _render_trainer(card, cards)


@app.route("/card/<int:card_id>")
def card_detail(card_id):
    card = load_card(card_id)
    cards = load_all_cards()
    if card is None:
        return _render_trainer(None, cards), 404
    return _render_trainer(card, cards)


@app.route("/check", methods=["POST"])
def check():
    data = request.get_json(force=True, silent=True) or {}
    card_id = data.get("card_id")
    query = data.get("query", "")

    card = load_card(int(card_id)) if card_id is not None else None
    if card is None:
        return jsonify({"correct": False, "message": "Карточка не найдена."}), 404

    correct, message = compare_query(query, card["answer"])
    return jsonify({"correct": correct, "message": message})


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
        )
        return redirect(url_for("cards_list"))
    return render_template("edit_card.html", card=None)


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
        )
        return redirect(url_for("cards_list"))
    return render_template("edit_card.html", card=card)


@app.route("/cards/<int:card_id>/delete", methods=["POST"])
def cards_delete(card_id):
    delete_card(card_id)
    return redirect(url_for("cards_list"))


if __name__ == "__main__":
    app.run(debug=True)