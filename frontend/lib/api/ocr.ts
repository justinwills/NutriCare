import { apiRequest } from "./client";
import type { OcrPlanWarning, ScannedPantryItem } from "@/lib/types/api";

export interface ReceiptScanResult {
  products: ScannedPantryItem[];
  planWarnings: OcrPlanWarning[];
}

export async function scanReceipt(imageData: string): Promise<ReceiptScanResult> {
  return apiRequest<ReceiptScanResult>("/ocr/scan", {
    method: "POST",
    body: { imageData },
  });
}

export async function checkDetectedFoodNames(foodNames: string[]): Promise<OcrPlanWarning[]> {
  const result = await apiRequest<{ planWarnings: OcrPlanWarning[] }>("/ocr/check-foods", {
    method: "POST",
    body: { foodNames },
  });
  return result.planWarnings;
}
