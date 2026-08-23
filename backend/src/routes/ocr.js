import { Router } from "express";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { checkAvoidedFoodsFromOcr } from "../services/supervisionService.js";
import { errorMessage } from "../utils/errorMessage.js";

const runFile = promisify(execFile);
const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");
const defaultPython =
  process.platform === "win32"
    ? path.join(projectRoot, ".venv", "Scripts", "python.exe")
    : path.join(projectRoot, ".venv", "bin", "python");
const MAX_IMAGE_BYTES = 7 * 1024 * 1024;

async function resolvePython() {
  if (process.env.PYTHON_EXECUTABLE) return process.env.PYTHON_EXECUTABLE;
  try {
    await fs.access(defaultPython);
    return defaultPython;
  } catch {
    // Fall back to a Python executable on PATH for machines that installed
    // PaddleOCR globally instead of creating the documented .venv.
    return process.platform === "win32" ? "python" : "python3";
  }
}

router.use(requireAuth);

router.post(
  "/recognize-food",
  asyncHandler(async (req, res) => {
    const { imageData } = req.body ?? {};
    const match =
      typeof imageData === "string" &&
      imageData.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match)
      return res
        .status(400)
        .json({ error: "Upload a PNG, JPEG, or WebP image." });

    const image = Buffer.from(match[2], "base64");
    if (!image.length || image.length > MAX_IMAGE_BYTES) {
      return res
        .status(400)
        .json({ error: "Image must be smaller than 7 MB." });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error:
          "Plate recognition is unavailable. Set OPENAI_API_KEY in backend/.env.",
      });
    }
    const visionModel = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
    const visionBaseUrl = (
      process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
    ).replace(/\/$/, "");

    try {
      const response = await fetch(`${visionBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: visionModel,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: 'Identify the distinct foods visible on this plate. Return JSON only in this shape: {"foods":[{"name":"string","state":"raw|cooked|ready_to_eat","estimatedQuantity":number,"unit":"g","confidence":number}]}. Use one item per visible food, estimate edible portion weight in grams, and use 0 when it cannot be estimated. Identify preparation state from visible evidence: roasted, grilled, baked, boiled, fried, steamed, or otherwise visibly prepared food is cooked; use raw only when clearly uncooked. Include the state in the name, such as "Chicken breast, cooked" or "Carrot, raw", so nutrition matching can select the correct record. Confidence must be from 0 to 1. Do not identify people, brands, ingredients that are not visible, or nutrition facts. If this is not a food plate, return {"foods":[]}.',
                },
                { type: "image_url", image_url: { url: imageData } },
              ],
            },
          ],
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `Vision provider returned ${response.status}: ${detail.slice(0, 300)}`,
        );
      }

      const payload = await response.json();
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string")
        throw new Error("Vision provider returned no result.");
      const parsed = JSON.parse(
        content.replace(/^```json\s*|\s*```$/g, "").trim(),
      );
      const foods = Array.isArray(parsed.foods)
        ? parsed.foods
            .filter(
              (food) => typeof food?.name === "string" && food.name.trim(),
            )
            .slice(0, 20)
            .map((food) => ({
              name: `${food.name.trim()}, ${food.state === "raw" ? "raw" : "cooked"}`,
              state: food.state === "raw" ? "raw" : "cooked",
              estimatedQuantity: Number.isFinite(Number(food.estimatedQuantity))
                ? Math.max(0, Number(food.estimatedQuantity))
                : 0,
              unit: "g",
              confidence: Math.min(
                1,
                Math.max(0, Number(food.confidence) || 0),
              ),
            }))
        : [];
      const planWarnings = await checkAvoidedFoodsFromOcr({
        patientId: req.user.userId,
        foodNames: foods.map((food) => food.name),
      });
      res.json({ foods, planWarnings });
    } catch (error) {
      console.error("Plate food recognition failed:", error);
      res.status(502).json({
        error:
          "Could not recognize food in this photo. Check the vision provider configuration and try again.",
      });
    }
  }),
);

// POST /ocr/scan { imageData: "data:image/jpeg;base64,..." }
router.post(
  "/scan",
  asyncHandler(async (req, res) => {
    const { imageData } = req.body ?? {};
    const match =
      typeof imageData === "string" &&
      imageData.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match)
      return res
        .status(400)
        .json({ error: "Upload a PNG, JPEG, or WebP image." });

    const image = Buffer.from(match[2], "base64");
    if (!image.length || image.length > MAX_IMAGE_BYTES) {
      return res
        .status(400)
        .json({ error: "Image must be smaller than 7 MB." });
    }

    const extension = match[1] === "jpeg" ? "jpg" : match[1];
    const imagePath = path.join(
      os.tmpdir(),
      `reverie-ocr-${randomUUID()}.${extension}`,
    );
    try {
      await fs.writeFile(imagePath, image);
      const python = await resolvePython();
      const { stdout } = await runFile(
        python,
        [path.join(projectRoot, "ocr_pipeline.py"), imagePath],
        {
          cwd: projectRoot,
          // PaddleOCR may download/warm its model the first time it is used.
          timeout: 300_000,
          maxBuffer: 5 * 1024 * 1024,
        },
      );
      // Some OCR versions log before the program's final JSON line.
      const jsonLine = stdout
        .trim()
        .split(/\r?\n/)
        .reverse()
        .find((line) => line.trim().startsWith("{"));
      if (!jsonLine) throw new Error("OCR did not return a result.");
      const result = JSON.parse(jsonLine);
      const planWarnings = await checkAvoidedFoodsFromOcr({
        patientId: req.user.userId,
        foodNames: (result.products || []).map(
          (product) => product.suggestedName,
        ),
      });
      res.json({ ...result, planWarnings });
    } catch (error) {
      console.error("OCR scan failed:", error);
      const detail =
        error?.stderr?.trim() || errorMessage(error, "Unknown OCR error");
      const unavailable =
        error?.code === "ENOENT" ||
        /No module named ['"]?(paddle|paddleocr)/i.test(detail);
      const message = unavailable
        ? "OCR is unavailable. Install PaddleOCR and PaddlePaddle, then set PYTHON_EXECUTABLE if needed."
        : `Could not scan this image: ${detail}`;
      res.status(unavailable ? 503 : 500).json({ error: message });
    } finally {
      await fs.unlink(imagePath).catch(() => {});
    }
  }),
);

/**
 * POST /ocr/check-foods { foodNames: string[] }
 * Accepts already-detected/suggested names for clients that perform image
 * recognition elsewhere. Names may create possible-purchase warnings, but
 * never consumption records.
 */
router.post(
  "/check-foods",
  requireRole("hospital_patient"),
  asyncHandler(async (req, res) => {
    const foodNames = req.body?.foodNames;
    if (
      !Array.isArray(foodNames) ||
      foodNames.length === 0 ||
      foodNames.length > 50
    ) {
      return res.status(400).json({
        error: "foodNames must be a non-empty array with at most 50 entries",
      });
    }
    if (
      foodNames.some(
        (name) => typeof name !== "string" || !name.trim() || name.length > 200,
      )
    ) {
      return res
        .status(400)
        .json({ error: "Each detected food name must be 1 to 200 characters" });
    }
    const planWarnings = await checkAvoidedFoodsFromOcr({
      patientId: req.user.userId,
      foodNames,
    });
    res.json({ planWarnings });
  }),
);

export default router;
