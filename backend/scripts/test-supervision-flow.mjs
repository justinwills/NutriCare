import 'dotenv/config';
import { pool } from '../src/db/pool.js';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3002';
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = 'NutriCare-Test-9824!';
const accounts = {
  patient: `supervision.patient.${suffix}@example.com`,
  doctor: `supervision.doctor.${suffix}@example.com`,
  unrelatedDoctor: `supervision.unrelated.${suffix}@example.com`,
  personal: `supervision.personal.${suffix}@example.com`,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { token, method = 'GET', body, expected = 200 } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;
  const expectedStatuses = Array.isArray(expected) ? expected : [expected];
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${method} ${path} returned ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function register(email, fullName, role) {
  return request('/auth/register', {
    method: 'POST',
    expected: 201,
    body: { email, password, fullName, role },
  });
}

async function login(email) {
  return request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

try {
  const patientRegistration = await register(accounts.patient, 'Rachel Supervision Test', 'hospital_patient');
  await register(accounts.doctor, 'Dr Supervision Test', 'doctor');
  await register(accounts.unrelatedDoctor, 'Dr Unrelated Test', 'doctor');
  const personalRegistration = await register(accounts.personal, 'Personal Supervision Test', 'personal');

  const [patientLogin, doctorLogin, unrelatedLogin, personalLogin] = await Promise.all([
    login(accounts.patient),
    login(accounts.doctor),
    login(accounts.unrelatedDoctor),
    login(accounts.personal),
  ]);
  const patientId = patientRegistration.user.id;
  const personalId = personalRegistration.user.id;

  await request('/doctor/link-patient', {
    token: doctorLogin.token,
    method: 'POST',
    expected: 201,
    body: { patientId },
  });
  await request('/doctor/link-patient', {
    token: doctorLogin.token,
    method: 'POST',
    expected: 400,
    body: { patientId: personalId },
  });

  await request(`/doctor/patients/${patientId}/conditions`, {
    token: doctorLogin.token,
    method: 'PUT',
    body: { conditions: ['Hypertension'] },
  });
  const limitResult = await request(`/doctor/patients/${patientId}/limits`, {
    token: doctorLogin.token,
    method: 'POST',
    expected: 201,
    body: {
      limitType: 'nutrient',
      name: 'sodium',
      maximumAmount: 1,
      unit: 'mg',
      explanation: 'Integration-test maximum.',
      enabled: true,
    },
  });
  const avoidResult = await request(`/doctor/patients/${patientId}/recommendations`, {
    token: doctorLogin.token,
    method: 'POST',
    expected: 201,
    body: {
      recommendationType: 'avoid',
      foodName: 'instant noodles',
      doctorReason: 'Doctor-entered avoid-list test.',
      priority: 'high',
    },
  });
  const consumeMoreResult = await request(`/doctor/patients/${patientId}/recommendations`, {
    token: doctorLogin.token,
    method: 'POST',
    expected: 201,
    body: {
      recommendationType: 'consume_more',
      foodName: 'spinach',
      doctorReason: 'Doctor-entered recommendation test.',
      priority: 'medium',
      recommendedFrequency: 'Once daily',
    },
  });

  await request(`/doctor/patients/${patientId}/recommendations/${consumeMoreResult.recommendation.id}`, {
    token: doctorLogin.token,
    method: 'PATCH',
    body: { recommendedFrequency: 'Twice weekly' },
  });

  const doctorPlan = await request(`/doctor/patients/${patientId}/plan`, {
    token: doctorLogin.token,
  });
  assert(doctorPlan.plan.conditions.some((item) => item.condition_name === 'Hypertension'), 'Condition was not saved');
  assert(doctorPlan.plan.limits.length === 1, 'Dietary limit was not saved');
  assert(doctorPlan.plan.recommendations.length === 2, 'Food recommendations were not saved');

  await request(`/doctor/patients/${patientId}/plan`, {
    token: unrelatedLogin.token,
    expected: 403,
  });
  await request('/supervision', { token: personalLogin.token, expected: 403 });
  await request(`/doctor/patients/${patientId}/conditions`, {
    token: patientLogin.token,
    method: 'PUT',
    expected: 403,
    body: { conditions: ['Diabetes'] },
  });

  const mealBody = {
    notes: 'Confirmed rice serving',
    timezone: 'Asia/Shanghai',
    items: [{
      pantryItemId: null,
      label: 'white rice',
      quantityUsed: 100,
      unit: 'g',
      source: 'manual',
    }],
  };
  const firstMeal = await request('/meals', {
    token: patientLogin.token,
    method: 'POST',
    expected: 201,
    body: mealBody,
  });
  assert(firstMeal.nutrition.totals.sodiumMg === 5, 'Expected 5 mg sodium for the confirmed meal');
  assert(firstMeal.alertsCreated === 2, 'Expected one patient and one doctor limit warning');

  let patientPlan = await request('/supervision', { token: patientLogin.token });
  const sodiumLimit = patientPlan.plan.limits.find((limit) => limit.id === limitResult.limit.id);
  assert(sodiumLimit.current_amount === 5, 'Daily sodium total did not update to 5 mg');
  assert(sodiumLimit.exceeded === true, 'Daily sodium limit was not marked exceeded');

  await request('/meals', {
    token: patientLogin.token,
    method: 'POST',
    expected: 201,
    body: mealBody,
  });
  patientPlan = await request('/supervision', { token: patientLogin.token });
  const repeatedSodium = patientPlan.plan.limits.find((limit) => limit.id === limitResult.limit.id);
  assert(repeatedSodium.current_amount === 10, 'Repeated meal did not update the cumulative daily total');

  const patientNotifications = await request('/notifications', { token: patientLogin.token });
  const doctorNotifications = await request('/notifications', { token: doctorLogin.token });
  const patientLimitWarnings = patientNotifications.notifications.filter(
    (item) => item.type === 'nutrition_limit_exceeded'
  );
  const doctorLimitWarnings = doctorNotifications.notifications.filter(
    (item) => item.type === 'nutrition_limit_exceeded'
  );
  assert(patientLimitWarnings.length === 1, 'Patient received duplicate daily-limit warnings');
  assert(doctorLimitWarnings.length === 1, 'Doctor received duplicate daily-limit warnings');
  assert(patientLimitWarnings[0].current_amount === '5.0000', 'Structured current amount is missing');
  assert(patientLimitWarnings[0].limit_amount === '1.0000', 'Structured limit amount is missing');
  assert(patientLimitWarnings[0].unit === 'mg', 'Structured notification unit is missing');

  const ocrCheck = await request('/ocr/check-foods', {
    token: patientLogin.token,
    method: 'POST',
    body: { foodNames: ['Instant noodles'] },
  });
  assert(ocrCheck.planWarnings.length === 1, 'Avoid-list OCR warning was not created');
  assert(
    ocrCheck.planWarnings[0].message.includes('Consumption has not been confirmed'),
    'OCR warning incorrectly implied confirmed consumption'
  );
  await request('/ocr/check-foods', {
    token: patientLogin.token,
    method: 'POST',
    body: { foodNames: ['Instant noodles'] },
  });
  await request('/ocr/check-foods', {
    token: personalLogin.token,
    method: 'POST',
    expected: 403,
    body: { foodNames: ['Instant noodles'] },
  });

  const finalPatientNotifications = await request('/notifications', { token: patientLogin.token });
  const finalDoctorNotifications = await request('/notifications', { token: doctorLogin.token });
  assert(
    finalPatientNotifications.notifications.filter((item) => item.type === 'possible_avoid_food_purchase').length === 1,
    'Patient received duplicate possible-purchase warnings'
  );
  assert(
    finalDoctorNotifications.notifications.filter((item) => item.type === 'possible_avoid_food_purchase').length === 1,
    'Doctor received duplicate possible-purchase warnings'
  );

  const readResult = await request(`/notifications/${patientLimitWarnings[0].id}/read`, {
    token: patientLogin.token,
    method: 'PATCH',
  });
  assert(readResult.notification.read === true, 'Notification read state was not saved');

  await request(`/doctor/patients/${patientId}/limits/${limitResult.limit.id}`, {
    token: doctorLogin.token,
    method: 'PATCH',
    body: { enabled: false },
  });
  const disabledPlan = await request(`/doctor/patients/${patientId}/plan`, {
    token: doctorLogin.token,
  });
  assert(disabledPlan.plan.limits[0].enabled === false, 'Limit enabled status was not updated');
  assert(avoidResult.recommendation.recommendation_type === 'avoid', 'Avoid recommendation response was invalid');

  console.log('PASS doctor/patient linking and active-link authorization');
  console.log('PASS conditions, flexible limits, recommendations, update, and disable');
  console.log('PASS timezone-aware cumulative sodium totals from confirmed meals');
  console.log('PASS one patient and one doctor warning per limit/date');
  console.log('PASS possible-purchase OCR wording and deduplication');
  console.log('PASS personal/unrelated/patient mutation 403 checks and read status');
} finally {
  const emails = Object.values(accounts);
  const result = await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [emails]);
  await pool.end();
  console.log(`Cleaned up ${result.rowCount} temporary account(s).`);
}
