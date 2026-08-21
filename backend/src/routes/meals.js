import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { pool } from '../db/pool.js';
import { deductFromPantry } from '../services/pantryService.js';
import { errorMessage } from '../utils/errorMessage.js';

const router = Router();
router.use(requireAuth);
const MEASUREMENT_UNITS = new Set(['g', 'ml', 'kg', 'l', 'tsp', 'tbsp', 'cup', 'fl_oz', 'oz', 'lb', 'pinch']);

/**
 * POST /meals
 * Body:
 * {
 *   notes?: string,
 *   items: [
 *     { pantryItemId: "uuid" | null, label: "Chicken breast", quantityUsed: 150, unit: "g" }
 *   ]
 * }
 * items with a pantryItemId trigger a real deduction. Items without one
 * (manual entries like "1 tbsp oil" with nothing tracked in pantry) are
 * just recorded for nutrition calculation -- see the pantry_item_id
 * nullable comment in migration 004.
 *
 * This does NOT calculate nutrition itself -- that's Person 3's job.
 * Once this returns the meal_id, hand meal.items off to Person 3's
 * calculation function, then feed the result into
 * notificationService.checkNutritionRange for each nutrient.
 */
router.post('/', asyncHandler(async (req, res) => {
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : null;
  const { items } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: mealRows } = await client.query(
      `INSERT INTO meals (user_id, notes) VALUES ($1, $2) RETURNING *`,
      [req.user.userId, notes || null]
    );
    const meal = mealRows[0];

    const savedItems = [];
    let alertsCreated = 0;

    for (const item of items) {
      const pantryItemId = item?.pantryItemId || null;
      const label = typeof item?.label === 'string' ? item.label.trim() : '';
      const quantityUsed = Number(item?.quantityUsed);
      const unit = item?.unit;

      if (!label || !Number.isFinite(quantityUsed) || quantityUsed <= 0 || !MEASUREMENT_UNITS.has(unit)) {
        throw new Error('Each item needs label, quantityUsed, and unit');
      }

      let pantryItemWasDeleted = false;
      // Deduct on the same transaction client. If any deduction fails,
      // the meal and all earlier deductions roll back together.
      if (pantryItemId) {
        const deduction = await deductFromPantry({
          userId: req.user.userId,
          pantryItemId,
          quantityUsed,
          unit,
          client,
        });
        if (deduction.notificationCreated) alertsCreated += 1;
        pantryItemWasDeleted = deduction.itemDeleted;
      }

      const { rows: itemRows } = await client.query(
        `INSERT INTO meal_items (meal_id, pantry_item_id, label, quantity_used, unit)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        // A fully consumed pantry row is deleted by the deduction service.
        // Keep the meal item, but let the FK remain nullable in that case.
        [meal.id, pantryItemId && !pantryItemWasDeleted ? pantryItemId : null, label, quantityUsed, unit]
      );
      savedItems.push(itemRows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ meal, items: savedItems, alertsCreated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ error: errorMessage(err, 'Unable to log meal') });
  } finally {
    client.release();
  }
}));

/** GET /meals -- list the current user's logged meals with their items */
router.get('/', asyncHandler(async (req, res) => {
  const { rows: meals } = await pool.query(
    `SELECT * FROM meals WHERE user_id = $1 ORDER BY logged_at DESC`,
    [req.user.userId]
  );

  const mealIds = meals.map((m) => m.id);
  let itemsByMeal = {};

  if (mealIds.length > 0) {
    const { rows: items } = await pool.query(
      `SELECT * FROM meal_items WHERE meal_id = ANY($1::uuid[])`,
      [mealIds]
    );
    itemsByMeal = items.reduce((acc, item) => {
      (acc[item.meal_id] ||= []).push(item);
      return acc;
    }, {});
  }

  res.json({
    meals: meals.map((m) => ({ ...m, items: itemsByMeal[m.id] || [] })),
  });
}));

export default router;
