import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db/pool.js';
import { asyncHandler } from './middleware/asyncHandler.js';
import { errorMessage } from './utils/errorMessage.js';

import authRoutes from './routes/auth.js';
import pantryRoutes from './routes/pantry.js';
import mealRoutes from './routes/meals.js';
import notificationRoutes from './routes/notifications.js';
import doctorRoutes from './routes/doctor.js';
import ocrRoutes from './routes/ocr.js';
import supervisionRoutes from './routes/supervision.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const alertSoundPath = path.join(__dirname, '../../notificationalert.mp3');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(publicDir));
app.get('/notificationalert.mp3', (req, res) => res.sendFile(alertSoundPath));

app.get('/health', asyncHandler(async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'connected' });
  } catch (error) {
    console.error('Health check database failure:', errorMessage(error, 'unknown database error'));
    res.status(503).json({ ok: false, database: 'unavailable', error: 'Database unavailable' });
  }
}));

app.use('/auth', authRoutes);
app.use('/pantry', pantryRoutes);
app.use('/meals', mealRoutes);
app.use('/notifications', notificationRoutes);
app.use('/doctor', doctorRoutes);
app.use('/ocr', ocrRoutes);
app.use('/supervision', supervisionRoutes);

// Last-resort error handler: anything an individual route didn't
// already catch and format lands here instead of crashing the process.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err?.statusCode) && err.statusCode >= 400 ? err.statusCode : 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : errorMessage(err) });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
