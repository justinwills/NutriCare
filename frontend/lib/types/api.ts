// Verified against your actual backend (from backend_-_Copy.zip),
// running locally on port 3002, hit with real requests. Not a guess —
// every shape below came back exactly like this from a live server.
//
// The core rule: request bodies you send are camelCase; most GET/POST
// responses come back snake_case because the backend does
// `RETURNING *` / `SELECT *` straight from Postgres without remapping.
// The one exception is POST /auth/login, which explicitly remaps to
// camelCase. This asymmetry is real, not a typo on my part — see the
// note on RawUserFromRegister vs User below.

export type UserRole = "hospital_patient" | "doctor" | "personal";

// What POST /auth/login returns for `user` — the ONE place the
// backend explicitly remaps to camelCase (see authService.js
// loginUser). Use this type after login.
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

// What POST /auth/register returns for `user` — raw Postgres
// RETURNING clause, snake_case, includes created_at which login's
// response does not. Verified live: register and login return
// DIFFERENT shapes for conceptually the same "user" object.
export interface RawUserFromRegister {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type BaseUnit = "g" | "ml";

// Units the meal-logging form can offer — wider than BaseUnit because
// the backend's units.js converts tsp/tbsp/etc into a pantry item's
// BaseUnit. Cross-dimension conversion (a volume unit against a
// gram-based item) is REJECTED by the backend, not approximated — the
// form must only offer units matching a given item's baseUnit
// dimension (mass units for g-based items, volume units for ml-based).
export type MeasurementUnit =
  | BaseUnit
  | "kg"
  | "l"
  | "tsp"
  | "tbsp"
  | "cup"
  | "fl_oz"
  | "oz"
  | "lb"
  | "pinch";

// Verified live against GET/POST /pantry and POST /pantry/:id/deduct.
// Quantities are STRINGS ("500.00") -- Postgres NUMERIC comes back as
// a string via the pg driver, never auto-converted to a JS number.
// Parse with Number(...) before doing math or rendering a progress bar.
// expiration_date is a full ISO timestamp, not a bare date.
export interface RawPantryItem {
  id: string;
  user_id: string;
  product_name: string;
  raw_name: string | null;
  base_unit: BaseUnit;
  initial_quantity: string;
  remaining_quantity: string;
  expiration_date: string | null; // full ISO timestamp when present, e.g. "2026-08-25T00:00:00.000Z"
  source: "ocr_online" | "ocr_receipt" | "manual";
  created_at: string;
  updated_at: string;
}

// Shape Person 3's OCR step is expected to hand back, per the
// integration contract in the jobdesk doc. This is NOT something this
// backend has built an endpoint around yet -- confirm with Person 3
// before relying on exact field names here.
export interface ExtractedItem {
  rawName: string;
  suggestedName: string;
  quantity: number;
  packageSize: number;
  unit: MeasurementUnit;
  confidence: number; // 0–1
}

// Request body shape for POST /meals items[] -- confirmed camelCase in.
export interface MealItemInput {
  pantryItemId: string | null; // null for manual entries not tracked in pantry
  label: string;
  quantityUsed: number;
  unit: MeasurementUnit;
}

// What comes back in meal_items via GET /meals and POST /meals --
// snake_case, verified live.
export interface RawMealItem {
  id: string;
  meal_id: string;
  pantry_item_id: string | null;
  label: string;
  quantity_used: string;
  unit: MeasurementUnit;
}

export interface RawMeal {
  id: string;
  user_id: string;
  notes: string | null;
  logged_at: string;
  items: RawMealItem[]; // only present on GET /meals, which nests items per meal
}

export type NutrientKey =
  | "calories"
  | "protein"
  | "carbohydrates"
  | "fat"
  | "sodium"
  | "sugar"
  | "fibre";

// Verified via POST /doctor/nutrition-targets -- snake_case, RETURNING *.
export interface RawNutritionTarget {
  id: string;
  patient_id: string;
  doctor_id: string;
  nutrient: NutrientKey;
  min_value: string | null;
  max_value: string | null;
  updated_at: string;
}

export type NotificationType =
  | "expiring_soon"
  | "low_stock"
  | "medicine_due"
  | "medicine_missed"
  | "nutrition_low"
  | "nutrition_high";

// Verified via GET /notifications -- snake_case, RETURNING *.
export interface RawNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  created_at: string;
}

// GET /doctor/patients does NOT return the full user row -- it's an
// explicit column list from a JOIN (id, full_name, email, status).
// Verified live: no created_at, no other user fields present.
export interface DoctorPatientLink {
  id: string; // this is the PATIENT's user id, not a link-row id -- see doctor.js's explicit SELECT
  full_name: string;
  email: string;
  status: "pending" | "active" | "revoked";
}
