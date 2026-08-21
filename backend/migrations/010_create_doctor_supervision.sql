-- Doctor-supervised nutrition plans, confirmed-consumption metrics, and
-- structured notification deduplication.

ALTER TABLE users
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';

CREATE TABLE patient_conditions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  condition_name  TEXT NOT NULL CHECK (char_length(trim(condition_name)) BETWEEN 1 AND 120),
  condition_key   TEXT NOT NULL CHECK (char_length(trim(condition_key)) BETWEEN 1 AND 120),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, doctor_id, condition_key)
);

CREATE INDEX idx_patient_conditions_patient
  ON patient_conditions(patient_id);

CREATE TABLE dietary_limits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  limit_type      TEXT NOT NULL CHECK (limit_type IN ('nutrient', 'ingredient')),
  name            TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  name_key        TEXT NOT NULL CHECK (char_length(trim(name_key)) BETWEEN 1 AND 120),
  maximum_amount  NUMERIC(14, 4) NOT NULL CHECK (maximum_amount > 0),
  unit            TEXT NOT NULL CHECK (unit IN ('mg', 'g', 'ml', 'kcal')),
  explanation     TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, doctor_id, limit_type, name_key)
);

CREATE INDEX idx_dietary_limits_patient_enabled
  ON dietary_limits(patient_id, enabled);

CREATE TABLE food_recommendations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_type    TEXT NOT NULL CHECK (recommendation_type IN ('avoid', 'consume_more')),
  food_name              TEXT NOT NULL CHECK (char_length(trim(food_name)) BETWEEN 1 AND 160),
  food_key               TEXT NOT NULL CHECK (char_length(trim(food_key)) BETWEEN 1 AND 160),
  doctor_reason          TEXT NOT NULL CHECK (char_length(trim(doctor_reason)) BETWEEN 1 AND 500),
  priority               TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  recommended_frequency  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, doctor_id, recommendation_type, food_key)
);

CREATE INDEX idx_food_recommendations_patient
  ON food_recommendations(patient_id, recommendation_type);

-- One row per confirmed meal metric. Daily totals are sums over local_date;
-- receipt/OCR quantities never write to this table.
CREATE TABLE meal_consumption_metrics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id      UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  patient_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date   DATE NOT NULL,
  metric_type  TEXT NOT NULL CHECK (metric_type IN ('nutrient', 'ingredient')),
  metric_name  TEXT NOT NULL,
  metric_key   TEXT NOT NULL,
  amount       NUMERIC(16, 4) NOT NULL CHECK (amount >= 0),
  unit         TEXT NOT NULL CHECK (unit IN ('mg', 'g', 'ml', 'kcal')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meal_id, metric_type, metric_key, unit)
);

CREATE INDEX idx_consumption_patient_date
  ON meal_consumption_metrics(patient_id, local_date);

ALTER TABLE notifications
  ADD COLUMN related_patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN related_doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN dietary_limit_id UUID REFERENCES dietary_limits(id) ON DELETE SET NULL,
  ADD COLUMN food_recommendation_id UUID REFERENCES food_recommendations(id) ON DELETE SET NULL,
  ADD COLUMN local_date DATE,
  ADD COLUMN food_name TEXT,
  ADD COLUMN nutrient_name TEXT,
  ADD COLUMN current_amount NUMERIC(16, 4),
  ADD COLUMN limit_amount NUMERIC(16, 4),
  ADD COLUMN unit TEXT,
  ADD COLUMN dedup_key TEXT,
  ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX idx_notifications_user_dedup
  ON notifications(user_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

-- Preserve existing doctor-set maximum targets in the new flexible model.
INSERT INTO dietary_limits (
  patient_id,
  doctor_id,
  limit_type,
  name,
  name_key,
  maximum_amount,
  unit,
  explanation,
  enabled
)
SELECT
  patient_id,
  doctor_id,
  'nutrient',
  nutrient::text,
  nutrient::text,
  max_value,
  CASE nutrient::text
    WHEN 'calories' THEN 'kcal'
    WHEN 'sodium' THEN 'mg'
    ELSE 'g'
  END,
  'Migrated from the previous nutrition target.',
  true
FROM nutrition_targets
WHERE max_value IS NOT NULL AND max_value > 0
ON CONFLICT (patient_id, doctor_id, limit_type, name_key) DO NOTHING;
