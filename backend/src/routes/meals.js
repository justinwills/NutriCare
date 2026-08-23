import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { pool } from "../db/pool.js";
import { deductFromPantry } from "../services/pantryService.js";
import { calculateMealNutrition } from "../services/nutritionService.js";
import { recordConfirmedMealAndCheckLimits } from "../services/supervisionService.js";
import { errorMessage } from "../utils/errorMessage.js";

const router = Router();
router.use(requireAuth);
const MEASUREMENT_UNITS = new Set([
  "g",
  "ml",
  "kg",
  "l",
  "tsp",
  "tbsp",
  "cup",
  "fl_oz",
  "oz",
  "lb",
  "pinch",
]);
const MEAL_ITEM_SOURCES = new Set(["manual", "bought", "pantry"]);

async function findMatchingPantryItem(client, userId, label) {
  const { rows } = await client.query(
    `SELECT id FROM pantry_items
     WHERE user_id = $1 AND remaining_quantity > 0
       AND lower(trim(product_name)) = lower(trim($2))
     ORDER BY created_at ASC
     LIMIT 1`,
    [userId, label],
  );
  return rows[0]?.id || null;
}

/**
 * POST /meals
 * Body:
 * {
 *   notes?: string,
 *   items: [
 *     {
 *       pantryItemId: "uuid" | null,
 *       label: "Chicken breast",
 *       quantityUsed: 150,
 *       unit: "g",
 *       source: "manual" | "bought" | "pantry"
 *     }
 *   ]
 * }
 * items with a pantryItemId trigger a real deduction. Manual items with an
 * exact pantry product-name match also deduct that pantry row; bought items
 * remain explicitly outside the pantry.
 * Older clients may omit source; the API derives pantry/manual from
 * pantryItemId for backward compatibility.
 */
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const notes =
      typeof req.body?.notes === "string" ? req.body.notes.trim() : null;
    const timezone = req.body?.timezone;
    const { items } = req.body ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items must be a non-empty array" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: mealRows } = await client.query(
        `INSERT INTO meals (user_id, notes) VALUES ($1, $2) RETURNING *`,
        [req.user.userId, notes || null],
      );
      const meal = mealRows[0];

      const savedItems = [];
      let alertsCreated = 0;

      for (const item of items) {
        let pantryItemId = item?.pantryItemId || null;
        const label = typeof item?.label === "string" ? item.label.trim() : "";
        const quantityUsed = Number(item?.quantityUsed);
        const unit = item?.unit;
        const requestedSource = item?.source;

        if (
          !label ||
          !Number.isFinite(quantityUsed) ||
          quantityUsed <= 0 ||
          !MEASUREMENT_UNITS.has(unit)
        ) {
          throw new Error("Each item needs label, quantityUsed, and unit");
        }
        if (requestedSource && !MEAL_ITEM_SOURCES.has(requestedSource)) {
          throw new Error("Each item source must be manual, bought, or pantry");
        }
        if (requestedSource === "pantry" && !pantryItemId) {
          throw new Error("Pantry items need a pantryItemId");
        }
        if (pantryItemId && requestedSource && requestedSource !== "pantry") {
          throw new Error(
            "Items with a pantryItemId must use the pantry source",
          );
        }

        if (!pantryItemId && requestedSource !== "bought") {
          pantryItemId = await findMatchingPantryItem(
            client,
            req.user.userId,
            label,
          );
        }

        // Older clients do not send source, so continue deriving it from pantryItemId.
        const entrySource = pantryItemId
          ? "pantry"
          : requestedSource === "bought"
            ? "bought"
            : "manual";

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
          `INSERT INTO meal_items (meal_id, pantry_item_id, label, quantity_used, unit, entry_source)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
          // A fully consumed pantry row is deleted by the deduction service.
          // Keep the meal item, but let the FK remain nullable in that case.
          [
            meal.id,
            pantryItemId && !pantryItemWasDeleted ? pantryItemId : null,
            label,
            quantityUsed,
            unit,
            entrySource,
          ],
        );
        savedItems.push(itemRows[0]);
      }

      const nutrition = calculateMealNutrition(savedItems);
      const supervision = await recordConfirmedMealAndCheckLimits({
        client,
        patientId: req.user.userId,
        meal,
        items: savedItems,
        nutrition,
        timezone,
      });
      alertsCreated += supervision.alertsCreated;

      await client.query("COMMIT");
      res.status(201).json({
        meal,
        items: savedItems,
        nutrition,
        alertsCreated,
        consumptionDate: supervision.localDate,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      res.status(400).json({ error: errorMessage(err, "Unable to log meal") });
    } finally {
      client.release();
    }
  }),
);

/** GET /meals -- list the current user's logged meals with their items */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows: meals } = await pool.query(
      `SELECT * FROM meals WHERE user_id = $1 ORDER BY logged_at DESC`,
      [req.user.userId],
    );

    const mealIds = meals.map((m) => m.id);
    let itemsByMeal = {};

    if (mealIds.length > 0) {
      const { rows: items } = await pool.query(
        `SELECT * FROM meal_items WHERE meal_id = ANY($1::uuid[])`,
        [mealIds],
      );
      itemsByMeal = items.reduce((acc, item) => {
        (acc[item.meal_id] ||= []).push(item);
        return acc;
      }, {});
    }

    res.json({
      meals: meals.map((m) => {
        const items = itemsByMeal[m.id] || [];
        return { ...m, items, nutrition: calculateMealNutrition(items) };
      }),
    });
  }),
);

export default router;
