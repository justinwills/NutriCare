import json
from pathlib import Path


GROCERIES_PATH = Path("ocr-output/all_groceries_nutrition.json")
RESTRICTIONS_PATH = Path("patient_restrictions.json")
OUTPUT_PATH = Path("ocr-output/restriction_alerts.json")


def load_json(path):
    if not path.exists():
        raise FileNotFoundError(f"Required file not found: {path}")

    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def nutrient_per_100g(product, nutrient_key):
    """Derive a per-100-g value from the full-package calculation."""
    weight_g = product.get("calculatedWeightG")
    nutrients = product.get("nutrientsForFullPurchase") or {}
    full_value = nutrients.get(nutrient_key)

    if weight_g in (None, 0) or full_value is None:
        return None

    return round((float(full_value) / float(weight_g)) * 100, 2)


def make_alert(product, reason, severity, rule_type, notifications):
    return {
        "alertType": "RESTRICTED_PURCHASE_DETECTED",
        "ruleType": rule_type,
        "severity": severity,
        "product": product.get("matchedFoodName")
        or product.get("ocrProductName")
        or "Unknown product",
        "foodId": product.get("matchedFoodId"),
        "reason": reason,
        "detectedFrom": "receipt_ocr",
        "purchaseDetected": True,
        "consumptionConfirmed": False,
        "requiresHumanConfirmation": True,
        "notifyPatient": bool(notifications.get("notifyPatient", True)),
        "notifyDoctor": bool(notifications.get("notifyDoctor", True)),
    }


def main():
    groceries = load_json(GROCERIES_PATH)
    restrictions = load_json(RESTRICTIONS_PATH)

    notifications = restrictions.get("notificationSettings", {})
    products = groceries.get("products", [])
    alerts = []
    review_items = []

    restricted_foods = {
        rule.get("foodId"): rule
        for rule in restrictions.get("restrictedFoods", [])
        if rule.get("enabled") is True and rule.get("foodId")
    }

    nutrient_rules = [
        rule
        for rule in restrictions.get("nutrientRules", [])
        if rule.get("enabled") is True
        and rule.get("nutrient")
        and rule.get("maximumPer100g") is not None
    ]

    for product in products:
        status = product.get("status")
        food_id = product.get("matchedFoodId")

        if status != "calculated_needs_confirmation":
            review_items.append({
                "product": product.get("ocrProductName", "Unknown product"),
                "status": status,
                "message": product.get(
                    "message",
                    "This item requires manual review before checking restrictions.",
                ),
            })
            continue

        food_rule = restricted_foods.get(food_id)

        if food_rule:
            alerts.append(
                make_alert(
                    product=product,
                    reason=food_rule.get("reason", "Doctor-defined food restriction"),
                    severity=food_rule.get("severity", "warning"),
                    rule_type="restricted_food",
                    notifications=notifications,
                )
            )

        for rule in nutrient_rules:
            nutrient = rule["nutrient"]
            value = nutrient_per_100g(product, nutrient)
            maximum = float(rule["maximumPer100g"])

            if value is None or value <= maximum:
                continue

            alert = make_alert(
                product=product,
                reason=rule.get("reason", "Doctor-defined nutrient restriction"),
                severity=rule.get("severity", "warning"),
                rule_type="nutrient_limit",
                notifications=notifications,
            )
            alert.update({
                "nutrient": nutrient,
                "detectedValuePer100g": value,
                "doctorMaximumPer100g": maximum,
            })
            alerts.append(alert)

    output = {
        "patientId": restrictions.get("patientId"),
        "doctorId": restrictions.get("doctorId"),
        "source": str(GROCERIES_PATH),
        "summary": {
            "productsChecked": len(products),
            "alertsCreated": len(alerts),
            "itemsNeedingReview": len(review_items),
        },
        "alerts": alerts,
        "itemsNeedingReview": review_items,
        "importantNotice": (
            "These alerts indicate a possible restricted purchase found by receipt OCR. "
            "They do not prove that the patient consumed the product."
        ),
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with OUTPUT_PATH.open("w", encoding="utf-8") as file:
        json.dump(output, file, ensure_ascii=False, indent=2)

    print("Restriction check completed.")
    print(f"Products checked: {output['summary']['productsChecked']}")
    print(f"Alerts created: {output['summary']['alertsCreated']}")
    print(f"Items needing review: {output['summary']['itemsNeedingReview']}")
    print(f"Result: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()