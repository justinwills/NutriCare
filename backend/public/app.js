const API = '';

const state = {
  token: localStorage.getItem('token') || '',
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  pantry: [],
};

const el = (id) => document.getElementById(id);
const statusEl = el('status');

function setStatus(msg, kind = '') {
  statusEl.textContent = msg || '';
  statusEl.className = `status ${kind}`.trim();
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

function saveSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearSession() {
  state.token = '';
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function showAuth(which) {
  document.querySelectorAll('[data-auth-tab]').forEach((b) => {
    b.classList.toggle('active', b.dataset.authTab === which);
  });
  el('loginForm').classList.toggle('hidden', which !== 'login');
  el('registerForm').classList.toggle('hidden', which !== 'register');
}

function showView(name) {
  document.querySelectorAll('#appTabs .tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === name);
  });
  ['pantry', 'meals', 'notifications', 'doctor'].forEach((v) => {
    el(`${v}View`).classList.toggle('hidden', v !== name);
  });
}

function renderShell() {
  const loggedIn = !!state.token && !!state.user;
  el('authView').classList.toggle('hidden', loggedIn);
  el('appView').classList.toggle('hidden', !loggedIn);
  el('userBar').classList.toggle('hidden', !loggedIn);

  if (!loggedIn) return;

  const isDoctor = state.user.role === 'doctor';
  document.querySelectorAll('.doctor-only').forEach((n) => {
    n.classList.toggle('hidden', !isDoctor);
  });

  el('userBar').innerHTML = `
    <span>${escapeHtml(state.user.fullName)} · ${escapeHtml(state.user.role)}</span>
    <button type="button" class="secondary" id="logoutBtn">Logout</button>
  `;
  el('logoutBtn').onclick = () => {
    clearSession();
    setStatus('Logged out');
    renderShell();
  };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function fmtDate(v) {
  if (!v) return '—';
  return String(v).slice(0, 10);
}

async function loadPantry() {
  const data = await api('/pantry');
  state.pantry = data.items || [];
  renderPantry();
  fillMealPantrySelect();
}

function renderPantry() {
  const box = el('pantryList');
  if (!state.pantry.length) {
    box.innerHTML = '<p class="empty">No pantry items yet.</p>';
    return;
  }

  box.innerHTML = state.pantry
    .map((item) => {
      const remaining = Number(item.remaining_quantity);
      const initial = Number(item.initial_quantity);
      return `
        <div class="card" data-id="${item.id}">
          <strong>${escapeHtml(item.product_name)}</strong>
          <div class="meta">
            ${remaining} / ${initial} ${escapeHtml(item.base_unit)}
            · expires ${fmtDate(item.expiration_date)}
            · ${escapeHtml(item.source || 'manual')}
          </div>
          <div class="actions">
            <input class="deduct-qty" type="number" step="any" min="0.01" placeholder="qty" style="width:5.5rem" />
            <select class="deduct-unit">
              <option value="${escapeHtml(item.base_unit)}">${escapeHtml(item.base_unit)}</option>
              <option value="tsp">tsp</option>
              <option value="tbsp">tbsp</option>
              <option value="cup">cup</option>
              <option value="g">g</option>
              <option value="ml">ml</option>
            </select>
            <button type="button" class="secondary deduct-btn">Deduct</button>
          </div>
        </div>
      `;
    })
    .join('');

  box.querySelectorAll('.card').forEach((card) => {
    card.querySelector('.deduct-btn').onclick = async () => {
      const quantityUsed = Number(card.querySelector('.deduct-qty').value);
      const unit = card.querySelector('.deduct-unit').value;
      if (!quantityUsed) {
        setStatus('Enter a quantity to deduct', 'err');
        return;
      }
      try {
        await api(`/pantry/${card.dataset.id}/deduct`, {
          method: 'POST',
          body: JSON.stringify({ quantityUsed, unit }),
        });
        setStatus('Deducted', 'ok');
        await loadPantry();
        await loadNotifications().catch(() => {});
      } catch (err) {
        setStatus(err.message, 'err');
      }
    };
  });
}

function fillMealPantrySelect() {
  const select = el('mealPantrySelect');
  const current = select.value;
  select.innerHTML =
    '<option value="">(manual — no deduction)</option>' +
    state.pantry
      .map(
        (item) =>
          `<option value="${item.id}">${escapeHtml(item.product_name)} (${item.remaining_quantity}${item.base_unit})</option>`
      )
      .join('');
  select.value = current;
}

async function loadMeals() {
  const data = await api('/meals');
  const box = el('mealsList');
  const meals = data.meals || [];
  if (!meals.length) {
    box.innerHTML = '<p class="empty">No meals logged yet.</p>';
    return;
  }

  box.innerHTML = meals
    .map((meal) => {
      const items = (meal.items || [])
        .map((i) => `${escapeHtml(i.label)} ${i.quantity_used}${escapeHtml(i.unit)}`)
        .join(', ');
      return `
        <div class="card">
          <strong>${fmtDate(meal.logged_at)}</strong>
          <div class="meta">${escapeHtml(meal.notes || 'No notes')} · ${items || 'no items'}</div>
        </div>
      `;
    })
    .join('');
}

async function loadNotifications() {
  const unread = el('unreadOnly').checked;
  const data = await api(`/notifications${unread ? '?unread=true' : ''}`);
  const box = el('notifList');
  const list = data.notifications || [];
  if (!list.length) {
    box.innerHTML = '<p class="empty">No notifications.</p>';
    return;
  }

  box.innerHTML = list
    .map((n) => {
      return `
        <div class="card" data-id="${n.id}">
          <strong>${escapeHtml(n.type || 'alert')}</strong>
          ${n.read_at ? '' : ' · unread'}
          <div class="meta">${escapeHtml(n.message || '')}</div>
          ${
            n.read_at
              ? ''
              : '<div class="actions"><button type="button" class="secondary mark-read">Mark read</button></div>'
          }
        </div>
      `;
    })
    .join('');

  box.querySelectorAll('.mark-read').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.closest('.card').dataset.id;
      try {
        await api(`/notifications/${id}/read`, { method: 'PATCH' });
        setStatus('Marked read', 'ok');
        await loadNotifications();
      } catch (err) {
        setStatus(err.message, 'err');
      }
    };
  });
}

