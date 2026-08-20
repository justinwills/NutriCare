-- 005_create_nutrition_targets.sql
-- Doctor-defined min/max ranges per nutrient, per patient.
-- One row per nutrient so a doctor can set/update calories independently
-- of sodium, etc.

CREATE TYPE nutrient AS ENUM (
  'calories', 'protein', 'carbohydrates', 'fat', 'sodium', 'sugar', 'fibre'
);

CREATE TABLE nutrition_targets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nutrient    nutrient NOT NULL,
  min_value   NUMERIC(10, 2),
  max_value   NUMERIC(10, 2),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, nutrient)
);

CREATE INDEX idx_targets_patient ON nutrition_targets(patient_id);
