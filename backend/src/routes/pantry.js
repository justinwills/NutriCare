import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db/pool.js';
import { deductFromPantry, checkExpiringItems } from '../services/pantryService.js';

const router = Router();
router.use(requireAuth);

/**
 * POST /pantry
 * Body matches the integration contract's confirmed-item shape:
 *   { productName, initialQuantity, unit, expirationDate, rawName?, source? }
 * `unit` here must already be the base_unit (g or ml) -- this is the
 * confirmed-write step, conversion already happened on Person 3's side
 * (or you normalize before calling this, see units.js).
 */
router.post('/', async (req, res) => {
  const { productName, rawName, baseUnit, initialQuantity, expirationDate, source } = req.body;

  if (!productName || !baseUnit || !initialQuantity) {
    return res.status(400).json({ error: 'productName, baseUnit, and initialQuantity are required' });
  }

  if (!['g', 'ml'].includes(baseUnit)) {
    return res.status(400).json({ error: 'baseUnit must be g or ml' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO pantry_items
         (user_id, product_name, raw_name, base_unit, initial_quantity, remaining_quantity, expiration_date, source)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7)
       RETURNING *`,
      [
        req.user.userId,
        productName,
        rawName || null,
        baseUnit,
        initialQuantity,
        expirationDate || null,
        source || 'manual',
      ]
    );
    res.status(201).json({ item: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /pantry -- list the current user's pantry */
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM pantry_items WHERE user_id = $1 ORDER BY expiration_date ASC NULLS LAST`,
    [req.user.userId]
  );
  res.json({ items: rows });
});

/**
 * POST /pantry/:id/deduct
 * Body: { quantityUsed, unit }
 * unit does NOT need to match the item's base_unit -- conversion
 * happens inside deductFromPantry via units.js.
 */
router.post('/:id/deduct', async (req, res) => {
  const { quantityUsed, unit } = req.body;

  if (!quantityUsed || !unit) {
    return res.status(400).json({ error: 'quantityUsed and unit are required' });
  }

  try {
    const updated = await deductFromPantry({
      userId: req.user.userId,
      pantryItemId: req.params.id,
      quantityUsed,
      unit,
    });
    res.json({ item: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /pantry/check-expiring
 * Manually triggers the expiry scan. Wire this to a cron in production;
 * exposing it as an endpoint is handy for demoing the alert flow live
 * without waiting for a scheduler to tick.
 */
router.post('/check-expiring', async (req, res) => {
  const count = await checkExpiringItems();
  res.json({ checked: true, itemsFlagged: count });
});

export default router;
