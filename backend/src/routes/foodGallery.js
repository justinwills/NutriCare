import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { pool } from "../db/pool.js";
import { hasActiveDoctorLink } from "../services/supervisionService.js";

const router = Router();
const MAX_IMAGE_DATA_LENGTH = 10 * 1024 * 1024;
router.use(requireAuth);

function validateEntry(body) {
  const imageData = body?.imageData;
  const detectedFoods = body?.detectedFoods;
  const nutrition = body?.nutrition;
  if (
    typeof imageData !== "string" ||
    !/^data:image\/(png|jpeg|webp);base64,/.test(imageData)
  ) {
    throw new Error("imageData must be a PNG, JPEG, or WebP data URL");
  }
  if (imageData.length > MAX_IMAGE_DATA_LENGTH)
    throw new Error("Image must be smaller than 7 MB");
  if (!Array.isArray(detectedFoods) || detectedFoods.length > 50)
    throw new Error("detectedFoods must be an array with at most 50 entries");
  if (
    nutrition === null ||
    typeof nutrition !== "object" ||
    Array.isArray(nutrition)
  )
    throw new Error("nutrition must be an object");
  return { imageData, detectedFoods, nutrition };
}

router.post(
  "/",
  asyncHandler(async (req, res) => {
    try {
      const { imageData, detectedFoods, nutrition } = validateEntry(req.body);
      const { rows } = await pool.query(
        `INSERT INTO food_gallery_entries (patient_id, detected_foods, nutrition, image_data)
       VALUES ($1, $2::jsonb, $3::jsonb, $4)
       RETURNING id, patient_id, meal_id, detected_foods, nutrition, created_at`,
        [
          req.user.userId,
          JSON.stringify(detectedFoods),
          JSON.stringify(nutrition),
          imageData,
        ],
      );
      res.status(201).json({ entry: rows[0] });
    } catch (error) {
      res
        .status(400)
        .json({ error: error.message || "Unable to save food photo" });
    }
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, patient_id, meal_id, image_data, detected_foods, nutrition, created_at
     FROM food_gallery_entries WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.user.userId],
    );
    res.json({ entries: rows });
  }),
);

router.get(
  "/patient/:patientId",
  requireRole("doctor"),
  asyncHandler(async (req, res) => {
    const patientId = String(req.params.patientId);
    if (!(await hasActiveDoctorLink(req.user.userId, patientId))) {
      return res
        .status(403)
        .json({ error: "You are not linked to this patient" });
    }
    const { rows } = await pool.query(
      `SELECT id, patient_id, meal_id, image_data, detected_foods, nutrition, created_at
     FROM food_gallery_entries WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [patientId],
    );
    res.json({ entries: rows });
  }),
);

export default router;
