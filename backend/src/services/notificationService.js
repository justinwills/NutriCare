import { pool } from '../db/pool.js';

export async function createNotification({
  userId,
  type,
  message,
  relatedPatientId = null,
  relatedDoctorId = null,
  dietaryLimitId = null,
  foodRecommendationId = null,
  localDate = null,
  foodName = null,
  nutrientName = null,
  currentAmount = null,
  limitAmount = null,
  unit = null,
  dedupKey = null,
  metadata = {},
  client = pool,
}) {
  const { rows } = await client.query(
    `INSERT INTO notifications (
       user_id,
       type,
       message,
       related_patient_id,
       related_doctor_id,
       dietary_limit_id,
       food_recommendation_id,
       local_date,
       food_name,
       nutrient_name,
       current_amount,
       limit_amount,
       unit,
       dedup_key,
       metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (user_id, dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING
     RETURNING *`,
    [
      userId,
      type,
      message,
      relatedPatientId,
      relatedDoctorId,
      dietaryLimitId,
      foodRecommendationId,
      localDate,
      foodName,
      nutrientName,
      currentAmount,
      limitAmount,
      unit,
      dedupKey,
      metadata,
    ]
  );
  return rows[0] || null;
}

export async function listNotifications(userId, { unreadOnly = false } = {}) {
  const query = unreadOnly
    ? `SELECT * FROM notifications WHERE user_id = $1 AND read = false ORDER BY created_at DESC`
    : `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`;
  const { rows } = await pool.query(query, [userId]);
  return rows;
}

export async function markAsRead(notificationId, userId) {
  const { rows } = await pool.query(
    `UPDATE notifications SET read = true
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [notificationId, userId]
  );
  return rows[0];
}

/**
 * Compares a nutrient value against the patient's doctor-defined range
 * and creates a notification if it falls outside. Called by whatever
 * endpoint receives Person 3's calculated meal nutrition.
 */
export async function checkNutritionRange({ patientId, nutrient, value }) {
  const { rows } = await pool.query(
    `SELECT * FROM nutrition_targets WHERE patient_id = $1 AND nutrient = $2`,
    [patientId, nutrient]
  );

  if (rows.length === 0) return null; // no target set, nothing to check

  const target = rows[0];

  if (target.min_value !== null && value < Number(target.min_value)) {
    return createNotification({
      userId: patientId,
      type: 'nutrition_low',
      message: `${nutrient} intake (${value}) is below the target minimum (${target.min_value}).`,
    });
  }

  if (target.max_value !== null && value > Number(target.max_value)) {
    return createNotification({
      userId: patientId,
      type: 'nutrition_high',
      message: `${nutrient} intake (${value}) is above the target maximum (${target.max_value}).`,
    });
  }

  return null;
}
