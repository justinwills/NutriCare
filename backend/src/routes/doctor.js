import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { pool } from '../db/pool.js';
import { checkNutritionRange } from '../services/notificationService.js';
import {
  getPatientPlan,
  hasActiveDoctorLink,
  normalizePlanName,
  syncRecommendationNotification,
} from '../services/supervisionService.js';
import { errorMessage } from '../utils/errorMessage.js';

const router = Router();
router.use(requireAuth);
const NUTRIENTS = new Set(['calories', 'protein', 'carbohydrates', 'fat', 'sodium', 'sugar', 'fibre']);
const LIMIT_TYPES = new Set(['nutrient', 'ingredient']);
const LIMIT_UNITS = new Set(['mg', 'g', 'ml', 'kcal']);
const RECOMMENDATION_TYPES = new Set(['avoid', 'consume_more']);
const PRIORITIES = new Set(['low', 'medium', 'high']);

function optionalText(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

function parseLimitInput(body, existing = null) {
  const limitType = body?.limitType ?? existing?.limit_type;
  const name = optionalText(body?.name ?? existing?.name);
  const maximumAmount = Number(body?.maximumAmount ?? existing?.maximum_amount);
  const unit = body?.unit ?? existing?.unit;
  const explanation = body?.explanation === undefined
    ? existing?.explanation ?? null
    : optionalText(body.explanation);
  const enabled = body?.enabled === undefined ? existing?.enabled ?? true : body.enabled;

  if (!LIMIT_TYPES.has(limitType)) throw new Error('limitType must be nutrient or ingredient');
  if (!name) throw new Error('name is required');
  if (!Number.isFinite(maximumAmount) || maximumAmount <= 0) {
    throw new Error('maximumAmount must be a positive number');
  }
  if (!LIMIT_UNITS.has(unit)) throw new Error('unit must be mg, g, ml, or kcal');
  if (typeof enabled !== 'boolean') throw new Error('enabled must be true or false');

  return { limitType, name, maximumAmount, unit, explanation, enabled };
}

function parseRecommendationInput(body, existing = null) {
  const recommendationType = body?.recommendationType ?? existing?.recommendation_type;
  const foodName = optionalText(body?.foodName ?? existing?.food_name);
  const doctorReason = optionalText(body?.doctorReason ?? existing?.doctor_reason);
  const priority = body?.priority ?? existing?.priority ?? 'medium';
  const recommendedFrequency = body?.recommendedFrequency === undefined
    ? existing?.recommended_frequency ?? null
    : optionalText(body.recommendedFrequency);

  if (!RECOMMENDATION_TYPES.has(recommendationType)) {
    throw new Error('recommendationType must be avoid or consume_more');
  }
  if (!foodName) throw new Error('foodName is required');
  if (!doctorReason) throw new Error('doctorReason is required');
  if (!PRIORITIES.has(priority)) throw new Error('priority must be low, medium, or high');

  return { recommendationType, foodName, doctorReason, priority, recommendedFrequency };
}

/** POST /doctor/link-patient  Body: { patientId } */
router.post('/link-patient', requireRole('doctor'), asyncHandler(async (req, res) => {
  const patientId = String(req.body?.patientId ?? '').trim();
  if (!patientId) {
    return res.status(400).json({ error: 'patientId is required' });
  }

  if (patientId === req.user.userId) {
    return res.status(400).json({ error: 'A doctor cannot link their own account as a patient' });
  }

  try {
    const { rows: patients } = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [patientId]
    );
    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient account not found' });
    }
    if (patients[0].role !== 'hospital_patient') {
      return res.status(400).json({ error: 'Only hospital patient accounts can be linked' });
    }

    const { rows } = await pool.query(
      `INSERT INTO doctor_patient_links (doctor_id, patient_id, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (doctor_id, patient_id) DO UPDATE SET status = 'active'
       RETURNING *`,
      [req.user.userId, patientId]
    );
    res.status(201).json({ link: rows[0] });
  } catch (err) {
    res.status(400).json({ error: errorMessage(err, 'Unable to link patient') });
  }
}));

