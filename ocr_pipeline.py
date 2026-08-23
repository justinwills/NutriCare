"""Run receipt OCR and return pantry-ready products as JSON.

This is intentionally a command-line program: the Node backend writes an
uploaded image to a private temporary file, calls this program, then deletes
the file.  Nothing from a user's receipt is stored in the repository.
"""

import json
import os
import re
import sys
import tempfile

# Disable oneDNN / MKLDNN in PaddleX & Paddle to avoid oneDNN PIR execution errors on CPU
os.environ["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "False"
os.environ["FLAGS_use_onednn"] = "0"

from paddleocr import PaddleOCR


IGNORED_TERMS = (
    # English Store, Market & Receipt Header/Footer terms
    "mart", "supermarket", "supercenter", "hypermarket", "grocery", "groceries",
    "convenience store", "express", "store", "shop", "market", "outlet", "branch",
    "plaza", "mall", "retail", "co.", "ltd", "inc", "corp", "corporation", "llc",
    "group", "company", "enterprise", "traders", "bazaar", "pharmacy", "bakery",
    "butcher", "cashier", "register", "pos", "terminal", "receipt", "tax invoice",
    "tax receipt", "order summary", "welcome", "thank you", "thanks", "visit us",
    "survey", "feedback", "return policy", "barcode", "clerk", "txn", "trans",
    "transaction", "ref", "auth", "approval", "subtotal", "sub-total", "total",
    "balance", "tax", "gst", "vat", "pst", "hst", "discount", "savings", "change",
    "cash", "debit", "credit", "visa", "mastercard", "amex", "apple pay",
    "google pay", "card", "account", "tip", "gratuity", "fee", "fees", "shipping",
    "courier", "driver", "carrier bag", "service charge", "welcome to", "copy",
    "customer copy", "merchant copy", "terminal id", "store id", "auth no", "seq no",

    # English Address & Location terms
    "street", "avenue", "road", "boulevard", "drive", "lane", "highway", "way",
    "suite", "unit", "floor", "building", "block", "district", "city", "town",
    "state", "zip", "postcode", "country", "location", "address",

    # Chinese Store, Market & Receipt Header/Footer terms
    "超市", "便利店", "生鲜", "农贸", "商行", "专卖店", "旗舰店", "分店", "分行",
    "总店", "体验店", "中心", "大卖场", "商场", "有限责任公司", "有限公司", "公司",
    "小票", "发票", "收银", "收银员", "交易", "单据", "生产日期", "包装费",
    "配送费", "基础包装费", "保温包装费", "基础配送费", "商品总额", "实付总额",
    "实付", "申请退款", "加购物车", "购物车", "退款", "单价", "数量", "规格",
    "小计", "合计", "优惠", "满减", "红包", "券", "支付", "微信", "支付宝",
    "订单号", "订单", "流水号", "日期", "时间", "门店", "店铺", "客服",
    "送达", "买单", "结账", "存根", "联", "感谢", "光临", "欢迎", "找零",
    "应收", "找钱", "扫码", "关注", "公众号", "会员", "积分", "卡号", "退换货",

    # Chinese Address & Location terms
    "路", "街", "巷", "弄", "道", "段", "号楼", "大厦", "园区", "广场",
)
SIZE_PATTERN = re.compile(r"(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b", re.IGNORECASE)
COUNT_PATTERN = re.compile(r"(?:x|×|\*)\s*(\d+)", re.IGNORECASE)
DATE_TIME_PATTERN = re.compile(
    r"(?:\d{2,4}[年\-\/. ]\d{1,2}[月\-\/. ]\d{1,2}|\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}|\d{1,2}:\d{2}(?::\d{2})?)",
    re.IGNORECASE
)
ADDRESS_PATTERN = re.compile(
    r"\b\d+\s+(?:[A-Za-z0-9\.]+\s+)*(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|highway|hwy|suite|ste|unit)\b"
    r"|\b(?:suite|ste|unit|floor|fl|bldg|building)\s*#?\s*\d+\b"
    r"|\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b"
    r"|\d+\s*(?:号|楼|层|室|区|市|省|县|镇|村)\b",
    re.IGNORECASE
)
PHONE_URL_PATTERN = re.compile(
    r"(?:tel|phone|ph|call|fax|电话|手机|联系电话)\s*[:：]?\s*\(?\d{3}\)?[\s\.\-]?\d{3}[\s\.\-]?\d{4}"
    r"|https?://|www\.|\.com|\.org|\.net|\.io|@"
    r"|^\s*(?:store|str|reg|register|trans|txn|order|inv|receipt|no|code|id|#)\s*[:：#]?\s*\d+",
    re.IGNORECASE
)


QUANTITY_PATTERN = re.compile(
    r"(?:数量|quantity|qty|count)\s*[:：]?\s*(\d+)",
    re.IGNORECASE
)
PREFIX_QTY_PATTERN = re.compile(
    r"^(\d+)\s*(?:x|×|\*)\s*",
    re.IGNORECASE
)
SUFFIX_QTY_PATTERN = re.compile(
    r"\s*(?:x|×|\*)\s*(\d+)$",
    re.IGNORECASE
)


FOOD_KEYWORDS = (
    # Dairy & Eggs
    "milk", "cheese", "butter", "yogurt", "yoghurt", "egg", "eggs", "cream", "margarine", "whey",
    "ghee", "curd", "paneer", "mozzarella", "cheddar", "parmesan", "brie", "feta",
    "牛奶", "鲜牛奶", "奶酪", "芝士", "黄油", "酸奶", "鸡蛋", "蛋", "奶油", "奶粉", "炼乳",

    # Meat, Poultry & Seafood
    "chicken", "beef", "pork", "meat", "lamb", "mutton", "steak", "bacon", "sausage", "ham",
    "turkey", "duck", "goose", "veal", "venison", "salami", "pepperoni", "meatball", "meatballs",
    "fish", "salmon", "tuna", "shrimp", "prawn", "crab", "squid", "lobster", "cod", "tilapia",
    "trout", "sardine", "anchovy", "seafood", "clam", "mussel", "oyster", "octopus", "scallop",
    "chicken breast", "chicken thigh", "chicken wing", "ground beef", "pork chop", "ribs",
    "鸡肉", "牛肉", "猪肉", "羊肉", "牛排", "培根", "香肠", "火腿", "鸡胸肉", "肉片", "肉丸",
    "肉", "鸡", "鸭", "鹅", "鱼", "三文鱼", "金枪鱼", "鳕鱼", "虾", "虾仁", "蟹", "鱿鱼", "海鲜", "素肉", "素啤酒肉片",

    # Produce, Vegetables & Fruits
    "apple", "apples", "banana", "bananas", "orange", "oranges", "grape", "grapes", "berry",
    "strawberry", "blueberry", "raspberry", "blackberry", "lemon", "lemons", "lime", "limes",
    "mango", "mangoes", "peach", "peaches", "pear", "pears", "plum", "plums", "watermelon",
    "melon", "cantaloupe", "honeydew", "cherry", "cherries", "kiwi", "pineapple", "papaya",
    "avocado", "avocados", "fig", "figs", "date", "dates", "raisin", "raisins",
    "tomato", "tomatoes", "potato", "potatoes", "onion", "onions", "garlic", "ginger", "spinach",
    "broccoli", "carrot", "carrots", "cucumber", "cucumbers", "lettuce", "cabbage", "mushroom",
    "mushrooms", "pepper", "peppers", "bell pepper", "chili", "corn", "pea", "peas", "bean", "beans",
    "celery", "asparagus", "zucchini", "eggplant", "pumpkin", "squash", "radish", "kale",
    "苹果", "香蕉", "橙", "橘", "柚", "葡萄", "草莓", "蓝莓", "柠檬", "芒果", "桃", "梨",
    "西瓜", "樱桃", "猕猴桃", "菠萝", "凤梨", "西红柿", "番茄", "土豆", "马铃薯", "洋葱",
    "大蒜", "蒜", "姜", "菠菜", "西兰花", "胡萝卜", "黄瓜", "生菜", "卷心菜", "包菜", "蘑菇",
    "香菇", "木耳", "辣椒", "花椒", "牛油果", "玉米", "豆", "豆腐", "豆浆", "蔬菜", "水果", "菜", "瓜", "果",

    # Grains, Bakery, Noodles & Pantry
    "bread", "toast", "rice", "oats", "oatmeal", "pasta", "spaghetti", "noodle", "noodles", "ramen",
    "flour", "cereal", "biscuit", "biscuits", "cookie", "cookies", "cracker", "crackers", "cake",
    "pie", "waffle", "waffles", "pancake", "pancakes", "muffin", "donut", "doughnut", "bagel",
    "oil", "olive oil", "vegetable oil", "canola oil", "vinegar", "sauce", "soy sauce", "ketchup",
    "mustard", "mayo", "mayonnaise", "dressing", "sugar", "salt", "pepper", "spice", "spices",
    "seasoning", "honey", "jam", "jelly", "syrup", "peanut butter", "nut", "nuts", "almond",
    "almonds", "walnut", "walnuts", "cashew", "cashews", "pistachio", "hazelnut", "peanut", "peanuts",
    "面", "面包", "吐司", "大米", "米", "糙米", "燕麦", "麦片", "意面", "意大利面", "面条",
    "挂面", "方便面", "拉面", "米粉", "面粉", "饼干", "蛋糕", "面包", "油", "橄榄油", "菜籽油", "花生油",
    "醋", "酱", "酱油", "生抽", "老抽", "蚝油", "番茄酱", "沙拉酱", "糖", "白糖", "红糖", "盐",
    "食盐", "调料", "辣椒酱", "蜂蜜", "果酱", "花生酱", "坚果", "核桃", "腰果", "杏仁", "花生",

    # Beverages
    "water", "spring water", "mineral water", "juice", "apple juice", "orange juice", "tea",
    "green tea", "black tea", "iced tea", "coffee", "latte", "espresso", "soda", "cola", "coke",
    "pepsi", "sprite", "drink", "drinks", "beverage", "beverages", "beer", "ale", "wine", "cider",
    "水", "纯净水", "矿泉水", "果汁", "茶", "绿茶", "红茶", "乌龙茶", "奶茶", "咖啡", "拿铁",
    "汽水", "可乐", "饮品", "饮料", "啤酒", "红酒", "葡萄酒", "酒",

    # Snacks, Processed & Packaged Food
    "snack", "snacks", "chips", "crisps", "popcorn", "chocolate", "candy", "candies", "gummy",
    "ice cream", "pudding", "yogurt drink", "food", "dish", "soup", "salad", "combo", "set", "pack",
    "slice", "slices", "shredded", "frozen", "fresh", "organic", "raw", "cooked", "baked", "roast",
    "fried", "grilled", "canned", "instant",
    "零食", "薯片", "巧克力", "糖果", "冰淇淋", "雪糕", "布丁", "食品", "小吃", "汤", "沙拉",
    "套餐", "片", "块", "碎", "冻", "冷冻", "新鲜", "有机", "熟食", "烘焙", "方便", "罐头",
    "盒装", "袋装", "瓶装",
)


def useful_name(text):
    cleaned = text.strip()
    lower = cleaned.lower()
    if not cleaned:
        return False

    # Filter out store terms, receipt metadata, and address keywords
    if any(term in lower for term in IGNORED_TERMS):
        return False

    # Filter out dates and timestamps
    if DATE_TIME_PATTERN.search(cleaned):
        return False

    # Filter out street addresses and location strings
    if ADDRESS_PATTERN.search(cleaned):
        return False

    # Filter out phone numbers, URLs, emails, and store/terminal/register IDs
    if PHONE_URL_PATTERN.search(cleaned):
        return False

    # Filter out pure numbers, prices, or punctuation
    if re.fullmatch(r"^[\d\s.,\$¥￥€\*\×xX\-+/:：\?？!！#]+$", cleaned):
        return False

    # Ignore pure size/quantity spec lines (e.g. "0ml*2盒", "100g", "950ml*2盒", "100g/袋")
    if re.search(r"^\d+\s*(?:kg|g|ml|l)\b", cleaned, re.IGNORECASE):
        return False

    has_alpha_or_cjk = any(
        char.isalpha() or '\u4e00' <= char <= '\u9fff'
        for char in cleaned
    )
    if not has_alpha_or_cjk:
        return False

    if SIZE_PATTERN.fullmatch(cleaned) or SIZE_PATTERN.fullmatch(lower):
        return False

    return True


def is_valid_product_line(text, is_fallback=False):
    """Validate if a line represents an actual food/grocery product."""
    if not useful_name(text):
        return False

    cleaned = text.strip()
    lower = cleaned.lower()

    if len(cleaned) < 3:
        return False

    if lower in ("id", "no", "no.", "ref", "pos", "tax", "vat", "gst", "sub", "qty", "amt", "pct", "sum", "org"):
        return False

    # 1. If it has a package size/unit spec (e.g. "1L", "500g", "250ml"), it is a product line
    if SIZE_PATTERN.search(cleaned):
        return True

    # 2. If it matches any food/beverage keyword in our vocabulary
    if any(kw in lower for kw in FOOD_KEYWORDS):
        return True

    # Strict rejection: If it lacks both a size/unit AND a food keyword, it is receipt noise!
    return False


def parse_quantity(text):
    """Extract quantity and cleaned product name.
    Handles:
    - Left/Leading quantities: '1 Fresh Milk 1L', '2x Milk', '1.000 Milk', '2 - Milk'
    - Right/Trailing quantities: 'Fresh Milk 1L x2', 'Fresh Milk 1L 2'
    """
    cleaned_text = text.strip()

    # 1. Try leading quantity on left (e.g. "1 Fresh Milk 1L", "2x Milk", "1.000 Milk", "2 - Milk")
    leading_match = re.match(
        r"^\s*(\d+(?:\.0+)?)\s*(?:[xX×\*:\-\)\].]\s*|\s+)",
        cleaned_text
    )
    if leading_match:
        qty_str = leading_match.group(1)
        try:
            qty = int(float(qty_str))
            if 1 <= qty <= 999:
                remainder = cleaned_text[leading_match.end():].strip()
                if useful_name(remainder):
                    return qty, remainder
        except ValueError:
            pass

    # 2. Try trailing quantity on right (e.g. "Fresh Milk 1L x2", "Fresh Milk 1L 2")
    trailing_match = re.search(
        r"\s+(?:[xX×\*:\-\)\].]\s*)?(\d+(?:\.0+)?)\s*$",
        cleaned_text
    )
    if trailing_match:
        qty_str = trailing_match.group(1)
        try:
            qty = int(float(qty_str))
            if 1 <= qty <= 999:
                remainder = cleaned_text[:trailing_match.start()].strip()
                if useful_name(remainder):
                    return qty, remainder
        except ValueError:
            pass

    return 1, cleaned_text


def extract_products(lines):
    products = []
    candidates = []

    # Strategy 1: Look for "规格" or "specification" lines (Structured online order receipts)
    current_product = None
    for index, line in enumerate(lines):
        original = line["originalText"]
        english = line["englishText"]
        combined = f"{original} {english}"
        lower = english.lower()

        is_spec = "specification" in lower or original.startswith("规格")

        if is_spec:
            if current_product:
                products.append({
                    "rawName": current_product["rawName"],
                    "suggestedName": current_product["suggestedName"],
                    "initialQuantity": current_product["packageSize"] * current_product["packageCount"] * current_product["orderQuantity"],
                    "baseUnit": current_product["baseUnit"],
                    "confidence": current_product["confidence"],
                })
                current_product = None

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
                raw_name = name_line["originalText"]
                sug_name = name_line["englishText"]
                order_qty, sug_name = parse_quantity(sug_name)
                current_product = {
                    "rawName": raw_name,
                    "suggestedName": sug_name,
                    "packageSize": amount,
                    "packageCount": package_count,
                    "orderQuantity": order_qty,
                    "baseUnit": unit,
                    "confidence": name_line["ocrConfidence"],
                }
            candidates = []
            continue

        if current_product:
            qty_match = QUANTITY_PATTERN.search(combined)
            if qty_match:
                current_product["orderQuantity"] = int(qty_match.group(1))
                products.append({
                    "rawName": current_product["rawName"],
                    "suggestedName": current_product["suggestedName"],
                    "initialQuantity": current_product["packageSize"] * current_product["packageCount"] * current_product["orderQuantity"],
                    "baseUnit": current_product["baseUnit"],
                    "confidence": current_product["confidence"],
                })
                current_product = None
                continue

        if useful_name(english):
            candidates.append(line)

    if current_product:
        products.append({
            "rawName": current_product["rawName"],
            "suggestedName": current_product["suggestedName"],
            "initialQuantity": current_product["packageSize"] * current_product["packageCount"] * current_product["orderQuantity"],
            "baseUnit": current_product["baseUnit"],
            "confidence": current_product["confidence"],
        })
        current_product = None

    if products:
        return products

    # Strategy 2: Inline size/unit + purchase quantity detection (e.g. "1 Fresh Milk 1L", "2x Milk 1L", "Milk 1L x2")
    for idx, line in enumerate(lines):
        original = line["originalText"]
        english = line["englishText"]
        text_to_check = english if useful_name(english) else original
        if not useful_name(text_to_check):
            continue

        order_qty, text_after_qty = parse_quantity(text_to_check)
        if order_qty == 1 and idx + 1 < len(lines):
            next_text = f"{lines[idx+1]['originalText']} {lines[idx+1]['englishText']}"
            next_qty_match = QUANTITY_PATTERN.search(next_text)
            if next_qty_match:
                order_qty = int(next_qty_match.group(1))

        size_match = SIZE_PATTERN.search(text_after_qty)
        if size_match:
            amount = float(size_match.group(1))
            unit = size_match.group(2).lower()
            package_count = int(COUNT_PATTERN.search(text_after_qty).group(1)) if COUNT_PATTERN.search(text_after_qty) else 1
            if unit == "kg":
                amount, unit = amount * 1000, "g"
            elif unit == "l":
                amount, unit = amount * 1000, "ml"

            clean_name = SIZE_PATTERN.sub("", text_after_qty)
            clean_name = COUNT_PATTERN.sub("", clean_name).strip(" -:：,")
            if useful_name(clean_name):
                products.append({
                    "rawName": original,
                    "suggestedName": clean_name,
                    "initialQuantity": amount * package_count * order_qty,
                    "baseUnit": unit,
                    "confidence": line["ocrConfidence"],
                })

    if products:
        return products

    # Strategy 3: General product name candidate fallback with left/right quantity detection
    for idx, line in enumerate(lines):
        english = line["englishText"]
        original = line["originalText"]
        name_text = english if useful_name(english) else original
        if not is_valid_product_line(name_text, is_fallback=True):
            continue

        order_qty, clean_name = parse_quantity(name_text)
        if order_qty == 1 and idx + 1 < len(lines):
            next_text = f"{lines[idx+1]['originalText']} {lines[idx+1]['englishText']}"
            next_qty_match = QUANTITY_PATTERN.search(next_text)
            if next_qty_match:
                order_qty = int(next_qty_match.group(1))

        if is_valid_product_line(clean_name, is_fallback=True):
            products.append({
                "rawName": original,
                "suggestedName": clean_name,
                "initialQuantity": order_qty,
                "baseUnit": "item",
                "confidence": line["ocrConfidence"],
            })

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
