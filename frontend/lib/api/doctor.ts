import { apiRequest } from "./client";
import type { DoctorPatientLink, NutrientKey, RawNutritionTarget } from "@/lib/types/api";

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

// Not doctor-role-gated server-side (verified in doctor.js — this
// route has no requireRole('doctor') unlike the others in this file),
// so any authenticated caller can report a value for a patient. This
// is intended to be called by Person 3's nutrition-calculation flow
// after computing a meal's nutrients, not directly by a doctor-facing
// screen.
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
