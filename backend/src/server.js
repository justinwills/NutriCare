import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import pantryRoutes from './routes/pantry.js';
import mealRoutes from './routes/meals.js';
import notificationRoutes from './routes/notifications.js';
import doctorRoutes from './routes/doctor.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/pantry', pantryRoutes);
app.use('/meals', mealRoutes);
app.use('/notifications', notificationRoutes);
app.use('/doctor', doctorRoutes);

// Last-resort error handler: anything an individual route didn't
// already catch and format lands here instead of crashing the process.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
