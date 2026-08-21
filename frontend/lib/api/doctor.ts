import { apiRequest } from "./client";
import type {
  DietaryLimit,
  DietaryLimitType,
  DietaryLimitUnit,
  DoctorPatientLink,
  FoodRecommendation,
  NutrientKey,
  RawNutritionTarget,
  RecommendationPriority,
  RecommendationType,
  SupervisionPlan,
} from "@/lib/types/api";

// GET /doctor/patients returns { id, full_name, email, status } —
// verified live, NOT the full user row. `id` here is the patient's
// user id (the endpoint's own SQL aliases it that way), not a
// separate link-row id.
export async function listMyPatients(): Promise<DoctorPatientLink[]> {
  const result = await apiRequest<{ patients: DoctorPatientLink[] }>("/doctor/patients");
  return result.patients;
}

export async function linkPatient(patientId: string): Promise<void> {
  await apiRequest("/doctor/link-patient", {
    method: "POST",
    body: { patientId },
  });
}

export async function getPatientPlan(patientId: string): Promise<SupervisionPlan> {
  const result = await apiRequest<{ plan: SupervisionPlan }>(
    `/doctor/patients/${patientId}/plan`
  );
  return result.plan;
}

export async function savePatientConditions(
  patientId: string,
  conditions: string[]
): Promise<void> {
  await apiRequest(`/doctor/patients/${patientId}/conditions`, {
    method: "PUT",
    body: { conditions },
  });
}

export interface DietaryLimitInput {
  limitType: DietaryLimitType;
  name: string;
  maximumAmount: number;
  unit: DietaryLimitUnit;
  explanation?: string;
  enabled: boolean;
}

export async function createDietaryLimit(
  patientId: string,
  input: DietaryLimitInput
): Promise<DietaryLimit> {
  const result = await apiRequest<{ limit: DietaryLimit }>(
    `/doctor/patients/${patientId}/limits`,
    { method: "POST", body: input }
  );
  return result.limit;
}

export async function updateDietaryLimit(
  patientId: string,
  limitId: string,
  input: Partial<DietaryLimitInput>
): Promise<DietaryLimit> {
  const result = await apiRequest<{ limit: DietaryLimit }>(
    `/doctor/patients/${patientId}/limits/${limitId}`,
    { method: "PATCH", body: input }
  );
  return result.limit;
}

export async function deleteDietaryLimit(patientId: string, limitId: string): Promise<void> {
  await apiRequest(`/doctor/patients/${patientId}/limits/${limitId}`, {
    method: "DELETE",
  });
}

export interface FoodRecommendationInput {
  recommendationType: RecommendationType;
  foodName: string;
  doctorReason: string;
  priority: RecommendationPriority;
  recommendedFrequency?: string;
}

export async function createFoodRecommendation(
  patientId: string,
  input: FoodRecommendationInput
): Promise<FoodRecommendation> {
  const result = await apiRequest<{ recommendation: FoodRecommendation }>(
    `/doctor/patients/${patientId}/recommendations`,
    { method: "POST", body: input }
  );
  return result.recommendation;
}

export async function updateFoodRecommendation(
  patientId: string,
  recommendationId: string,
  input: Partial<FoodRecommendationInput>
): Promise<FoodRecommendation> {
  const result = await apiRequest<{ recommendation: FoodRecommendation }>(
    `/doctor/patients/${patientId}/recommendations/${recommendationId}`,
    { method: "PATCH", body: input }
  );
  return result.recommendation;
}

export async function deleteFoodRecommendation(
  patientId: string,
  recommendationId: string
): Promise<void> {
  await apiRequest(`/doctor/patients/${patientId}/recommendations/${recommendationId}`, {
    method: "DELETE",
  });
}

export interface SetNutritionTargetInput {
  patientId: string;
  nutrient: NutrientKey;
  minValue?: number;
  maxValue?: number;
}

export async function setNutritionTarget(
  input: SetNutritionTargetInput
): Promise<RawNutritionTarget> {
  const result = await apiRequest<{ target: RawNutritionTarget }>(
    "/doctor/nutrition-targets",
    { method: "POST", body: input }
  );
  return result.target;
}

// The backend allows the patient themself or a doctor with an active link
// to report a calculated value. This is intended to be called by Person 3's
// nutrition-calculation flow after computing a meal's nutrients.
export async function checkNutritionValue(input: {
  patientId: string;
  nutrient: NutrientKey;
  value: number;
}): Promise<{ flagged: boolean }> {
  return apiRequest<{ flagged: boolean }>("/doctor/check-nutrition", {
    method: "POST",
    body: input,
  });
}
