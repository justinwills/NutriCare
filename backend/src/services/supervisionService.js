import { pool } from '../db/pool.js';
import { createNotification } from './notificationService.js';
import { toBaseUnit } from './units.js';

const NUTRIENT_METRICS = [
  { key: 'calories', name: 'Calories', totalKey: 'caloriesKcal', unit: 'kcal' },
  { key: 'protein', name: 'Protein', totalKey: 'proteinG', unit: 'g' },
  { key: 'carbohydrates', name: 'Carbohydrates', totalKey: 'carbohydrateG', unit: 'g' },
  { key: 'fat', name: 'Fat', totalKey: 'fatG', unit: 'g' },
  { key: 'fibre', name: 'Fibre', totalKey: 'fiberG', unit: 'g' },
  { key: 'sugar', name: 'Sugar', totalKey: 'sugarG', unit: 'g' },
  { key: 'sodium', name: 'Sodium', totalKey: 'sodiumMg', unit: 'mg' },
];

const NUTRIENT_ALIASES = new Map([
  ['calorie', 'calories'],
  ['calories', 'calories'],
  ['protein', 'protein'],
  ['carb', 'carbohydrates'],
  ['carbs', 'carbohydrates'],
  ['carbohydrate', 'carbohydrates'],
  ['carbohydrates', 'carbohydrates'],
  ['fat', 'fat'],
  ['fibre', 'fibre'],
  ['fiber', 'fibre'],
  ['sugar', 'sugar'],
  ['sodium', 'sodium'],
]);

const SUPPORTED_NUTRIENT_KEYS = new Set(NUTRIENT_METRICS.map((metric) => metric.key));

