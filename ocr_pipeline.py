"""Run receipt OCR and return pantry-ready products as JSON.

This is intentionally a command-line program: the Node backend writes an
uploaded image to a private temporary file, calls this program, then deletes
the file.  Nothing from a user's receipt is stored in the repository.
"""

import json
import re
import sys
import tempfile
import os

from paddleocr import PaddleOCR


IGNORED_TERMS = (
    "refund", "add to cart", "invoice", "customer service", "delivered",
    "delivery", "address", "actual payment", "unit price", "quantity",
    "specification", "total", "production date", "packaging fee",
)
SIZE_PATTERN = re.compile(r"(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b", re.IGNORECASE)
COUNT_PATTERN = re.compile(r"(?:x|×|\*)\s*(\d+)", re.IGNORECASE)


def useful_name(text):
    cleaned = text.strip()
    lower = cleaned.lower()
    return (
        bool(cleaned)
        and any(char.isalpha() for char in cleaned)
        and not any(term in lower for term in IGNORED_TERMS)
        and not SIZE_PATTERN.fullmatch(lower)
    )


def extract_products(lines):
    products = []
    candidates = []

    for index, line in enumerate(lines):
        original = line["originalText"]
        english = line["englishText"]
        combined = f"{original} {english}"
        lower = english.lower()

        if "specification" in lower or original.startswith("规格"):
            size_match = SIZE_PATTERN.search(combined)
            if not size_match:
                continue

            amount = float(size_match.group(1))
            unit = size_match.group(2).lower()
            package_count = int(COUNT_PATTERN.search(combined).group(1)) if COUNT_PATTERN.search(combined) else 1
            if unit == "kg":
                amount, unit = amount * 1000, "g"
            elif unit == "l":
                amount, unit = amount * 1000, "ml"

            name_line = next((item for item in reversed(candidates) if useful_name(item["englishText"])), None)
            if name_line:
                products.append({
                    "rawName": name_line["originalText"],
                    "suggestedName": name_line["englishText"],
                    "initialQuantity": amount * package_count,
                    "baseUnit": unit,
                    "confidence": name_line["ocrConfidence"],
                })
            candidates = []
            continue

        if useful_name(english):
            candidates.append(line)

    return products


def main():
    # The Node process consumes JSON as UTF-8. Windows terminals often default
    # to cp1252, which cannot print Chinese receipt text and crashes the scan.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    if len(sys.argv) != 2:
        raise SystemExit("Usage: ocr_pipeline.py IMAGE_PATH")

    ocr = PaddleOCR(
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        engine="paddle",
    )
    result = next(iter(ocr.predict(sys.argv[1])), None)
    if result is None:
        print(json.dumps({"products": [], "detectedLines": []}))
        return

    # `save_to_json` is the stable PaddleOCR result API used by the existing
    # prototype. Use an OS-managed temporary file so concurrent web requests
    # never overwrite one another's results.
    # NamedTemporaryFile keeps its handle open on Windows, which prevents
    # PaddleOCR from opening the same path to write. Create and close the
    # path first, then clean it up ourselves.
    file_descriptor, output_path = tempfile.mkstemp(suffix=".json")
    os.close(file_descriptor)
    try:
        result.save_to_json(output_path)
        with open(output_path, "r", encoding="utf-8") as output:
            payload = json.load(output)
    finally:
        os.unlink(output_path)
    data = payload.get("res", payload)
    texts = data.get("rec_texts", [])
    scores = data.get("rec_scores", [])
    lines = [
        {
            "originalText": text.strip(),
            # Keep receipt text local. The UI lets users review the detected
            # name before saving it to the pantry.
            "englishText": text.strip(),
            "ocrConfidence": float(scores[index]) if index < len(scores) else 0,
        }
        for index, text in enumerate(texts)
        if text.strip()
    ]
    print(json.dumps({"products": extract_products(lines), "detectedLines": lines}, ensure_ascii=False))


if __name__ == "__main__":
    main()
