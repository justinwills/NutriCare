import { pool } from '../db/pool.js';
import { toBaseUnit } from './units.js';
import { createNotification } from './notificationService.js';

// Below this fraction of initial_quantity, fire a low-stock alert.
// Hardcoded for the hackathon demo; making this per-item/user-configurable
// is a fine "if time permits" extension.
const LOW_STOCK_THRESHOLD = 0.15;

// Fire an expiring-soon alert when expiration_date is this many days out.
const EXPIRING_SOON_DAYS = 3;

/**
 * Deducts quantityUsed (in `unit`) from a pantry item, converting to
 * the item's base_unit first. Throws if the item doesn't exist, isn't
 * owned by userId, or doesn't have enough remaining stock.
 *
 * Returns the updated pantry item row.
 */
export async function deductFromPantry({ userId, pantryItemId, quantityUsed, unit }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM pantry_items WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [pantryItemId, userId]
    );

    if (rows.length === 0) {
      throw new Error('Pantry item not found');
    }

    const item = rows[0];
    const amountInBase = toBaseUnit(quantityUsed, unit, item.base_unit);

    if (amountInBase > Number(item.remaining_quantity)) {
      throw new Error(
        `Not enough stock: has ${item.remaining_quantity}${item.base_unit}, requested ${amountInBase}${item.base_unit}`
      );
    }

    const newRemaining = Number(item.remaining_quantity) - amountInBase;

    const { rows: updatedRows } = await client.query(
      `UPDATE pantry_items
       SET remaining_quantity = $1, updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [newRemaining, pantryItemId]
    );

    await client.query('COMMIT');

    const updated = updatedRows[0];

    // Fire-and-forget style, but awaited so a demo doesn't race ahead
    // of the notification actually landing in the DB.
    await checkLowStock(updated);

    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Checks one pantry item against the low-stock threshold and creates
 * a notification if it's crossed. Called after every deduction.
 */
async function checkLowStock(pantryItem) {
  const ratio = Number(pantryItem.remaining_quantity) / Number(pantryItem.initial_quantity);
  if (ratio <= LOW_STOCK_THRESHOLD) {
    await createNotification({
      userId: pantryItem.user_id,
      type: 'low_stock',
      message: `${pantryItem.product_name} is running low (${pantryItem.remaining_quantity}${pantryItem.base_unit} left).`,
    });
  }
}

/**
 * Scans all pantry items expiring within EXPIRING_SOON_DAYS and creates
 * notifications for any that don't already have one pending. Intended
 * to run on a schedule (see server.js) or be triggered manually for
 * a demo.
 */
export async function checkExpiringItems() {
  const { rows: items } = await pool.query(
    `SELECT * FROM pantry_items
     WHERE expiration_date IS NOT NULL
       AND expiration_date <= (CURRENT_DATE + $1::int)
       AND expiration_date >= CURRENT_DATE
       AND remaining_quantity > 0`,
    [EXPIRING_SOON_DAYS]
  );

  for (const item of items) {
    // Avoid spamming duplicate alerts: skip if an unread expiring_soon
    // notification already exists for this exact product name.
    const { rows: existing } = await pool.query(
      `SELECT id FROM notifications
       WHERE user_id = $1 AND type = 'expiring_soon' AND read = false
         AND message LIKE $2`,
      [item.user_id, `${item.product_name}%`]
    );

    if (existing.length > 0) continue;

    await createNotification({
      userId: item.user_id,
      type: 'expiring_soon',
      message: `${item.product_name} expires on ${item.expiration_date.toISOString().split('T')[0]}.`,
    });
  }

  return items.length;
}
