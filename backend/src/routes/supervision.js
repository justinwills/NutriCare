import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { pool } from '../db/pool.js';
import {
  getPatientPlan,
  isValidTimezone,
} from '../services/supervisionService.js';

const router = Router();
router.use(requireAuth, requireRole('hospital_patient'));

/** GET /supervision -- the signed-in patient's read-only doctor plan */
router.get('/', asyncHandler(async (req, res) => {
  const plan = await getPatientPlan({ patientId: req.user.userId });
  if (!plan) return res.status(404).json({ error: 'Patient account not found' });
  res.json({ plan });
}));

/** GET /supervision/daily-totals */
router.get('/daily-totals', asyncHandler(async (req, res) => {
  const plan = await getPatientPlan({ patientId: req.user.userId });
  if (!plan) return res.status(404).json({ error: 'Patient account not found' });
  res.json({ date: plan.date, timezone: plan.patient.timezone, totals: plan.daily_totals });
}));

/** PUT /supervision/timezone  Body: { timezone: "Asia/Shanghai" } */
router.put('/timezone', asyncHandler(async (req, res) => {
  const timezone = typeof req.body?.timezone === 'string' ? req.body.timezone.trim() : '';
  if (!isValidTimezone(timezone)) {
    return res.status(400).json({ error: 'timezone must be a valid IANA timezone' });
  }
  const { rows } = await pool.query(
    `UPDATE users SET timezone = $1 WHERE id = $2 RETURNING timezone`,
    [timezone, req.user.userId]
  );
  res.json({ timezone: rows[0].timezone });
}));

export default router;