export function normalizePlanName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function isValidTimezone(timezone) {
  if (typeof timezone !== 'string' || !timezone.trim() || timezone.length > 100) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function localDateForTimezone(value, timezone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: isValidTimezone(timezone) ? timezone : 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export async function hasActiveDoctorLink(doctorId, patientId, client = pool) {
  const { rows } = await client.query(
    `SELECT 1
     FROM doctor_patient_links l
     JOIN users p ON p.id = l.patient_id AND p.role = 'hospital_patient'
     WHERE l.doctor_id = $1 AND l.patient_id = $2 AND l.status = 'active'`,
    [doctorId, patientId]
  );
  return rows.length > 0;
}

function canonicalNutrientKey(value) {
  return NUTRIENT_ALIASES.get(normalizePlanName(value)) || null;
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function formatAmount(value) {
  return round(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function convertMetricAmount(amount, fromUnit, toUnit) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return null;
  if (fromUnit === toUnit) return numeric;
  if (fromUnit === 'g' && toUnit === 'mg') return numeric * 1000;
  if (fromUnit === 'mg' && toUnit === 'g') return numeric / 1000;
  return null;
}

function namesMatch(metricKey, planKey) {
  if (metricKey === planKey) return true;
  if (planKey.length < 3 || metricKey.length < 3) return false;
  return ` ${metricKey} `.includes(` ${planKey} `) || ` ${planKey} `.includes(` ${metricKey} `);
}

function currentAmountForLimit(limit, metrics) {
  const planKey = normalizePlanName(limit.name_key || limit.name);
  const nutrientKey = limit.limit_type === 'nutrient' ? canonicalNutrientKey(planKey) : null;

  if (limit.limit_type === 'nutrient' && !nutrientKey) return null;

  let total = 0;
  for (const metric of metrics) {
    const matches = limit.limit_type === 'nutrient'
      ? metric.metric_type === 'nutrient' && metric.metric_key === nutrientKey
      : metric.metric_type === 'ingredient' && namesMatch(metric.metric_key, planKey);
    if (!matches) continue;

    const converted = convertMetricAmount(metric.amount, metric.unit, limit.unit);
    if (converted !== null) total += converted;
  }

  return round(total);
}

function dailyTotalsFromMetrics(metrics) {
  const totals = new Map();
  for (const metric of metrics) {
    const key = `${metric.metric_type}:${metric.metric_key}:${metric.unit}`;
    const previous = totals.get(key);
    totals.set(key, {
      metric_type: metric.metric_type,
      metric_name: previous?.metric_name || metric.metric_name,
      metric_key: metric.metric_key,
      amount: round((previous?.amount || 0) + Number(metric.amount)),
      unit: metric.unit,
    });
  }
  return [...totals.values()].sort((a, b) => a.metric_name.localeCompare(b.metric_name));
}

async function loadDailyMetrics(client, patientId, localDate) {
  const { rows } = await client.query(
    `SELECT metric_type, metric_name, metric_key, amount, unit
     FROM meal_consumption_metrics
     WHERE patient_id = $1 AND local_date = $2`,
    [patientId, localDate]
  );
  return rows;
}

export async function getPatientPlan({ patientId, doctorId = null, client = pool }) {
  if (doctorId && !(await hasActiveDoctorLink(doctorId, patientId, client))) {
    return null;
  }

  const { rows: patients } = await client.query(
    `SELECT id, full_name, email, role, timezone
     FROM users
     WHERE id = $1 AND role = 'hospital_patient'`,
    [patientId]
  );
  if (patients.length === 0) return null;

  const patient = patients[0];
  const ownerClause = doctorId ? 'AND source.doctor_id = $2' : '';
  const params = doctorId ? [patientId, doctorId] : [patientId];

  const [{ rows: conditions }, { rows: limits }, { rows: recommendations }] = await Promise.all([
    client.query(
      `SELECT source.*
       FROM patient_conditions source
       JOIN doctor_patient_links link
         ON link.patient_id = source.patient_id
        AND link.doctor_id = source.doctor_id
        AND link.status = 'active'
       WHERE source.patient_id = $1 ${ownerClause}
       ORDER BY source.condition_name`,
      params
    ),
    client.query(
      `SELECT source.*
       FROM dietary_limits source
       JOIN doctor_patient_links link
         ON link.patient_id = source.patient_id
        AND link.doctor_id = source.doctor_id
        AND link.status = 'active'
       WHERE source.patient_id = $1 ${ownerClause}
       ORDER BY source.enabled DESC, source.name`,
      params
    ),
    client.query(
      `SELECT source.*
       FROM food_recommendations source
       JOIN doctor_patient_links link
         ON link.patient_id = source.patient_id
        AND link.doctor_id = source.doctor_id
        AND link.status = 'active'
       WHERE source.patient_id = $1 ${ownerClause}
       ORDER BY CASE source.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                source.food_name`,
      params
    ),
  ]);

  const localDate = localDateForTimezone(new Date(), patient.timezone);
  const metrics = await loadDailyMetrics(client, patientId, localDate);
  const limitsWithProgress = limits.map((limit) => {
    const currentAmount = currentAmountForLimit(limit, metrics);
    const maximum = Number(limit.maximum_amount);
    return {
      ...limit,
      current_amount: currentAmount,
      progress_percent: currentAmount === null ? null : round((currentAmount / maximum) * 100),
      exceeded: currentAmount !== null && currentAmount > maximum,
    };
  });

  return {
    patient,
    date: localDate,
    conditions,
    limits: limitsWithProgress,
    recommendations,
    daily_totals: dailyTotalsFromMetrics(metrics.filter((metric) => metric.metric_type === 'nutrient')),
  };
}

async function insertMealMetrics({ client, patientId, meal, items, nutrition, localDate }) {
  for (const definition of NUTRIENT_METRICS) {
    const amount = Number(nutrition.totals[definition.totalKey] || 0);
    await client.query(
      `INSERT INTO meal_consumption_metrics
         (meal_id, patient_id, local_date, metric_type, metric_name, metric_key, amount, unit)
       VALUES ($1, $2, $3, 'nutrient', $4, $5, $6, $7)
       ON CONFLICT (meal_id, metric_type, metric_key, unit) DO NOTHING`,
      [meal.id, patientId, localDate, definition.name, definition.key, amount, definition.unit]
    );
  }

  const ingredientTotals = new Map();
  for (const item of items) {
    const metricKey = normalizePlanName(item.label);
    if (!metricKey) continue;

    let amount;
    let unit;
    try {
      amount = toBaseUnit(item.quantity_used, item.unit, 'g');
      unit = 'g';
    } catch {
      try {
        amount = toBaseUnit(item.quantity_used, item.unit, 'ml');
        unit = 'ml';
      } catch {
        continue;
      }
    }

    const key = `${metricKey}:${unit}`;
    const existing = ingredientTotals.get(key);
    ingredientTotals.set(key, {
      name: existing?.name || item.label,
      metricKey,
      unit,
      amount: (existing?.amount || 0) + amount,
    });
  }

  for (const ingredient of ingredientTotals.values()) {
    await client.query(
      `INSERT INTO meal_consumption_metrics
         (meal_id, patient_id, local_date, metric_type, metric_name, metric_key, amount, unit)
       VALUES ($1, $2, $3, 'ingredient', $4, $5, $6, $7)
       ON CONFLICT (meal_id, metric_type, metric_key, unit) DO NOTHING`,
      [
        meal.id,
        patientId,
        localDate,
        ingredient.name,
        ingredient.metricKey,
        round(ingredient.amount),
        ingredient.unit,
      ]
    );
  }
}

export async function recordConfirmedMealAndCheckLimits({
  client,
  patientId,
  meal,
  items,
  nutrition,
  timezone,
}) {
  const { rows: users } = await client.query(
    `SELECT id, full_name, role, timezone FROM users WHERE id = $1 FOR UPDATE`,
    [patientId]
  );
  const patient = users[0];
  if (!patient || patient.role !== 'hospital_patient') {
    return { alertsCreated: 0, localDate: null };
  }

  let patientTimezone = patient.timezone || 'UTC';
  if (timezone !== undefined) {
    if (!isValidTimezone(timezone)) throw new Error('timezone must be a valid IANA timezone');
    patientTimezone = timezone;
    if (patientTimezone !== patient.timezone) {
      await client.query('UPDATE users SET timezone = $1 WHERE id = $2', [patientTimezone, patientId]);
    }
  }

  const localDate = localDateForTimezone(meal.logged_at, patientTimezone);
  await insertMealMetrics({ client, patientId, meal, items, nutrition, localDate });

  const { rows: limits } = await client.query(
    `SELECT limits.*
     FROM dietary_limits limits
     JOIN doctor_patient_links link
       ON link.patient_id = limits.patient_id
      AND link.doctor_id = limits.doctor_id
      AND link.status = 'active'
     WHERE limits.patient_id = $1 AND limits.enabled = true`,
    [patientId]
  );
  const metrics = await loadDailyMetrics(client, patientId, localDate);
  let alertsCreated = 0;

  for (const limit of limits) {
    const currentAmount = currentAmountForLimit(limit, metrics);
    const maximum = Number(limit.maximum_amount);
    if (currentAmount === null || currentAmount <= maximum) continue;

    const overage = round(currentAmount - maximum);
    const common = {
      type: 'nutrition_limit_exceeded',
      relatedPatientId: patientId,
      relatedDoctorId: limit.doctor_id,
      dietaryLimitId: limit.id,
      localDate,
      nutrientName: limit.limit_type === 'nutrient' ? limit.name : null,
      foodName: limit.limit_type === 'ingredient' ? limit.name : null,
      currentAmount,
      limitAmount: maximum,
      unit: limit.unit,
      dedupKey: `limit-exceeded:${limit.id}:${localDate}`,
      metadata: {
        limitType: limit.limit_type,
        limitName: limit.name,
        overage,
        explanation: limit.explanation,
      },
      client,
    };

    const patientNotification = await createNotification({
      ...common,
      userId: patientId,
      message: `You have exceeded today's ${limit.name} limit. Your current intake is ${formatAmount(currentAmount)} ${limit.unit}; your doctor-set limit is ${formatAmount(maximum)} ${limit.unit} on ${localDate}.`,
    });
    const doctorNotification = await createNotification({
      ...common,
      userId: limit.doctor_id,
      message: `Warning: ${patient.full_name}'s ${limit.name} intake has reached ${formatAmount(currentAmount)} ${limit.unit} on ${localDate}, exceeding the daily limit of ${formatAmount(maximum)} ${limit.unit} by ${formatAmount(overage)} ${limit.unit}.`,
    });
    if (patientNotification) alertsCreated += 1;
    if (doctorNotification) alertsCreated += 1;
  }

  return { alertsCreated, localDate };
}

export async function syncRecommendationNotification({ client, recommendation }) {
  const frequency = recommendation.recommended_frequency
    ? ` Recommended frequency: ${recommendation.recommended_frequency}.`
    : '';
  const message = recommendation.recommendation_type === 'consume_more'
    ? `Your doctor recommends consuming more ${recommendation.food_name}.${frequency} Reason: ${recommendation.doctor_reason}`
    : `Your doctor recommends limiting or avoiding ${recommendation.food_name}. Reason: ${recommendation.doctor_reason}`;
  const dedupKey = `recommendation:${recommendation.id}`;
  const metadata = {
    recommendationType: recommendation.recommendation_type,
    priority: recommendation.priority,
    recommendedFrequency: recommendation.recommended_frequency,
  };

  const { rows } = await client.query(
    `INSERT INTO notifications (
       user_id,
       type,
       message,
       related_patient_id,
       related_doctor_id,
       food_recommendation_id,
       food_name,
       dedup_key,
       metadata
     )
     VALUES ($1, 'doctor_food_recommendation', $2, $1, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, dedup_key) WHERE dedup_key IS NOT NULL
     DO UPDATE SET
       message = EXCLUDED.message,
       read = false,
       food_name = EXCLUDED.food_name,
       metadata = EXCLUDED.metadata,
       created_at = now()
     RETURNING *`,
    [
      recommendation.patient_id,
      message,
      recommendation.doctor_id,
      recommendation.id,
      recommendation.food_name,
      dedupKey,
      metadata,
    ]
  );
  return rows[0];
}

export async function checkAvoidedFoodsFromOcr({ patientId, foodNames }) {
  const names = [...new Set((foodNames || []).map((name) => String(name).trim()).filter(Boolean))];
  if (names.length === 0) return [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: patients } = await client.query(
      `SELECT id, full_name, role, timezone FROM users WHERE id = $1`,
      [patientId]
    );
    const patient = patients[0];
    if (!patient || patient.role !== 'hospital_patient') {
      await client.query('COMMIT');
      return [];
    }

    const { rows: recommendations } = await client.query(
      `SELECT recommendations.*
       FROM food_recommendations recommendations
       JOIN doctor_patient_links link
         ON link.patient_id = recommendations.patient_id
        AND link.doctor_id = recommendations.doctor_id
        AND link.status = 'active'
       WHERE recommendations.patient_id = $1
         AND recommendations.recommendation_type = 'avoid'`,
      [patientId]
    );
    const localDate = localDateForTimezone(new Date(), patient.timezone || 'UTC');
    const warnings = [];

    for (const recommendation of recommendations) {
      const detectedFood = names.find((name) =>
        namesMatch(normalizePlanName(name), recommendation.food_key)
      );
      if (!detectedFood) continue;

      const dedupKey = `ocr-avoid:${patientId}:${recommendation.id}:${localDate}`;
      const common = {
        type: 'possible_avoid_food_purchase',
        relatedPatientId: patientId,
        relatedDoctorId: recommendation.doctor_id,
        foodRecommendationId: recommendation.id,
        localDate,
        foodName: detectedFood,
        dedupKey,
        metadata: {
          possiblePurchase: true,
          consumptionConfirmed: false,
          priority: recommendation.priority,
          recommendationFood: recommendation.food_name,
          doctorReason: recommendation.doctor_reason,
        },
        client,
      };
      const patientMessage = `Possible purchase warning: ${detectedFood} was detected in your upload and is on your doctor's avoid or limit list. Doctor's note: ${recommendation.doctor_reason}. Consumption has not been confirmed.`;
      const doctorMessage = `Warning: ${detectedFood} was detected in ${patient.full_name}'s upload. This food is on the doctor's avoid or limit list. Recorded reason: ${recommendation.doctor_reason}. Consumption has not been confirmed.`;
      await createNotification({ ...common, userId: patientId, message: patientMessage });
      await createNotification({
        ...common,
        userId: recommendation.doctor_id,
        message: doctorMessage,
      });
      warnings.push({
        foodName: detectedFood,
        recommendationId: recommendation.id,
        priority: recommendation.priority,
        message: patientMessage,
      });
    }

    await client.query('COMMIT');
    return warnings;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function isSupportedNutrientName(value) {
  const key = canonicalNutrientKey(value);
  return key !== null && SUPPORTED_NUTRIENT_KEYS.has(key);
}
