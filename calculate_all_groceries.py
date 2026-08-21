import json
import re
from difflib import SequenceMatcher
from pathlib import Path


DATABASE_PATH = Path("nutrition_db.json")
PRODUCTS_PATH = Path("ocr-output/structured_products.json")
OUTPUT_PATH = Path("ocr-output/all_groceries_nutrition.json")

NUTRIENT_KEYS = [
    "caloriesKcal",
    "proteinG",
    "carbohydrateG",
    "fatG",
    "fiberG",
    "sugarG",
    "sodiumMg",
]

# Derived from USDA SR Legacy food-portion weights. One US cup is
# treated as 240 ml. These conversions are generic approximations;
# the product label should replace them when it supplies exact data.
DENSITY_G_PER_ML = {
    "milk_whole": 244 / 240,
    "honey": 339 / 240,
    "olive_oil": 216 / 240,
    "canola_oil": 218 / 240,
    "soy_sauce_shoyu": 255 / 240,
}


def normalize(text):
    text = str(text or "").casefold().strip()
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    return " ".join(text.split())


def load_json(path):
    if not path.exists():
        raise FileNotFoundError(f"Required file not found: {path}")

    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def similarity(query, candidate):
    query = normalize(query)
    candidate = normalize(candidate)

    if not query or not candidate:
        return 0.0

    if query == candidate:
        return 1.0

    if candidate in query or query in candidate:
        return 0.96

    query_tokens = set(query.split())
    candidate_tokens = set(candidate.split())
    overlap = query_tokens & candidate_tokens

    token_score = 0.0

    if overlap:
        token_score = len(overlap) / len(candidate_tokens)

    sequence_score = SequenceMatcher(
        None,
        query,
        candidate,
    ).ratio()

    return max(token_score, sequence_score)


def find_best_match(product_name, foods):
    best = None

    for food in foods:
        terms = [food["name"], *food.get("aliases", [])]

        for term in terms:
            score = similarity(product_name, term)

            if best is None or score > best["score"]:
                best = {
                    "food": food,
                    "score": score,
                    "matchedTerm": term,
                }

    if best is None or best["score"] < 0.60:
        return None

    return best


def product_total_amount(product):
    total = product.get("totalAmount")

    if total is not None:
        return float(total)

    size = product.get("packageSize")

    if size is None:
        return None

    package_count = product.get("packageCount", 1) or 1
    order_quantity = product.get("orderQuantity", 1) or 1

    return (
        float(size)
        * float(package_count)
        * float(order_quantity)
    )


def convert_to_grams(amount, unit, food_id):
    if amount is None:
        return None, "missing_package_amount"

    unit = normalize(unit)

    if unit in {"g", "gram", "grams"}:
        return amount, "exact_mass"

    if unit in {"kg", "kilogram", "kilograms"}:
        return amount * 1000, "exact_mass_conversion"

    if unit in {"mg", "milligram", "milligrams"}:
        return amount / 1000, "exact_mass_conversion"

    if unit in {"ml", "milliliter", "milliliters"}:
        density = DENSITY_G_PER_ML.get(food_id)

        if density is None:
            return None, "density_required"

        return amount * density, "estimated_from_usda_portion_density"

    if unit in {"l", "liter", "liters"}:
        density = DENSITY_G_PER_ML.get(food_id)

        if density is None:
            return None, "density_required"

        return (
            amount * 1000 * density,
            "estimated_from_usda_portion_density",
        )

    return None, "unsupported_unit"


def calculate_nutrients(food, grams):
    factor = grams / 100
    result = {}

    for key in NUTRIENT_KEYS:
        value = food["nutrientsPer100g"].get(key)

        if value is None:
            result[key] = None
        else:
            result[key] = round(value * factor, 2)

    return result


