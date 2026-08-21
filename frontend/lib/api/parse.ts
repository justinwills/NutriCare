// Small helpers to normalize the raw snake_case/string-typed backend
// responses (see lib/types/api.ts) into what screens actually want to
// render with. Keeping this in one place means a screen component
// never has to remember "oh right, remaining_quantity is a string."

import type { RawPantryItem, RawMealItem, RawNotification } from "@/lib/types/api";

export interface PantryItemView {
  id: string;
  productName: string;
  rawName: string | null;
  baseUnit: RawPantryItem["base_unit"];
  initialQuantity: number;
  remainingQuantity: number;
  /** remainingQuantity / initialQuantity, 0–1. NaN-safe: 0 when initialQuantity is 0. */
  remainingRatio: number;
  /** Bare "2026-08-25" or null — expiration_date's timestamp component is always midnight, so
   *  callers doing date-only display/comparison don't need to deal with the full ISO string. */
  expirationDate: string | null;
  source: RawPantryItem["source"];
}

export function parsePantryItem(raw: RawPantryItem): PantryItemView {
  const initialQuantity = Number(raw.initial_quantity);
  const remainingQuantity = Number(raw.remaining_quantity);
  return {
    id: raw.id,
    productName: raw.product_name,
    rawName: raw.raw_name,
    baseUnit: raw.base_unit,
    initialQuantity,
    remainingQuantity,
    remainingRatio: initialQuantity > 0 ? remainingQuantity / initialQuantity : 0,
    expirationDate: raw.expiration_date ? raw.expiration_date.split("T")[0] : null,
    source: raw.source,
  };
}

export interface MealItemView {
  id: string;
  pantryItemId: string | null;
  label: string;
  quantityUsed: number;
  unit: RawMealItem["unit"];
  source: RawMealItem["entry_source"];
}

export function parseMealItem(raw: RawMealItem): MealItemView {
  return {
    id: raw.id,
    pantryItemId: raw.pantry_item_id,
    label: raw.label,
    quantityUsed: Number(raw.quantity_used),
    unit: raw.unit,
    source: raw.entry_source,
  };
}

export interface NotificationView {
  id: string;
  type: RawNotification["type"];
  message: string;
  read: boolean;
  createdAt: string;
  localDate: string | null;
  foodName: string | null;
  nutrientName: string | null;
  currentAmount: number | null;
  limitAmount: number | null;
  unit: string | null;
  metadata: Record<string, unknown>;
}

export function parseNotification(raw: RawNotification): NotificationView {
  return {
    id: raw.id,
    type: raw.type,
    message: raw.message,
    read: raw.read,
    createdAt: raw.created_at,
    localDate: raw.local_date,
    foodName: raw.food_name,
    nutrientName: raw.nutrient_name,
    currentAmount: raw.current_amount === null ? null : Number(raw.current_amount),
    limitAmount: raw.limit_amount === null ? null : Number(raw.limit_amount),
    unit: raw.unit,
    metadata: raw.metadata || {},
  };
}
