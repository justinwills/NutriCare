import { apiRequest } from "./client";

export interface FoodGalleryEntry {
  id: string;
  patient_id: string;
  meal_id: string | null;
  image_data: string;
  detected_foods: Array<{
    name: string;
    estimatedQuantity: number;
    unit: string;
    confidence: number;
  }>;
  nutrition: Record<string, unknown>;
  created_at: string;
}

export async function listMyFoodGallery(): Promise<FoodGalleryEntry[]> {
  const result = await apiRequest<{ entries: FoodGalleryEntry[] }>(
    "/food-gallery",
  );
  return result.entries;
}

export async function saveFoodGalleryEntry(input: {
  imageData: string;
  detectedFoods: FoodGalleryEntry["detected_foods"];
  nutrition?: Record<string, unknown>;
}): Promise<FoodGalleryEntry> {
  const result = await apiRequest<{ entry: FoodGalleryEntry }>(
    "/food-gallery",
    {
      method: "POST",
      body: input,
    },
  );
  return result.entry;
}

export async function listPatientFoodGallery(
  patientId: string,
): Promise<FoodGalleryEntry[]> {
  const result = await apiRequest<{ entries: FoodGalleryEntry[] }>(
    `/food-gallery/patient/${patientId}`,
  );
  return result.entries;
}