/** GET /doctor/patients -- list this doctor's linked patients */
router.get('/patients', requireRole('doctor'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, l.status
     FROM doctor_patient_links l
     JOIN users u ON u.id = l.patient_id
     WHERE l.doctor_id = $1 AND l.status = 'active'
     ORDER BY u.full_name`,
    [req.user.userId]
  );
  res.json({ patients: rows });
}));

/** GET /doctor/patients/:patientId/plan */
router.get('/patients/:patientId/plan', requireRole('doctor'), asyncHandler(async (req, res) => {
  const plan = await getPatientPlan({
    patientId: req.params.patientId,
    doctorId: req.user.userId,
  });
  if (!plan) {
    return res.status(403).json({ error: 'An active patient link is required' });
  }
  res.json({ plan });
}));

/** PUT /doctor/patients/:patientId/conditions  Body: { conditions: string[] } */
router.put('/patients/:patientId/conditions', requireRole('doctor'), asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  const requested = req.body?.conditions;
  if (!Array.isArray(requested) || requested.length > 20) {
    return res.status(400).json({ error: 'conditions must be an array with at most 20 entries' });
  }

  const conditions = [...new Map(requested.map((value) => {
    const name = optionalText(value);
    const key = normalizePlanName(name);
    return [key, { name, key }];
  })).values()];
  if (conditions.some((condition) => !condition.name || !condition.key || condition.name.length > 120)) {
    return res.status(400).json({ error: 'Each condition must be between 1 and 120 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!(await hasActiveDoctorLink(req.user.userId, patientId, client))) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'An active patient link is required' });
    }

    await client.query(
      `DELETE FROM patient_conditions WHERE patient_id = $1 AND doctor_id = $2`,
      [patientId, req.user.userId]
    );
    const saved = [];
    for (const condition of conditions) {
      const { rows } = await client.query(
        `INSERT INTO patient_conditions (patient_id, doctor_id, condition_name, condition_key)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [patientId, req.user.userId, condition.name, condition.key]
      );
      saved.push(rows[0]);
    }
    await client.query('COMMIT');
    res.json({ conditions: saved });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ error: errorMessage(error, 'Unable to save conditions') });
  } finally {
    client.release();
  }
}));

/** POST /doctor/patients/:patientId/limits */
router.post('/patients/:patientId/limits', requireRole('doctor'), asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  try {
    if (!(await hasActiveDoctorLink(req.user.userId, patientId))) {
      return res.status(403).json({ error: 'An active patient link is required' });
    }
    const input = parseLimitInput(req.body);
    const { rows } = await pool.query(
      `INSERT INTO dietary_limits (
         patient_id, doctor_id, limit_type, name, name_key,
         maximum_amount, unit, explanation, enabled
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (patient_id, doctor_id, limit_type, name_key)
       DO UPDATE SET
         name = EXCLUDED.name,
         maximum_amount = EXCLUDED.maximum_amount,
         unit = EXCLUDED.unit,
         explanation = EXCLUDED.explanation,
         enabled = EXCLUDED.enabled,
         updated_at = now()
       RETURNING *`,
      [
        patientId,
        req.user.userId,
        input.limitType,
        input.name,
        normalizePlanName(input.name),
        input.maximumAmount,
        input.unit,
        input.explanation,
        input.enabled,
      ]
    );
    res.status(201).json({ limit: rows[0] });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error, 'Unable to save dietary limit') });
  }
}));

