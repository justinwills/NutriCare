import json
from pathlib import Path

from deep_translator import GoogleTranslator
from paddleocr import PaddleOCR


IMAGE_PATH = "test.jpg"

OUTPUT_FOLDER = Path("ocr-output")
OCR_JSON_PATH = OUTPUT_FOLDER / "test_res.json"
TRANSLATED_JSON_PATH = OUTPUT_FOLDER / "translated_ocr.json"

OUTPUT_FOLDER.mkdir(exist_ok=True)


# 1. Run OCR
ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    engine="paddle",
)

results = ocr.predict(IMAGE_PATH)

for result in results:
    result.save_to_json(str(OCR_JSON_PATH))
    result.save_to_img(str(OUTPUT_FOLDER))


# 2. Read the saved OCR result
with OCR_JSON_PATH.open(
    "r",
    encoding="utf-8",
) as file:
    ocr_json = json.load(file)


# PaddleOCR versions may store the result directly
# or inside a field named "res".
ocr_data = ocr_json.get("res", ocr_json)

texts = ocr_data.get("rec_texts", [])
scores = ocr_data.get("rec_scores", [])


# 3. Automatically translate every detected line
translator = GoogleTranslator(
    source="auto",
    target="en",
)

translated_lines = []

for index, original_text in enumerate(texts):
    original_text = original_text.strip()

    if not original_text:
        continue

    try:
        english_text = translator.translate(
            original_text
        )

        translation_status = "success"

    except Exception as error:
        english_text = original_text
        translation_status = f"failed: {error}"

    confidence = None

    if index < len(scores):
        confidence = scores[index]

    translated_lines.append({
        "originalText": original_text,
        "englishText": english_text,
        "ocrConfidence": confidence,
        "translationStatus": translation_status,
    })

    print(f"{original_text} -> {english_text}")


# 4. Save translated results
output_data = {
    "sourceImage": IMAGE_PATH,
    "targetLanguage": "English",
    "detectedLines": translated_lines,
}

with TRANSLATED_JSON_PATH.open(
    "w",
    encoding="utf-8",
) as file:
    json.dump(
        output_data,
        file,
        ensure_ascii=False,
        indent=2,
    )


print()
print("OCR and translation completed.")
print(f"Result: {TRANSLATED_JSON_PATH}")