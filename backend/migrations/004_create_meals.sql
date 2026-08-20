-- 004_create_meals.sql
-- A meal is a container; meal_items are the actual pantry deductions
-- plus manual entries (oil, salt, sugar etc. that never live in pantry
-- as trackable stock -- per the jobdesk's manual measurement fields).

CREATE TABLE meals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  logged_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes      TEXT
);

CREATE TABLE meal_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id          UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  pantry_item_id   UUID REFERENCES pantry_items(id) ON DELETE SET NULL,
  -- pantry_item_id is nullable: manual entries (a dash of salt, a
  -- tbsp of oil) may not correspond to a tracked pantry item at all.
  label            TEXT NOT NULL,        -- denormalized name, survives pantry_item deletion
  quantity_used    NUMERIC(10, 2) NOT NULL CHECK (quantity_used > 0),
  unit             base_unit NOT NULL
);

CREATE INDEX idx_meals_user ON meals(user_id);
CREATE INDEX idx_meal_items_meal ON meal_items(meal_id);
CREATE INDEX idx_meal_items_pantry ON meal_items(pantry_item_id);
