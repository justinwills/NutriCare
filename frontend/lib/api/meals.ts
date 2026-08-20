import { apiRequest } from "./client";
import { parseMealItem, type MealItemView } from "./parse";
import type { MealItemInput, RawMeal } from "@/lib/types/api";

export interface MealView {
  id: string;
  notes: string | null;
  loggedAt: string;
  items: MealItemView[];
}

function parseMeal(raw: RawMeal): MealView {
  return {
    id: raw.id,
    notes: raw.notes,
    loggedAt: raw.logged_at,
    items: (raw.items ?? []).map(parseMealItem),
  };
}

// Each item with a pantryItemId triggers a real deduction server-side.
// If ANY item in the array fails (e.g. insufficient stock on one
// ingredient), the WHOLE meal log fails — verified in meals.js, the
// backend wraps this in a transaction and rolls back on any item
// error. The form should surface that as one failure, not partial
// success on some items.
export async function logMeal(input: {
  notes?: string;
  items: MealItemInput[];
}): Promise<MealView> {
  const result = await apiRequest<{ meal: Omit<RawMeal, "items">; items: RawMeal["items"] }>(
    "/meals",
    { method: "POST", body: input }
  );
  return parseMeal({ ...result.meal, items: result.items });
}

export async function listMeals(): Promise<MealView[]> {
  const result = await apiRequest<{ meals: RawMeal[] }>("/meals");
  return result.meals.map(parseMeal);
}
