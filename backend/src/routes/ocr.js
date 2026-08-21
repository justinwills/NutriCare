import { Router } from 'express';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { checkAvoidedFoodsFromOcr } from '../services/supervisionService.js';
import { errorMessage } from '../utils/errorMessage.js';

const runFile = promisify(execFile);
const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');
const defaultPython = process.platform === 'win32'
  ? path.join(projectRoot, '.venv', 'Scripts', 'python.exe')
  : path.join(projectRoot, '.venv', 'bin', 'python');
const MAX_IMAGE_BYTES = 7 * 1024 * 1024;

async function resolvePython() {
  if (process.env.PYTHON_EXECUTABLE) return process.env.PYTHON_EXECUTABLE;
  try {
    await fs.access(defaultPython);
    return defaultPython;
  } catch {
    // Fall back to a Python executable on PATH for machines that installed
    // PaddleOCR globally instead of creating the documented .venv.
    return process.platform === 'win32' ? 'python' : 'python3';
  }
}

router.use(requireAuth);

// POST /ocr/scan { imageData: "data:image/jpeg;base64,..." }
router.post('/scan', asyncHandler(async (req, res) => {
  const { imageData } = req.body ?? {};
  const match = typeof imageData === 'string' && imageData.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return res.status(400).json({ error: 'Upload a PNG, JPEG, or WebP image.' });

  const image = Buffer.from(match[2], 'base64');
  if (!image.length || image.length > MAX_IMAGE_BYTES) {
    return res.status(400).json({ error: 'Image must be smaller than 7 MB.' });
  }

  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const imagePath = path.join(os.tmpdir(), `reverie-ocr-${randomUUID()}.${extension}`);
  try {
    await fs.writeFile(imagePath, image);
    const python = await resolvePython();
    const { stdout } = await runFile(python, [path.join(projectRoot, 'ocr_pipeline.py'), imagePath], {
      cwd: projectRoot,
      // PaddleOCR may download/warm its model the first time it is used.
      timeout: 300_000,
      maxBuffer: 5 * 1024 * 1024,
    });
    // Some OCR versions log before the program's final JSON line.
    const jsonLine = stdout.trim().split(/\r?\n/).reverse().find((line) => line.trim().startsWith('{'));
    if (!jsonLine) throw new Error('OCR did not return a result.');
    const result = JSON.parse(jsonLine);
    const planWarnings = await checkAvoidedFoodsFromOcr({
      patientId: req.user.userId,
      foodNames: (result.products || []).map((product) => product.suggestedName),
    });
    res.json({ ...result, planWarnings });
  } catch (error) {
    console.error('OCR scan failed:', error);
    const detail = error?.stderr?.trim() || errorMessage(error, 'Unknown OCR error');
    const unavailable = error?.code === 'ENOENT' || /No module named ['"]?(paddle|paddleocr)/i.test(detail);
    const message = unavailable
      ? 'OCR is unavailable. Install PaddleOCR and PaddlePaddle, then set PYTHON_EXECUTABLE if needed.'
      : `Could not scan this image: ${detail}`;
    res.status(unavailable ? 503 : 500).json({ error: message });
  } finally {
    await fs.unlink(imagePath).catch(() => {});
  }
}));

/**
 * POST /ocr/check-foods { foodNames: string[] }
 * Accepts already-detected/suggested names for clients that perform image
 * recognition elsewhere. Names may create possible-purchase warnings, but
 * never consumption records.
 */
router.post('/check-foods', requireRole('hospital_patient'), asyncHandler(async (req, res) => {
  const foodNames = req.body?.foodNames;
  if (!Array.isArray(foodNames) || foodNames.length === 0 || foodNames.length > 50) {
    return res.status(400).json({ error: 'foodNames must be a non-empty array with at most 50 entries' });
  }
  if (foodNames.some((name) => typeof name !== 'string' || !name.trim() || name.length > 200)) {
    return res.status(400).json({ error: 'Each detected food name must be 1 to 200 characters' });
  }
  const planWarnings = await checkAvoidedFoodsFromOcr({
    patientId: req.user.userId,
    foodNames,
  });
  res.json({ planWarnings });
}));

export default router;
