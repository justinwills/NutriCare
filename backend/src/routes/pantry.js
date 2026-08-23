import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { pool } from '../db/pool.js';
import { deductFromPantry, checkExpiringItems } from '../services/pantryService.js';
import { errorMessage } from '../utils/errorMessage.js';

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
router.post('/', asyncHandler(async (req, res) => {
  const { rawName, expirationDate } = req.body ?? {};
  const productName = String(req.body?.productName ?? '').trim();
  const baseUnit = req.body?.baseUnit;
  const initialQuantity = Number(req.body?.initialQuantity);
  const source = req.body?.source;

  if (!productName || !baseUnit || !Number.isFinite(initialQuantity) || initialQuantity <= 0) {
    return res.status(400).json({ error: 'productName, baseUnit, and initialQuantity are required' });
  }

  if (!['g', 'ml'].includes(baseUnit)) {
    return res.status(400).json({ error: 'baseUnit must be g or ml' });
  }

  if (expirationDate && !/^\d{4}-\d{2}-\d{2}$/.test(expirationDate)) {
    return res.status(400).json({ error: 'expirationDate must use YYYY-MM-DD format' });
  }

  if (source && !['ocr_online', 'ocr_receipt', 'manual'].includes(source)) {
    return res.status(400).json({ error: 'source must be ocr_online, ocr_receipt, or manual' });
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
    res.status(500).json({ error: errorMessage(err, 'Unable to save pantry item') });
  }
}));

/** GET /pantry -- list the current user's pantry */
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM pantry_items WHERE user_id = $1 ORDER BY expiration_date ASC NULLS LAST`,
    [req.user.userId]
  );
  res.json({ items: rows });
}));

/**
 * POST /pantry/:id/deduct
 * Body: { quantityUsed, unit }
 * unit does NOT need to match the item's base_unit -- conversion
 * happens inside deductFromPantry via units.js.
 */
router.post('/:id/deduct', asyncHandler(async (req, res) => {
  const quantityUsed = Number(req.body?.quantityUsed);
  const unit = req.body?.unit;

  if (!Number.isFinite(quantityUsed) || quantityUsed <= 0 || typeof unit !== 'string' || !unit) {
    return res.status(400).json({ error: 'quantityUsed and unit are required' });
  }

  try {
    const result = await deductFromPantry({
      userId: req.user.userId,
      pantryItemId: req.params.id,
      quantityUsed,
      unit,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: errorMessage(err, 'Unable to deduct pantry item') });
  }
}));

/**
 * POST /pantry/check-expiring
 * Manually triggers the expiry scan. Wire this to a cron in production;
 * exposing it as an endpoint is handy for demoing the alert flow live
 * without waiting for a scheduler to tick.
 */
router.post('/check-expiring', asyncHandler(async (req, res) => {
  const alertsCreated = await checkExpiringItems();
  res.json({ checked: true, alertsCreated });
}));

/**
 * DELETE /pantry/:id
 * Removes a pantry item for the authenticated user.
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query(
    `DELETE FROM pantry_items WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.userId]
  );
  if (rowCount === 0) {
    return res.status(404).json({ error: 'Pantry item not found' });
  }
  res.json({ deleted: true });
}));

export default router;
