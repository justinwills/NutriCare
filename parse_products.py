import json
import re
from pathlib import Path


INPUT_PATH = Path(
    "ocr-output/translated_ocr.json"
)

OUTPUT_PATH = Path(
    "ocr-output/structured_products.json"
)


def extract_number(pattern, text):
    match = re.search(
        pattern,
        text,
        re.IGNORECASE,
    )

    if not match:
        return None

    return float(match.group(1))


def extract_package(text):
    size_match = re.search(
        r"(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b",
        text,
        re.IGNORECASE,
    )

    if not size_match:
        return {
            "packageSize": None,
            "unit": None,
            "packageCount": 1,
        }

    package_size = float(size_match.group(1))
    unit = size_match.group(2).lower()

    count_match = re.search(
        r"(?:x|×|\*)\s*(\d+)",
        text,
        re.IGNORECASE,
    )

    package_count = (
        int(count_match.group(1))
        if count_match
        else 1
    )

    return {
        "packageSize": package_size,
        "unit": unit,
        "packageCount": package_count,
    }


def is_product_name(text):
    lower_text = text.lower().strip()

    ignored_terms = [
        "refund",
        "add to cart",
        "delete order",
        "invoice",
        "customer service",
        "delivered",
        "delivery",
        "address",
        "actual payment",
        "unit price",
        "quantity",
        "specification",
        "total",
    ]

    if not lower_text:
        return False

    if any(
        term in lower_text
        for term in ignored_terms
    ):
        return False

    # Ignore values such as "100g" or "950ml"
    if re.fullmatch(
        r"[\d\s.,x×*]+(?:kg|g|ml|l)?",
        lower_text,
    ):
        return False

    # A product name should contain letters
    return any(
    character.isalpha()
    for character in text
    )


with INPUT_PATH.open(
    "r",
    encoding="utf-8",
) as file:
    translated_data = json.load(file)


lines = translated_data["detectedLines"]

products = []
current_product = None
possible_names = []


for line in lines:
    original = str(
    line.get("originalText") or ""
    ).strip()

    english = str(
    line.get("englishText") or original
    ).strip()

    english_lower = english.lower()

    is_specification = (
        original.startswith("规格")
        or english_lower.startswith(
            "specification"
        )
    )

    is_unit_price = (
        original.startswith("单价")
        or english_lower.startswith(
            "unit price"
        )
    )

    is_quantity = (
        original.startswith("数量")
        or english_lower.startswith(
            "quantity"
        )
    )

    if is_specification:
        if current_product:
            products.append(current_product)

        product_name = "Unknown product"

        for candidate in reversed(
            possible_names
        ):
            if is_product_name(candidate):
                product_name = candidate
                break

        package = extract_package(
            original + " " + english
        )

        current_product = {
            "productName": product_name,
            "packageSize":
                package["packageSize"],
            "unit": package["unit"],
            "packageCount":
                package["packageCount"],
            "orderQuantity": 1,
            "unitPrice": None,
            "currency": "CNY",
        }

        possible_names = []
        continue

    if is_unit_price and current_product:
        price = extract_number(
            r"[¥￥]\s*(\d+(?:\.\d+)?)",
            original + " " + english,
        )

        current_product["unitPrice"] = price
        continue

    if is_quantity and current_product:
        quantity = extract_number(
            r"(?:数量|quantity)"
            r"\s*[:：]?\s*(\d+)",
            original + " " + english,
        )

        if quantity is not None:
            current_product[
                "orderQuantity"
            ] = int(quantity)

        continue

    if is_product_name(english):
        possible_names.append(english)


if current_product:
    products.append(current_product)


# Calculate the total pantry amount
for product in products:
    size = product["packageSize"]
    packages = product["packageCount"]
    quantity = product["orderQuantity"]

    if size is not None:
        product["totalAmount"] = (
            size * packages * quantity
        )
    else:
        product["totalAmount"] = None


output = {
    "sourceImage":
        translated_data["sourceImage"],
    "products": products,
}


with OUTPUT_PATH.open(
    "w",
    encoding="utf-8",
) as file:
    json.dump(
        output,
        file,
        ensure_ascii=False,
        indent=2,
    )


print("Product extraction completed.")
print(f"Products detected: {len(products)}")
print(f"Result: {OUTPUT_PATH}")