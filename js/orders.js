const DASHBOARD_KEY_STORAGE = 'naugula_dashboard_key';
const SOUND_PREF_STORAGE = 'naugula_dashboard_sound';
const POLL_MS = 8000;

let currentKey = null;
let currentFilter = 'active';
let knownIds = new Set();
let firstLoad = true;
let pollTimer = null;

function fmtEUR(n) { return n.toFixed(2) + '€'; }

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('bg-BG', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function statusLabel(s) {
  return { new: 'Нова', seen: 'Видяна', preparing: 'Приготвя се', done: 'Готова' }[s] || s;
}
function payLabel(p) {
  return p === 'card' ? '💳 Карта' : '💵 В брой';
}

/* ===== Sound ===== */
function beep() {
  if (localStorage.getItem(SOUND_PREF_STORAGE) === 'off') return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.35);
    });
  } catch (e) { /* audio not available, ignore */ }
}

/* ===== API ===== */
async function fetchOrders() {
  const res = await fetch('/.netlify/functions/list-orders', {
    headers: { 'x-dashboard-key': currentKey }
  });
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error('server');
  const data = await res.json();
  return data.orders || [];
}

async function setStatus(id, status) {
  await fetch('/.netlify/functions/update-order-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-dashboard-key': currentKey },
    body: JSON.stringify({ id, status })
  });
  poll();
}

/* ===== Render ===== */
function renderOrders(orders) {
  const listEl = document.getElementById('ordersList');
  const filtered = orders.filter(o => {
    if (currentFilter === 'active') return o.status !== 'done';
    if (currentFilter === 'done') return o.status === 'done';
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = '<p class="orders-empty">Няма поръчки в тази категория.</p>';
    return;
  }

  listEl.innerHTML = filtered.map(o => {
    const itemsHtml = o.items.map(i => `
      <div class="row"><span>${i.name} × ${i.qty}</span><span>${fmtEUR(i.price * i.qty)}</span></div>
    `).join('');

    const notesHtml = o.customer.notes
      ? `<div class="order-notes">📝 ${escapeHtml(o.customer.notes)}</div>`
      : '';

    let actions;
    if (o.status === 'done') {
      actions = `<button data-id="${o.id}" data-status="preparing">Отвори отново</button>`;
    } else if (o.status === 'new') {
      actions = `<button data-id="${o.id}" data-status="preparing" class="primary">Приемам поръчката</button>`;
    } else {
      actions = `<button data-id="${o.id}" data-status="done" class="primary">Готова е</button>`;
    }

    return `
      <article class="order-card ${o.status === 'new' ? 'is-new' : ''}" data-id="${o.id}">
        <div class="order-card-top">
          <span class="order-badge status-${o.status}">${statusLabel(o.status)}</span>
          <span class="order-pay">${payLabel(o.paymentMethod)}</span>
          <span class="order-time">${fmtTime(o.createdAt)}</span>
        </div>
        <div class="order-card-body">
          <div class="order-customer">
            <strong>${escapeHtml(o.customer.name)}</strong>
            <a href="tel:${escapeHtml(o.customer.phone)}">${escapeHtml(o.customer.phone)}</a>
            <div class="addr">📍 ${escapeHtml(o.customer.address)}</div>
          </div>
          ${notesHtml}
          <div class="order-items">${itemsHtml}</div>
          <div class="order-total"><span>Общо</span><span>${fmtEUR(o.total)}</span></div>
          <div class="order-actions">${actions}</div>
        </div>
      </article>
    `;
  }).join('');
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s || '';
  return div.innerHTML;
}

/* ===== Polling ===== */
async function poll() {
  const statusEl = document.getElementById('connStatus');
  try {
    const orders = await fetchOrders();
    statusEl.classList.remove('offline');

    if (!firstLoad) {
      const newOnes = orders.filter(o => o.status === 'new' && !knownIds.has(o.id));
      if (newOnes.length > 0) beep();
    }
    firstLoad = false;
    knownIds = new Set(orders.map(o => o.id));

    renderOrders(orders);
  } catch (err) {
    if (err.message === 'unauthorized') {
      lock();
      return;
    }
    statusEl.classList.add('offline');
  }
}

/* ===== Gate / auth ===== */
function unlock(key) {
  currentKey = key;
  localStorage.setItem(DASHBOARD_KEY_STORAGE, key);
  document.getElementById('ordersGate').hidden = true;
  document.getElementById('ordersMain').hidden = false;
  firstLoad = true;
  poll();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, POLL_MS);
}

function lock() {
  currentKey = null;
  localStorage.removeItem(DASHBOARD_KEY_STORAGE);
  if (pollTimer) clearInterval(pollTimer);
  document.getElementById('ordersGate').hidden = false;
  document.getElementById('ordersMain').hidden = true;
  document.getElementById('gateKeyInput').value = '';
}

async function tryKey(key) {
  const errEl = document.getElementById('gateError');
  errEl.hidden = true;
  try {
    const res = await fetch('/.netlify/functions/list-orders', { headers: { 'x-dashboard-key': key } });
    if (res.ok) {
      unlock(key);
    } else {
      errEl.hidden = false;
    }
  } catch (e) {
    errEl.hidden = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const savedKey = localStorage.getItem(DASHBOARD_KEY_STORAGE);
  if (savedKey) {
    tryKey(savedKey);
  }

  document.getElementById('gateSubmitBtn').addEventListener('click', () => {
    const val = document.getElementById('gateKeyInput').value.trim();
    if (val) tryKey(val);
  });
  document.getElementById('gateKeyInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('gateSubmitBtn').click();
  });
  document.getElementById('lockBtn').addEventListener('click', lock);

  document.querySelectorAll('.orders-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.orders-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      poll();
    });
  });

  const soundBtn = document.getElementById('soundToggle');
  function refreshSoundLabel() {
    const off = localStorage.getItem(SOUND_PREF_STORAGE) === 'off';
    soundBtn.textContent = off ? '🔕 Звук: изключен' : '🔔 Звук: включен';
  }
  refreshSoundLabel();
  soundBtn.addEventListener('click', () => {
    const off = localStorage.getItem(SOUND_PREF_STORAGE) === 'off';
    localStorage.setItem(SOUND_PREF_STORAGE, off ? 'on' : 'off');
    refreshSoundLabel();
  });

  document.getElementById('ordersList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    setStatus(btn.dataset.id, btn.dataset.status);
  });
});