/** PATCH /doctor/patients/:patientId/limits/:limitId */
router.patch('/patients/:patientId/limits/:limitId', requireRole('doctor'), asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  try {
    if (!(await hasActiveDoctorLink(req.user.userId, patientId))) {
      return res.status(403).json({ error: 'An active patient link is required' });
    }
    const { rows: existingRows } = await pool.query(
      `SELECT * FROM dietary_limits
       WHERE id = $1 AND patient_id = $2 AND doctor_id = $3`,
      [req.params.limitId, patientId, req.user.userId]
    );
    if (existingRows.length === 0) return res.status(404).json({ error: 'Dietary limit not found' });

    const input = parseLimitInput(req.body, existingRows[0]);
    const { rows } = await pool.query(
      `UPDATE dietary_limits
       SET limit_type = $1,
           name = $2,
           name_key = $3,
           maximum_amount = $4,
           unit = $5,
           explanation = $6,
           enabled = $7,
           updated_at = now()
       WHERE id = $8
       RETURNING *`,
      [
        input.limitType,
        input.name,
        normalizePlanName(input.name),
        input.maximumAmount,
        input.unit,
        input.explanation,
        input.enabled,
        req.params.limitId,
      ]
    );
    res.json({ limit: rows[0] });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error, 'Unable to update dietary limit') });
  }
}));

router.delete('/patients/:patientId/limits/:limitId', requireRole('doctor'), asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  if (!(await hasActiveDoctorLink(req.user.userId, patientId))) {
    return res.status(403).json({ error: 'An active patient link is required' });
  }
  const { rowCount } = await pool.query(
    `DELETE FROM dietary_limits
     WHERE id = $1 AND patient_id = $2 AND doctor_id = $3`,
    [req.params.limitId, patientId, req.user.userId]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Dietary limit not found' });
  res.status(204).end();
}));

/** POST /doctor/patients/:patientId/recommendations */
router.post('/patients/:patientId/recommendations', requireRole('doctor'), asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!(await hasActiveDoctorLink(req.user.userId, patientId, client))) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'An active patient link is required' });
    }
    const input = parseRecommendationInput(req.body);
    const { rows } = await client.query(
      `INSERT INTO food_recommendations (
         patient_id, doctor_id, recommendation_type, food_name, food_key,
         doctor_reason, priority, recommended_frequency
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (patient_id, doctor_id, recommendation_type, food_key)
       DO UPDATE SET
         food_name = EXCLUDED.food_name,
         doctor_reason = EXCLUDED.doctor_reason,
         priority = EXCLUDED.priority,
         recommended_frequency = EXCLUDED.recommended_frequency,
         updated_at = now()
       RETURNING *`,
      [
        patientId,
        req.user.userId,
        input.recommendationType,
        input.foodName,
        normalizePlanName(input.foodName),
        input.doctorReason,
        input.priority,
        input.recommendedFrequency,
      ]
    );
    await syncRecommendationNotification({ client, recommendation: rows[0] });
    await client.query('COMMIT');
    res.status(201).json({ recommendation: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ error: errorMessage(error, 'Unable to save food recommendation') });
  } finally {
    client.release();
  }
}));

/** PATCH /doctor/patients/:patientId/recommendations/:recommendationId */
router.patch('/patients/:patientId/recommendations/:recommendationId', requireRole('doctor'), asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!(await hasActiveDoctorLink(req.user.userId, patientId, client))) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'An active patient link is required' });
    }
    const { rows: existingRows } = await client.query(
      `SELECT * FROM food_recommendations
       WHERE id = $1 AND patient_id = $2 AND doctor_id = $3`,
      [req.params.recommendationId, patientId, req.user.userId]
    );
    if (existingRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Food recommendation not found' });
    }

    const input = parseRecommendationInput(req.body, existingRows[0]);
    const { rows } = await client.query(
      `UPDATE food_recommendations
       SET recommendation_type = $1,
           food_name = $2,
           food_key = $3,
           doctor_reason = $4,
           priority = $5,
           recommended_frequency = $6,
           updated_at = now()
       WHERE id = $7
       RETURNING *`,
      [
        input.recommendationType,
        input.foodName,
        normalizePlanName(input.foodName),
        input.doctorReason,
        input.priority,
        input.recommendedFrequency,
        req.params.recommendationId,
      ]
    );
    await syncRecommendationNotification({ client, recommendation: rows[0] });
    await client.query('COMMIT');
    res.json({ recommendation: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ error: errorMessage(error, 'Unable to update food recommendation') });
  } finally {
    client.release();
  }
}));

