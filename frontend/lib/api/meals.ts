import { apiRequest } from "./client";
import { parseMealItem, type MealItemView } from "./parse";
import type { MealItemInput, MealNutrition, RawMeal } from "@/lib/types/api";

export interface MealView {
  id: string;
  notes: string | null;
  loggedAt: string;
  items: MealItemView[];
  nutrition: MealNutrition;
}

function parseMeal(raw: RawMeal): MealView {
  return {
    id: raw.id,
    notes: raw.notes,
    loggedAt: raw.logged_at,
    items: (raw.items ?? []).map(parseMealItem),
    nutrition: raw.nutrition,
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
  timezone?: string;
  items: MealItemInput[];
}): Promise<{ meal: MealView; alertsCreated: number }> {
  const result = await apiRequest<{
    meal: Omit<RawMeal, "items" | "nutrition">;
    items: RawMeal["items"];
    nutrition: MealNutrition;
    alertsCreated: number;
  }>(
    "/meals",
    { method: "POST", body: input }
  );
  return {
    meal: parseMeal({ ...result.meal, items: result.items, nutrition: result.nutrition }),
    alertsCreated: result.alertsCreated,
  };
}

export async function listMeals(): Promise<MealView[]> {
  const result = await apiRequest<{ meals: RawMeal[] }>("/meals");
  return result.meals.map(parseMeal);
}