async function loadPatients() {
  const data = await api('/doctor/patients');
  const box = el('patientsList');
  const patients = data.patients || [];
  if (!patients.length) {
    box.innerHTML = '<p class="empty">No linked patients.</p>';
    return;
  }
  box.innerHTML = patients
    .map(
      (p) => `
      <div class="card">
        <strong>${escapeHtml(p.full_name)}</strong>
        <div class="meta">${escapeHtml(p.email)} · id: <code>${escapeHtml(p.id)}</code></div>
      </div>
    `
    )
    .join('');
}

function wireForms() {
  document.querySelectorAll('[data-auth-tab]').forEach((btn) => {
    btn.onclick = () => showAuth(btn.dataset.authTab);
  });

  document.querySelectorAll('#appTabs .tab').forEach((btn) => {
    btn.onclick = async () => {
      showView(btn.dataset.view);
      try {
        if (btn.dataset.view === 'pantry') await loadPantry();
        if (btn.dataset.view === 'meals') {
          await loadPantry();
          await loadMeals();
        }
        if (btn.dataset.view === 'notifications') await loadNotifications();
        if (btn.dataset.view === 'doctor') await loadPatients();
      } catch (err) {
        setStatus(err.message, 'err');
      }
    };
  });

  el('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: String(fd.get('email') || '').trim().toLowerCase(),
          password: fd.get('password'),
        }),
      });
      saveSession(data.token, data.user);
      setStatus(`Logged in as ${data.user.fullName}`, 'ok');
      renderShell();
      showView('pantry');
      await loadPantry();
    } catch (err) {
      setStatus(err.message, 'err');
    }
  };

  el('registerForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const password = fd.get('password');
    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fd.get('fullName'),
          email,
          password,
          role: fd.get('role'),
        }),
      });
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      saveSession(data.token, data.user);
      setStatus(`Account created — logged in as ${data.user.fullName}`, 'ok');
      renderShell();
      showView('pantry');
      await loadPantry();
    } catch (err) {
      setStatus(err.message, 'err');
    }
  };

  el('addPantryForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/pantry', {
        method: 'POST',
        body: JSON.stringify({
          productName: fd.get('productName'),
          initialQuantity: Number(fd.get('initialQuantity')),
          baseUnit: fd.get('baseUnit'),
          expirationDate: fd.get('expirationDate') || null,
          source: 'manual',
        }),
      });
      e.target.reset();
      setStatus('Pantry item added', 'ok');
      await loadPantry();
    } catch (err) {
      setStatus(err.message, 'err');
    }
  };

  el('checkExpiringBtn').onclick = async () => {
    try {
      const data = await api('/pantry/check-expiring', { method: 'POST' });
      setStatus(`Expiry scan done — flagged ${data.itemsFlagged}`, 'ok');
      await loadNotifications();
    } catch (err) {
      setStatus(err.message, 'err');
    }
  };

  el('refreshPantryBtn').onclick = () => loadPantry().catch((err) => setStatus(err.message, 'err'));
  el('refreshMealsBtn').onclick = () => loadMeals().catch((err) => setStatus(err.message, 'err'));
  el('refreshNotifsBtn').onclick = () =>
    loadNotifications().catch((err) => setStatus(err.message, 'err'));
  el('unreadOnly').onchange = () =>
    loadNotifications().catch((err) => setStatus(err.message, 'err'));
  el('refreshPatientsBtn').onclick = () =>
    loadPatients().catch((err) => setStatus(err.message, 'err'));

  el('mealForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const pantryItemId = fd.get('pantryItemId') || null;
    const label = fd.get('label');
    try {
      await api('/meals', {
        method: 'POST',
        body: JSON.stringify({
          notes: fd.get('notes') || null,
          items: [
            {
              pantryItemId,
              label,
              quantityUsed: Number(fd.get('quantityUsed')),
              unit: fd.get('unit'),
            },
          ],
        }),
      });
      e.target.reset();
      setStatus('Meal logged', 'ok');
      await loadPantry();
      await loadMeals();
      await loadNotifications().catch(() => {});
    } catch (err) {
      setStatus(err.message, 'err');
    }
  };

  el('mealPantrySelect').onchange = (e) => {
    const item = state.pantry.find((p) => p.id === e.target.value);
    if (item) {
      el('mealForm').label.value = item.product_name;
      el('mealForm').unit.value = item.base_unit;
    }
  };

  el('linkPatientForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/doctor/link-patient', {
        method: 'POST',
        body: JSON.stringify({ patientId: fd.get('patientId') }),
      });
      setStatus('Patient linked', 'ok');
      await loadPatients();
    } catch (err) {
      setStatus(err.message, 'err');
    }
  };

  el('targetForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      patientId: fd.get('patientId'),
      nutrient: fd.get('nutrient'),
    };
    if (fd.get('minValue') !== '') body.minValue = Number(fd.get('minValue'));
    if (fd.get('maxValue') !== '') body.maxValue = Number(fd.get('maxValue'));
    try {
      await api('/doctor/nutrition-targets', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setStatus('Target saved', 'ok');
    } catch (err) {
      setStatus(err.message, 'err');
    }
  };

  el('checkNutritionForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = await api('/doctor/check-nutrition', {
        method: 'POST',
        body: JSON.stringify({
          patientId: fd.get('patientId'),
          nutrient: fd.get('nutrient'),
          value: Number(fd.get('value')),
        }),
      });
      setStatus(data.flagged ? 'Out of range — notification created' : 'Within range', 'ok');
      await loadNotifications().catch(() => {});
    } catch (err) {
      setStatus(err.message, 'err');
    }
  };
}

async function boot() {
  wireForms();
  renderShell();
  if (state.token && state.user) {
    showView('pantry');
    try {
      await loadPantry();
      setStatus(`Welcome back, ${state.user.fullName}`, 'ok');
    } catch (err) {
      clearSession();
      renderShell();
      setStatus('Session expired — please log in again', 'err');
    }
  }
}

boot();
