-- 003_create_pantry_items.sql
-- Digital pantry. Quantities are always stored normalized to base_unit
-- (g for solids, ml for liquids) so deduction never needs conversion
-- at write time -- conversion happens once, on the way in.

CREATE TYPE base_unit AS ENUM ('g', 'ml');

CREATE TABLE pantry_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_name       TEXT NOT NULL,
  raw_name           TEXT,              -- original OCR string, e.g. "CHK BRST 500G"
  base_unit          base_unit NOT NULL,
  initial_quantity   NUMERIC(10, 2) NOT NULL CHECK (initial_quantity > 0),
  remaining_quantity NUMERIC(10, 2) NOT NULL CHECK (remaining_quantity >= 0),
  expiration_date    DATE,
  source             TEXT NOT NULL DEFAULT 'manual', -- 'ocr_online' | 'ocr_receipt' | 'manual'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pantry_user ON pantry_items(user_id);
CREATE INDEX idx_pantry_expiration ON pantry_items(expiration_date);