router.delete('/patients/:patientId/recommendations/:recommendationId', requireRole('doctor'), asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  if (!(await hasActiveDoctorLink(req.user.userId, patientId))) {
    return res.status(403).json({ error: 'An active patient link is required' });
  }
  const { rowCount } = await pool.query(
    `DELETE FROM food_recommendations
     WHERE id = $1 AND patient_id = $2 AND doctor_id = $3`,
    [req.params.recommendationId, patientId, req.user.userId]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Food recommendation not found' });
  res.status(204).end();
}));

/**
 * POST /doctor/nutrition-targets
 * Body: { patientId, nutrient, minValue?, maxValue? }
 * nutrient must be one of the nutrition_targets enum values.
 */
router.post('/nutrition-targets', requireRole('doctor'), asyncHandler(async (req, res) => {
  const patientId = String(req.body?.patientId ?? '').trim();
  const nutrient = req.body?.nutrient;
  const minValue = req.body?.minValue === null || req.body?.minValue === undefined || req.body?.minValue === '' ? null : Number(req.body.minValue);
  const maxValue = req.body?.maxValue === null || req.body?.maxValue === undefined || req.body?.maxValue === '' ? null : Number(req.body.maxValue);

  if (!patientId || !nutrient) {
    return res.status(400).json({ error: 'patientId and nutrient are required' });
  }

  if (!NUTRIENTS.has(nutrient)) {
    return res.status(400).json({ error: `nutrient must be one of: ${[...NUTRIENTS].join(', ')}` });
  }

  if ((minValue !== null && !Number.isFinite(minValue)) || (maxValue !== null && !Number.isFinite(maxValue))) {
    return res.status(400).json({ error: 'minValue and maxValue must be numbers' });
  }

  if (minValue !== null && maxValue !== null && minValue > maxValue) {
    return res.status(400).json({ error: 'minValue cannot be greater than maxValue' });
  }

  try {
    if (!(await hasActiveDoctorLink(req.user.userId, patientId))) {
      return res.status(403).json({ error: 'Link this patient before setting nutrition targets' });
    }

    const { rows } = await pool.query(
      `INSERT INTO nutrition_targets (patient_id, doctor_id, nutrient, min_value, max_value)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (patient_id, nutrient)
       DO UPDATE SET min_value = $4, max_value = $5, doctor_id = $2, updated_at = now()
       RETURNING *`,
      [patientId, req.user.userId, nutrient, minValue ?? null, maxValue ?? null]
    );
    res.status(201).json({ target: rows[0] });
  } catch (err) {
    res.status(400).json({ error: errorMessage(err, 'Unable to save nutrition target') });
  }
}));

/**
 * POST /doctor/check-nutrition
 * Body: { patientId, nutrient, value }
 * This is the endpoint Person 3's calculation flow should call after
 * computing a meal's nutrients, once per nutrient that has a target set.
 */
router.post('/check-nutrition', asyncHandler(async (req, res) => {
  const patientId = String(req.body?.patientId ?? '').trim();
  const nutrient = req.body?.nutrient;
  const value = Number(req.body?.value);

  if (!patientId || !nutrient || !Number.isFinite(value)) {
    return res.status(400).json({ error: 'patientId, nutrient, and value are required' });
  }

  if (!NUTRIENTS.has(nutrient)) {
    return res.status(400).json({ error: `nutrient must be one of: ${[...NUTRIENTS].join(', ')}` });
  }

  const authorized = req.user.role === 'doctor'
    ? await hasActiveDoctorLink(req.user.userId, patientId)
    : req.user.userId === patientId;
  if (!authorized) {
    return res.status(403).json({ error: 'You are not allowed to check nutrition for this patient' });
  }

  const notification = await checkNutritionRange({ patientId, nutrient, value });
  res.json({ flagged: !!notification, notification });
}));

export default router;
