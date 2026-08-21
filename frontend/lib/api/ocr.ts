import { apiRequest } from "./client";
import type { ScannedPantryItem } from "@/lib/types/api";

export async function scanReceipt(imageData: string): Promise<ScannedPantryItem[]> {
  const result = await apiRequest<{ products: ScannedPantryItem[] }>("/ocr/scan", {
    method: "POST",
    body: { imageData },
  });
  return result.products;
}
