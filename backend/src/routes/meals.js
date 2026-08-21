import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db/pool.js';
import { deductFromPantry } from '../services/pantryService.js';

const router = Router();
router.use(requireAuth);

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
router.post('/', async (req, res) => {
  const { notes, items } = req.body;

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
      const { pantryItemId, label, quantityUsed, unit } = item;

      if (!label || !quantityUsed || !unit) {
        throw new Error('Each item needs label, quantityUsed, and unit');
      }

      // Deduct first (outside this transaction -- it manages its own).
      // If a deduction fails (e.g. insufficient stock), the whole meal
      // log fails too, since the meal shouldn't claim ingredients it
      // couldn't actually use.
      if (pantryItemId) {
        const deduction = await deductFromPantry({
          userId: req.user.userId,
          pantryItemId,
          quantityUsed,
          unit,
        });
        if (deduction.notificationCreated) alertsCreated += 1;
      }

      const { rows: itemRows } = await client.query(
        `INSERT INTO meal_items (meal_id, pantry_item_id, label, quantity_used, unit)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [meal.id, pantryItemId || null, label, quantityUsed, unit]
      );
      savedItems.push(itemRows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ meal, items: savedItems, alertsCreated });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

/** GET /meals -- list the current user's logged meals with their items */
router.get('/', async (req, res) => {
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
});

export default router;
