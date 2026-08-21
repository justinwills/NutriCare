import { Router } from 'express';
import { registerUser, loginUser } from '../services/authService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { errorMessage } from '../utils/errorMessage.js';

const router = Router();

router.post('/register', asyncHandler(async (req, res) => {
  const email = String(req.body?.email ?? '').trim();
  const password = String(req.body?.password ?? '');
  const fullName = String(req.body?.fullName ?? '').trim();
  const role = req.body?.role;

  if (!email || !password || !fullName || !role) {
    return res.status(400).json({ error: 'email, password, fullName, and role are required' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'password must be at least 4 characters' });
  }

  if (!['hospital_patient', 'doctor', 'personal'].includes(role)) {
    return res.status(400).json({ error: 'role must be hospital_patient, doctor, or personal' });
  }

  try {
    const user = await registerUser({ email, password, fullName, role });
    res.status(201).json({ user });
  } catch (err) {
    res.status(400).json({ error: errorMessage(err, 'Unable to create account') });
  }
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = String(req.body?.email ?? '').trim();
  const password = String(req.body?.password ?? '');

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const result = await loginUser({ email, password });
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: errorMessage(err, 'Invalid email or password') });
  }
}));

export default router;
