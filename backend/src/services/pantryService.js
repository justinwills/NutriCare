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
export async function deductFromPantry({ userId, pantryItemId, quantityUsed, unit, client: providedClient }) {
  const ownsClient = !providedClient;
  const client = providedClient || await pool.connect();
  try {
    if (ownsClient) await client.query('BEGIN');

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

    const newRemaining = Math.max(
      0,
      Number((Number(item.remaining_quantity) - amountInBase).toFixed(2))
    );

    const { rows: updatedRows } = await client.query(
      `UPDATE pantry_items
       SET remaining_quantity = $1, updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [newRemaining, pantryItemId]
    );

    const updated = updatedRows[0];

    // A fully consumed item no longer belongs in the active pantry. Remove it
    // in the same transaction as the deduction so it cannot linger at 0.
    const itemDeleted = newRemaining === 0;
    if (itemDeleted) {
      await client.query('DELETE FROM pantry_items WHERE id = $1', [pantryItemId]);
    }

    // Create alerts in the same transaction as the deduction. This keeps
    // pantry, meal, and notification state consistent if anything fails.
    const notification = itemDeleted
      ? await createNotification({
          userId: updated.user_id,
          type: 'out_of_stock',
          message: `${updated.product_name} is out of stock and was removed from the pantry.`,
          client,
        })
      : await checkLowStock(item, updated, client);

    if (ownsClient) await client.query('COMMIT');

    return { item: updated, notificationCreated: !!notification, itemDeleted };
  } catch (err) {
    if (ownsClient) await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    if (ownsClient) client.release();
  }
}

/**
 * Checks one pantry item against the low-stock threshold and creates
 * a notification if it's crossed. Called after every deduction.
 */
async function checkLowStock(previousItem, updatedItem, client = pool) {
  const previousRatio = Number(previousItem.remaining_quantity) / Number(previousItem.initial_quantity);
  const updatedRatio = Number(updatedItem.remaining_quantity) / Number(updatedItem.initial_quantity);
  if (previousRatio > LOW_STOCK_THRESHOLD && updatedRatio <= LOW_STOCK_THRESHOLD) {
    return createNotification({
      userId: updatedItem.user_id,
      type: 'low_stock',
      message: `${updatedItem.product_name} is running low (${updatedItem.remaining_quantity}${updatedItem.base_unit} left).`,
      client,
    });
  }
  return null;
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

  let alertsCreated = 0;
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

    const expiration = item.expiration_date instanceof Date
      ? item.expiration_date.toISOString().slice(0, 10)
      : String(item.expiration_date).slice(0, 10);
    await createNotification({
      userId: item.user_id,
      type: 'expiring_soon',
      message: `${item.product_name} expires on ${expiration}.`,
    });
    alertsCreated += 1;
  }

  return alertsCreated;
}
