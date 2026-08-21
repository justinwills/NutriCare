import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


GROCERIES_PATH = Path("ocr-output/all_groceries_nutrition.json")
PANTRY_PATH = Path("pantry_inventory.json")


def now_utc():
    return datetime.now(timezone.utc).isoformat()


def load_json(path, default=None):
    if not path.exists():
        if default is not None:
            return default
        raise FileNotFoundError(f"Required file not found: {path}")

    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_pantry(pantry):
    pantry["updatedAt"] = now_utc()

    with PANTRY_PATH.open("w", encoding="utf-8") as file:
        json.dump(pantry, file, ensure_ascii=False, indent=2)


def empty_pantry():
    return {
        "schemaVersion": "1.0",
        "items": [],
        "processedPurchaseIds": [],
        "updatedAt": now_utc(),
    }


def purchase_id(groceries):
    source = groceries.get("sourceImage")

    if source:
        return str(source)

    serialized = json.dumps(groceries, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]


def find_item(pantry, food_id):
    for item in pantry["items"]:
        if item.get("foodId") == food_id:
            return item

    return None


def refresh_status(item):
    remaining = float(item.get("remainingWeightG", 0))
    purchased = float(item.get("purchasedWeightG", 0))
    pending = float(item.get("pendingPurchasedWeightG", 0))

    if pending > 0:
        item["status"] = "needs_confirmation"
    elif remaining <= 0:
        item["status"] = "empty"
    elif purchased > 0 and remaining <= purchased * 0.2:
        item["status"] = "low_stock"
    else:
        item["status"] = "available"


def import_purchase():
    groceries = load_json(GROCERIES_PATH)
    pantry = load_json(PANTRY_PATH, empty_pantry())
    current_purchase_id = purchase_id(groceries)

    if current_purchase_id in pantry["processedPurchaseIds"]:
        print("This grocery result was already imported.")
        return

    imported = 0

    for product in groceries.get("products", []):
        if product.get("status") != "calculated_needs_confirmation":
            continue

        food_id = product.get("matchedFoodId")
        weight_g = product.get("calculatedWeightG")

        if not food_id or weight_g is None:
            continue

        item = find_item(pantry, food_id)

        if item is None:
            item = {
                "foodId": food_id,
                "foodName": product.get("matchedFoodName", food_id),
                "purchasedWeightG": 0.0,
                "remainingWeightG": 0.0,
                "pendingPurchasedWeightG": 0.0,
                "unit": "g",
                "status": "needs_confirmation",
            }
            pantry["items"].append(item)

        item["pendingPurchasedWeightG"] = round(
            float(item.get("pendingPurchasedWeightG", 0)) + float(weight_g),
            2,
        )
        refresh_status(item)
        imported += 1

    pantry["processedPurchaseIds"].append(current_purchase_id)
    save_pantry(pantry)

    print(f"Imported {imported} item(s) as pending confirmation.")
    print("Confirm each correct item before it becomes available stock.")
    print(f"Result: {PANTRY_PATH}")


def confirm_item(food_id):
    pantry = load_json(PANTRY_PATH, empty_pantry())
    item = find_item(pantry, food_id)

    if item is None:
        raise ValueError(f"Food ID not found in pantry: {food_id}")

    pending = float(item.get("pendingPurchasedWeightG", 0))

    if pending <= 0:
        print("This item has no pending purchase to confirm.")
        return

    item["purchasedWeightG"] = round(
        float(item.get("purchasedWeightG", 0)) + pending,
        2,
    )
    item["remainingWeightG"] = round(
        float(item.get("remainingWeightG", 0)) + pending,
        2,
    )
    item["pendingPurchasedWeightG"] = 0.0
    refresh_status(item)
    save_pantry(pantry)

    print(f"Confirmed {pending:g} g of {item['foodName']}.")
    print(f"Remaining stock: {item['remainingWeightG']:g} g")


def consume_item(food_id, grams):
    if grams <= 0:
        raise ValueError("Consumed grams must be greater than zero.")

    pantry = load_json(PANTRY_PATH, empty_pantry())
    item = find_item(pantry, food_id)

    if item is None:
        raise ValueError(f"Food ID not found in pantry: {food_id}")

    if float(item.get("pendingPurchasedWeightG", 0)) > 0:
        raise ValueError("Confirm this grocery item before recording consumption.")

    remaining = float(item.get("remainingWeightG", 0))

    if grams > remaining:
        raise ValueError(
            f"Not enough stock. Available: {remaining:g} g; requested: {grams:g} g."
        )

    item["remainingWeightG"] = round(remaining - grams, 2)
    item["lastConsumedAt"] = now_utc()
    refresh_status(item)
    save_pantry(pantry)

    print(f"Recorded {grams:g} g consumed from {item['foodName']}.")
    print(f"Remaining stock: {item['remainingWeightG']:g} g")


def list_items():
    pantry = load_json(PANTRY_PATH, empty_pantry())

    if not pantry["items"]:
        print("The pantry is empty.")
        return

    for item in pantry["items"]:
        print(
            f"{item['foodId']}: {item['remainingWeightG']:g} g remaining "
            f"({item['status']}), {item['pendingPurchasedWeightG']:g} g pending"
        )


def print_usage():
    print("Usage:")
    print("  python update_pantry.py import")
    print("  python update_pantry.py list")
    print("  python update_pantry.py confirm FOOD_ID")
    print("  python update_pantry.py consume FOOD_ID GRAMS")


def main():
    if len(sys.argv) < 2:
        print_usage()
        return

    command = sys.argv[1].casefold()

    if command == "import":
        import_purchase()
    elif command == "list":
        list_items()
    elif command == "confirm" and len(sys.argv) == 3:
        confirm_item(sys.argv[2])
    elif command == "consume" and len(sys.argv) == 4:
        consume_item(sys.argv[2], float(sys.argv[3]))
    else:
        print_usage()


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError, json.JSONDecodeError) as error:
        print(f"Error: {error}")
        raise SystemExit(1)