def main():
    database = load_json(DATABASE_PATH)
    structured = load_json(PRODUCTS_PATH)

    foods = database["foods"]
    products = structured.get("products", [])

    results = []
    inventory_totals = {key: 0.0 for key in NUTRIENT_KEYS}
    incomplete_nutrients = set()

    for product in products:
        ocr_name = product.get("productName") or "Unknown product"
        match = find_best_match(ocr_name, foods)

        item = {
            "ocrProduct": product,
            "ocrProductName": ocr_name,
        }

        if match is None:
            item.update({
                "status": "unmatched",
                "message": "No reliable nutrition match was found.",
            })
            incomplete_nutrients.update(NUTRIENT_KEYS)
            results.append(item)
            continue

        food = match["food"]
        confidence = round(match["score"], 3)

        item.update({
            "matchedFoodId": food["id"],
            "matchedFoodName": food["name"],
            "matchedAlias": match["matchedTerm"],
            "nameMatchConfidence": confidence,
            "foodState": food["state"],
            "sourceFdcId": food.get("sourceFdcId"),
            "reviewRequired": True,
        })

        if food.get("requiresNutritionLabel"):
            item.update({
                "status": "nutrition_label_required",
                "message": (
                    "This is a branded product. Scan or enter its "
                    "nutrition label before calculating nutrients."
                ),
            })
            incomplete_nutrients.update(NUTRIENT_KEYS)
            results.append(item)
            continue

        total_amount = product_total_amount(product)
        unit = product.get("unit")
        grams, conversion_method = convert_to_grams(
            total_amount,
            unit,
            food["id"],
        )

        item.update({
            "packageTotal": {
                "value": total_amount,
                "unit": unit,
            },
            "calculatedWeightG": (
                round(grams, 2)
                if grams is not None
                else None
            ),
            "unitConversionMethod": conversion_method,
        })

        if grams is None:
            item.update({
                "status": "quantity_conversion_required",
                "message": (
                    "The package amount could not be converted to "
                    "grams without additional information."
                ),
            })
            incomplete_nutrients.update(NUTRIENT_KEYS)
            results.append(item)
            continue

        nutrients = calculate_nutrients(food, grams)

        item.update({
            "status": "calculated_needs_confirmation",
            "calculationPurpose": "full_purchased_package_inventory",
            "nutrientsForFullPurchase": nutrients,
            "warnings": [
                "Confirm the food match and package quantity.",
                "These values describe the full purchased amount, not "
                "the amount eaten.",
                "Generic USDA food data may differ from the exact brand.",
            ],
        })

        for key, value in nutrients.items():
            if value is None:
                incomplete_nutrients.add(key)
            else:
                inventory_totals[key] += value

        results.append(item)

    output = {
        "sourceImage": structured.get("sourceImage"),
        "calculationPurpose": "full_purchased_package_inventory",
        "summary": {
            "productsReceived": len(products),
            "productsCalculated": sum(
                item.get("status") == "calculated_needs_confirmation"
                for item in results
            ),
            "productsNeedingReview": sum(
                item.get("status") != "calculated_needs_confirmation"
                for item in results
            ),
        },
        "inventoryTotalsKnownMinimum": {
            key: round(value, 2)
            for key, value in inventory_totals.items()
        },
        "incompleteNutrients": sorted(incomplete_nutrients),
        "products": results,
        "importantNotice": (
            "Inventory totals represent purchased package contents. "
            "Meal intake must be calculated separately from quantities "
            "manually entered by the user."
        ),
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with OUTPUT_PATH.open("w", encoding="utf-8") as file:
        json.dump(
            output,
            file,
            ensure_ascii=False,
            indent=2,
        )

    print("Automatic grocery nutrition calculation completed.")
    print(f"Products received: {output['summary']['productsReceived']}")
    print(f"Products calculated: {output['summary']['productsCalculated']}")
    print(
        "Products requiring additional review: "
        f"{output['summary']['productsNeedingReview']}"
    )
    print(f"Result: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
    