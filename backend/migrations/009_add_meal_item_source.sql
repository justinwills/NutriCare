ALTER TABLE meal_items
  ADD COLUMN entry_source TEXT NOT NULL DEFAULT 'manual';

UPDATE meal_items
SET entry_source = 'pantry'
WHERE pantry_item_id IS NOT NULL;

ALTER TABLE meal_items
  ADD CONSTRAINT meal_items_entry_source_check
  CHECK (entry_source IN ('manual', 'bought', 'pantry'));
