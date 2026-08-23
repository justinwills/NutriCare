import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { toBaseUnit } from "./units.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nutritionDbPath = path.resolve(__dirname, "../../../nutrition_db.json");
const commonGroceriesPath = path.resolve(
  __dirname,
  "../../../common_groceries.json",
);
const additionalFoodsPath = path.resolve(
  __dirname,
  "../../../additional_foods.json",
);
const nutritionDb = JSON.parse(fs.readFileSync(nutritionDbPath, "utf8"));
const commonGroceries = JSON.parse(
  fs.readFileSync(commonGroceriesPath, "utf8"),
);
const additionalFoods = JSON.parse(
  fs.readFileSync(additionalFoodsPath, "utf8"),
);

const NUTRIENT_KEYS = [
  "caloriesKcal",
  "proteinG",
  "carbohydrateG",
  "fatG",
  "fiberG",
  "sugarG",
  "sodiumMg",
];

function normalizeFoodLabel(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const foodTerms = [
  ...nutritionDb.foods,
  ...commonGroceries,
  ...additionalFoods,
].flatMap((food) =>
  [food.name, ...(food.aliases || [])]
    .map((term) => ({ food, term: normalizeFoodLabel(term) }))
    .filter((entry) => entry.term),
);

function findFood(label) {
  const normalized = normalizeFoodLabel(label);
  if (!normalized) return null;

  const exact = foodTerms.find((entry) => entry.term === normalized);
  if (exact) return exact.food;

  // Accept descriptive labels such as "grilled chicken breast" while
  // preferring the longest matching food term over a short generic alias.
  const contained = foodTerms
    .filter(({ term }) => term.length >= 4 && normalized.includes(term))
    .sort((a, b) => b.term.length - a.term.length)[0];
  if (contained) return contained.food;

  // A short manual label such as "rice" can still identify a longer
  // database term such as "white rice". Limit this fallback to a single
  // complete token so partial words do not create surprising matches.
  if (!normalized.includes(" ") && normalized.length >= 4) {
    const tokenMatch = foodTerms.find(({ term }) =>
      term.split(" ").includes(normalized),
    );
    if (tokenMatch) return tokenMatch.food;
  }

  return null;
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateMealNutrition(items) {
  const totals = Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, 0]));
  const matchedItems = [];
  const unmatchedItems = [];

  for (const item of items) {
    const food = findFood(item.label);
    if (!food || food.requiresNutritionLabel) {
      unmatchedItems.push({
        itemId: item.id,
        label: item.label,
        reason: food?.requiresNutritionLabel
          ? "This branded food needs its nutrition label."
          : "No matching food-composition record.",
      });
      continue;
    }

    let quantityGrams;
    try {
      quantityGrams = toBaseUnit(item.quantity_used, item.unit, "g");
    } catch {
      unmatchedItems.push({
        itemId: item.id,
        label: item.label,
        reason: "Nutrition calculation currently requires a mass unit.",
      });
      continue;
    }

    const factor = quantityGrams / 100;
    for (const key of NUTRIENT_KEYS) {
      const per100g = Number(food.nutrientsPer100g?.[key]);
      if (Number.isFinite(per100g)) totals[key] += per100g * factor;
    }

    matchedItems.push({
      itemId: item.id,
      label: item.label,
      foodId: food.id,
      foodName: food.name,
      foodState: food.state,
      quantityGrams: round(quantityGrams),
    });
  }

  for (const key of NUTRIENT_KEYS) totals[key] = round(totals[key]);

  return {
    totals,
    matchedItems,
    unmatchedItems,
    source: nutritionDb.source?.name || "Food composition database",
    estimated: true,
  };
}
