import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pool } from '../db/pool.js';
import { checkNutritionRange } from '../services/notificationService.js';

const router = Router();
router.use(requireAuth);

/** POST /doctor/link-patient  Body: { patientId } */
router.post('/link-patient', requireRole('doctor'), async (req, res) => {
  const { patientId } = req.body;
  if (!patientId) {
    return res.status(400).json({ error: 'patientId is required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO doctor_patient_links (doctor_id, patient_id, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (doctor_id, patient_id) DO UPDATE SET status = 'active'
       RETURNING *`,
      [req.user.userId, patientId]
    );
    res.status(201).json({ link: rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** GET /doctor/patients -- list this doctor's linked patients */
router.get('/patients', requireRole('doctor'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, l.status
     FROM doctor_patient_links l
     JOIN users u ON u.id = l.patient_id
     WHERE l.doctor_id = $1 AND l.status = 'active'`,
    [req.user.userId]
  );
  res.json({ patients: rows });
});

/**
 * POST /doctor/nutrition-targets
 * Body: { patientId, nutrient, minValue?, maxValue? }
 * nutrient must be one of the nutrition_targets enum values.
 */
router.post('/nutrition-targets', requireRole('doctor'), async (req, res) => {
  const { patientId, nutrient, minValue, maxValue } = req.body;

  if (!patientId || !nutrient) {
    return res.status(400).json({ error: 'patientId and nutrient are required' });
  }

  try {
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
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /doctor/check-nutrition
 * Body: { patientId, nutrient, value }
 * This is the endpoint Person 3's calculation flow should call after
 * computing a meal's nutrients, once per nutrient that has a target set.
 */
router.post('/check-nutrition', async (req, res) => {
  const { patientId, nutrient, value } = req.body;

  if (!patientId || !nutrient || value === undefined) {
    return res.status(400).json({ error: 'patientId, nutrient, and value are required' });
  }

  const notification = await checkNutritionRange({ patientId, nutrient, value });
  res.json({ flagged: !!notification, notification });
});

export default router;
