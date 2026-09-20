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
  return { new: 'Нова', seen: 'Видяна', preparing: 'Приготвя се', ready: 'Готова', picked_up: 'Взета от доставчик' }[s] || s;
}
function payLabel(p) {
  return p === 'card' ? '💳 Карта' : '💵 В брой';
}

/* ===== Sound ===== */
let audioCtx = null;
let keepAliveNode = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// Chrome/Safari auto-suspend an AudioContext after ~30s of silence to save
// battery, and iOS Safari in particular often refuses ctx.resume() unless
// it's called synchronously inside a real tap/click — a timer-driven alert
// (our poll loop) doesn't qualify, so resume() can silently never resolve.
// The reliable fix is to never let the context go idle in the first place:
// keep an inaudible (gain ~0) oscillator running continuously from the
// moment the dashboard is unlocked (a real click) until the tab is closed.
function startAudioKeepAlive() {
  if (keepAliveNode) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.00001; // inaudible, but keeps the audio graph "active"
    osc.frequency.value = 20; // sub-bass, effectively silent even if it leaked
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    keepAliveNode = osc;
  } catch (e) { /* ignore */ }
}

// Loud, alarm-like pattern (square wave cuts through kitchen noise far better
// than a soft sine chime) plus a vibration pulse for phones/tablets.
async function beep() {
  if (localStorage.getItem(SOUND_PREF_STORAGE) === 'off') return;
  try {
    const ctx = getAudioCtx();
    if (ctx.state !== 'running') {
      await ctx.resume();
    }
    const pattern = [988, 740, 988, 740, 988, 740];
    pattern.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.24;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  } catch (e) { /* audio not available, ignore */ }
  if (navigator.vibrate) {
    try { navigator.vibrate([350, 120, 350, 120, 350]); } catch (e) { /* ignore */ }
  }
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
    if (currentFilter === 'active') return o.status !== 'picked_up';
    if (currentFilter === 'done') return o.status === 'picked_up';
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = '<p class="orders-empty">Няма поръчки в тази категория.</p>';
    return;
  }

  listEl.innerHTML = filtered.map(o => {
    const itemsHtml = o.items.map(i => {
      const unitPrice = i.price + (i.addons || []).reduce((s, a) => s + a.price, 0);
      const choicesHtml = (i.choices || []).length
        ? `<div class="row-addons">${i.choices.map((c, n) => 'Пица ' + (n + 1) + ': ' + escapeHtml(c)).join(' · ')}</div>`
        : '';
      const addonsHtml = choicesHtml + ((i.addons || []).length
        ? `<div class="row-addons">${i.addons.map(a => '+ ' + escapeHtml(a.name)).join(', ')}</div>`
        : '');
      return `
      <div class="row-wrap">
        <div class="row"><span>${escapeHtml(i.name)} × ${i.qty}</span><span>${fmtEUR(unitPrice * i.qty)}</span></div>
        ${addonsHtml}
      </div>
    `;
    }).join('');

    const notesHtml = o.customer.notes
      ? `<div class="order-notes">📝 ${escapeHtml(o.customer.notes)}</div>`
      : '';

    let actions;
    if (o.status === 'picked_up') {
      actions = `<button data-id="${o.id}" data-status="preparing">Отвори отново</button>`;
    } else if (o.status === 'new' || o.status === 'seen') {
      actions = `<button data-id="${o.id}" data-status="preparing" class="primary">Приемам поръчката</button>`;
    } else if (o.status === 'preparing') {
      actions = `<button data-id="${o.id}" data-status="ready" class="primary">Готова е</button>`;
    } else {
      actions = `<button data-id="${o.id}" data-status="picked_up" class="primary">Взета от доставчик</button>`;
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

    const hasUnacknowledged = orders.some(o => o.status === 'new');
    if (!firstLoad && hasUnacknowledged) {
      // Keep alerting every poll cycle (not just once) until someone presses
      // "Приемам поръчката" — a kitchen can easily miss a single chime.
      beep();
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

  // If we got here via the auto-login path (saved password, page just
  // reloaded) there was no click involved, so audio was never unlocked —
  // show a banner asking for one tap. If unlock() ran from the actual login
  // click, keepAliveNode is already running and this stays hidden.
  const unlockBtn = document.getElementById('soundUnlockBtn');
  if (unlockBtn) unlockBtn.hidden = !!keepAliveNode || localStorage.getItem(SOUND_PREF_STORAGE) === 'off';
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

  document.getElementById('soundUnlockBtn').addEventListener('click', () => {
    startAudioKeepAlive();
    document.getElementById('soundUnlockBtn').hidden = true;
  });

  document.getElementById('gateSubmitBtn').addEventListener('click', () => {
    startAudioKeepAlive(); // prime audio inside a real click so later auto-alerts aren't blocked by autoplay rules
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

  document.getElementById('soundTestBtn').addEventListener('click', () => {
    startAudioKeepAlive();
    document.getElementById('soundUnlockBtn').hidden = true;
    const wasOff = localStorage.getItem(SOUND_PREF_STORAGE) === 'off';
    if (wasOff) localStorage.setItem(SOUND_PREF_STORAGE, 'on'); // test should play even if muted
    beep();
    if (wasOff) localStorage.setItem(SOUND_PREF_STORAGE, 'off');
  });

  document.getElementById('ordersList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    setStatus(btn.dataset.id, btn.dataset.status);
  });
});
