import { Router } from 'express';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { requireAuth } from '../middleware/auth.js';

const runFile = promisify(execFile);
const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');
const defaultPython = process.platform === 'win32'
  ? path.join(projectRoot, '.venv', 'Scripts', 'python.exe')
  : path.join(projectRoot, '.venv', 'bin', 'python');
const MAX_IMAGE_BYTES = 7 * 1024 * 1024;

router.use(requireAuth);

// POST /ocr/scan { imageData: "data:image/jpeg;base64,..." }
router.post('/scan', async (req, res) => {
  const { imageData } = req.body ?? {};
  const match = typeof imageData === 'string' && imageData.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return res.status(400).json({ error: 'Upload a PNG, JPEG, or WebP image.' });

  const image = Buffer.from(match[2], 'base64');
  if (!image.length || image.length > MAX_IMAGE_BYTES) {
    return res.status(400).json({ error: 'Image must be smaller than 7 MB.' });
  }

  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const imagePath = path.join(os.tmpdir(), `reverie-ocr-${crypto.randomUUID()}.${extension}`);
  try {
    await fs.writeFile(imagePath, image);
    const python = process.env.PYTHON_EXECUTABLE || defaultPython;
    const { stdout } = await runFile(python, [path.join(projectRoot, 'ocr_pipeline.py'), imagePath], {
      cwd: projectRoot,
      // PaddleOCR may download/warm its model the first time it is used.
      timeout: 300_000,
      maxBuffer: 5 * 1024 * 1024,
    });
    // Some OCR versions log before the program's final JSON line.
    const jsonLine = stdout.trim().split(/\r?\n/).reverse().find((line) => line.trim().startsWith('{'));
    if (!jsonLine) throw new Error('OCR did not return a result.');
    res.json(JSON.parse(jsonLine));
  } catch (error) {
    console.error('OCR scan failed:', error);
    const reason = error instanceof Error ? error.message : 'Unknown OCR error';
    res.status(500).json({ error: `Could not scan this image: ${reason}` });
  } finally {
    await fs.unlink(imagePath).catch(() => {});
  }
});

export default router;
