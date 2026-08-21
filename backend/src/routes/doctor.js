import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { pool } from '../db/pool.js';
import { checkNutritionRange } from '../services/notificationService.js';
import { errorMessage } from '../utils/errorMessage.js';

const router = Router();
router.use(requireAuth);
const NUTRIENTS = new Set(['calories', 'protein', 'carbohydrates', 'fat', 'sodium', 'sugar', 'fibre']);

async function hasActiveDoctorLink(doctorId, patientId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM doctor_patient_links
     WHERE doctor_id = $1 AND patient_id = $2 AND status = 'active'`,
    [doctorId, patientId]
  );
  return rows.length > 0;
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
    const { rows: patients } = await pool.query('SELECT id FROM users WHERE id = $1', [patientId]);
    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient account not found' });
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
     WHERE l.doctor_id = $1 AND l.status = 'active'`,
    [req.user.userId]
  );
  res.json({ patients: rows });
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
