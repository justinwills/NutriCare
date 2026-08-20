-- 006_create_notifications.sql
-- All alert types funnel into one table: expiring groceries, low stock,
-- medicine reminders, missed medication, nutrition out of range.
-- type is a plain text tag rather than an enum -- new alert types will
-- come up during the hackathon and a migration per new type isn't worth it.

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,   -- 'expiring_soon' | 'low_stock' | 'medicine_due' |
                                -- 'medicine_missed' | 'nutrition_low' | 'nutrition_high'
  message     TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read);
