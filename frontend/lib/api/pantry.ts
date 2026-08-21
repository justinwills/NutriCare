import { apiRequest } from "./client";
import { parsePantryItem, type PantryItemView } from "./parse";
import type { BaseUnit, MeasurementUnit, RawPantryItem } from "@/lib/types/api";

export interface CreatePantryItemInput {
  productName: string;
  baseUnit: BaseUnit;
  initialQuantity: number;
  rawName?: string;
  expirationDate?: string; // "YYYY-MM-DD"
  source?: "ocr_online" | "ocr_receipt" | "manual";
}

export async function createPantryItem(
  input: CreatePantryItemInput
): Promise<PantryItemView> {
  const result = await apiRequest<{ item: RawPantryItem }>("/pantry", {
    method: "POST",
    body: input,
  });
  return parsePantryItem(result.item);
}

export async function listPantryItems(): Promise<PantryItemView[]> {
  const result = await apiRequest<{ items: RawPantryItem[] }>("/pantry");
  return result.items.map(parsePantryItem);
}

// Backend REJECTS cross-dimension conversion (a volume unit against a
// g-based item, or vice versa) rather than approximating — verified
// against units.js. Callers should only offer units matching the
// target item's baseUnit dimension; see MeasurementUnit's comment in
// lib/types/api.ts for which units are mass vs volume.
export async function deductFromPantryItem(
  itemId: string,
  quantityUsed: number,
  unit: MeasurementUnit
): Promise<{ item: PantryItemView; notificationCreated: boolean; itemDeleted: boolean }> {
  const result = await apiRequest<{
    item: RawPantryItem;
    notificationCreated: boolean;
    itemDeleted: boolean;
  }>(
    `/pantry/${itemId}/deduct`,
    { method: "POST", body: { quantityUsed, unit } }
  );
  return {
    item: parsePantryItem(result.item),
    notificationCreated: result.notificationCreated,
    itemDeleted: result.itemDeleted,
  };
}

export async function checkExpiringItems(): Promise<number> {
  const result = await apiRequest<{ checked: boolean; alertsCreated: number }>(
    "/pantry/check-expiring",
    { method: "POST" }
  );
  return result.alertsCreated;
}
