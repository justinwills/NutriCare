import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import pantryRoutes from './routes/pantry.js';
import mealRoutes from './routes/meals.js';
import notificationRoutes from './routes/notifications.js';
import doctorRoutes from './routes/doctor.js';
import ocrRoutes from './routes/ocr.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const alertSoundPath = path.join(__dirname, '../../notificationalert.mp3');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(publicDir));
app.get('/notificationalert.mp3', (req, res) => res.sendFile(alertSoundPath));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/pantry', pantryRoutes);
app.use('/meals', mealRoutes);
app.use('/notifications', notificationRoutes);
app.use('/doctor', doctorRoutes);
app.use('/ocr', ocrRoutes);

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
