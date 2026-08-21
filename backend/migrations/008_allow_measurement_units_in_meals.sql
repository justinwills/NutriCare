-- 008_allow_measurement_units_in_meals.sql
-- Meal entries preserve the unit the user actually logged. The original
-- column used the pantry base_unit enum (g/ml), which rejected valid inputs
-- such as tsp, tbsp, kg, and oz after the pantry deduction succeeded.

ALTER TABLE meal_items
  ALTER COLUMN unit TYPE TEXT USING unit::text;

ALTER TABLE meal_items
  ADD CONSTRAINT meal_items_unit_check
  CHECK (unit IN ('g', 'ml', 'kg', 'l', 'tsp', 'tbsp', 'cup', 'fl_oz', 'oz', 'lb', 'pinch'));
