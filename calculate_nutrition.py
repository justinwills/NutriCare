import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path


DATABASE_PATH = Path("nutrition_db.json")
OUTPUT_PATH = Path("nutrition_calculation.json")


def normalize(text):
    """Normalize names while preserving letters from every language."""
    text = str(text).casefold().strip()
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    return " ".join(text.split())


def load_database():
    if not DATABASE_PATH.exists():
        raise FileNotFoundError(
            "nutrition_db.json was not found. Put it beside "
            "calculate_nutrition.py."
        )

    with DATABASE_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def build_search_index(foods):
    index = []

    for food in foods:
        terms = [food["name"], *food.get("aliases", [])]

        for term in terms:
            index.append({
                "term": term,
                "normalized": normalize(term),
                "food": food,
            })

    return index


def find_matches(query, search_index, maximum=5):
    normalized_query = normalize(query)
    matches_by_food = {}

    for entry in search_index:
        candidate = entry["normalized"]

        if not candidate:
            continue

        if normalized_query == candidate:
            score = 1.0
        elif (
            normalized_query in candidate
            or candidate in normalized_query
        ):
            score = 0.92
        else:
            score = SequenceMatcher(
                None,
                normalized_query,
                candidate,
            ).ratio()

        food_id = entry["food"]["id"]
        previous = matches_by_food.get(food_id)

        if previous is None or score > previous["score"]:
            matches_by_food[food_id] = {
                "score": score,
                "matchedTerm": entry["term"],
                "food": entry["food"],
            }

    matches = sorted(
        matches_by_food.values(),
        key=lambda item: item["score"],
        reverse=True,
    )

    return [
        match
        for match in matches[:maximum]
        if match["score"] >= 0.55
    ]


def calculate_nutrients(food, amount_grams):
    factor = amount_grams / 100
    calculated = {}

    for nutrient, value in food["nutrientsPer100g"].items():
        if value is None:
            calculated[nutrient] = None
        else:
            calculated[nutrient] = round(
                value * factor,
                2,
            )

    return calculated


def choose_match(matches):
    if not matches:
        return None

    print("\nPossible nutrition matches:")

    for number, match in enumerate(matches, start=1):
        food = match["food"]
        confidence = round(match["score"] * 100)

        print(
            f"{number}. {food['name']} "
            f"[{food['state']}] "
            f"({confidence}% name similarity)"
        )

    print("0. None of these")

    while True:
        answer = input("Select the correct food: ").strip()

        if answer.isdigit():
            selection = int(answer)

            if selection == 0:
                return None

            if 1 <= selection <= len(matches):
                return matches[selection - 1]

        print("Enter one of the displayed numbers.")


def read_positive_number(prompt):
    while True:
        value = input(prompt).strip()

        try:
            number = float(value)

            if number > 0:
                return number
        except ValueError:
            pass

        print("Enter a number greater than zero.")


def main():
    database = load_database()
    foods = database["foods"]
    search_index = build_search_index(foods)

    if len(sys.argv) >= 2:
        query = sys.argv[1]
    else:
        query = input(
            "Enter the confirmed food name: "
        ).strip()

    matches = find_matches(query, search_index)
    selected_match = choose_match(matches)

    if selected_match is None:
        print(
            "No food was selected. Add the correct product "
            "or its nutrition label to nutrition_db.json."
        )
        return

    food = selected_match["food"]

    if food.get("requiresNutritionLabel"):
        print(
            "This is a branded product and its nutrition label "
            "is required before calculation."
        )
        return

    print(f"\nSelected: {food['name']}")
    print(f"Food state: {food['state']}")
    print(
        "Confirm that the food state is correct; for example, "
        "dry pasta and cooked pasta are not interchangeable."
    )

    if len(sys.argv) >= 3:
        try:
            amount_grams = float(sys.argv[2])
        except ValueError:
            amount_grams = read_positive_number(
                "Amount consumed in grams: "
            )
    else:
        amount_grams = read_positive_number(
            "Amount consumed in grams: "
        )

    nutrients = calculate_nutrients(
        food,
        amount_grams,
    )

    result = {
        "query": query,
        "confirmedFoodId": food["id"],
        "confirmedFoodName": food["name"],
        "foodState": food["state"],
        "amountConsumed": {
            "value": amount_grams,
            "unit": "g",
        },
        "nutrients": nutrients,
        "source": {
            "name": database["source"]["name"],
            "fdcId": food["sourceFdcId"],
        },
        "warnings": [
            "This result uses a generic food-composition record unless "
            "an exact nutrition label was entered.",
            "Null nutrient values mean unknown, not zero.",
        ],
    }

    with OUTPUT_PATH.open("w", encoding="utf-8") as file:
        json.dump(
            result,
            file,
            ensure_ascii=False,
            indent=2,
        )

    print("\nCalculated nutrients:")

    for nutrient, value in nutrients.items():
        print(f"- {nutrient}: {value}")

    print(f"\nSaved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
