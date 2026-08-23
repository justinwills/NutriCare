CREATE TABLE food_gallery_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_id         UUID REFERENCES meals(id) ON DELETE SET NULL,
  image_data      TEXT NOT NULL CHECK (char_length(image_data) <= 10000000),
  detected_foods  JSONB NOT NULL DEFAULT '[]'::jsonb,
  nutrition       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_food_gallery_patient_created
  ON food_gallery_entries(patient_id, created_at DESC);
