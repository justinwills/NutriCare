import { Router } from 'express';
import { registerUser, loginUser } from '../services/authService.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { email, password, fullName, role } = req.body;

  if (!email || !password || !fullName || !role) {
    return res.status(400).json({ error: 'email, password, fullName, and role are required' });
  }

  if (!['hospital_patient', 'doctor', 'personal'].includes(role)) {
    return res.status(400).json({ error: 'role must be hospital_patient, doctor, or personal' });
  }

  try {
    const user = await registerUser({ email, password, fullName, role });
    res.status(201).json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const result = await loginUser({ email, password });
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

export default router;
