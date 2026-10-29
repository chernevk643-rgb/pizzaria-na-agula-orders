const DASHBOARD_KEY_STORAGE = 'naugula_dashboard_key';
const SOUND_PREF_STORAGE = 'naugula_dashboard_sound';
const POLL_MS = 6000;
const FETCH_TIMEOUT_MS = 12000;
const RELOAD_AFTER_MS = 4 * 60 * 1000; // no successful refresh this long while visible -> reload the page

let currentKey = null;
let currentFilter = 'active';
let firstLoad = true;
let tickTimer = null;
let ticker = null;
let pollSeq = 0;
let lastPollAt = 0;
let lastOk = Date.now();
let wakeLock = null;

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

// Loud alarm: two stacked oscillators (square + saw) through a compressor so it
// stays as loud as the device allows without clipping, ~2.4s per ring.
function ringOnce() {
  if (localStorage.getItem(SOUND_PREF_STORAGE) === 'off') return;
  try {
    const ctx = getAudioCtx();
    if (ctx.state !== 'running') ctx.resume();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 12;
    comp.connect(ctx.destination);
    const pattern = [988, 740, 988, 740, 988, 740, 988, 740];
    pattern.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.3;
      [['square', freq, 0.8], ['sawtooth', freq * 2, 0.5]].forEach(([type, f, peak]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(peak, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        osc.connect(gain).connect(comp);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    });
  } catch (e) { /* audio not available, ignore */ }
  if (navigator.vibrate) {
    try { navigator.vibrate([400, 150, 400, 150, 400]); } catch (e) { /* ignore */ }
  }
}

// The alarm keeps ringing (a ring every 3.2s) for as long as any order is still
// "Нова", i.e. until the kitchen presses "Приемам поръчката", so a missed
// first ring doesn't mean a missed order.
let alarmTimer = null;
function setAlarm(on) {
  document.body.classList.toggle('alarm', on);
  if (on && !alarmTimer) {
    ringOnce();
    alarmTimer = setInterval(ringOnce, 3200);
  } else if (!on && alarmTimer) {
    clearInterval(alarmTimer);
    alarmTimer = null;
  }
}

/* ===== API ===== */
async function fetchOrders(signal) {
  const res = await fetch('/.netlify/functions/list-orders?t=' + Date.now(), {
    headers: { 'x-dashboard-key': currentKey },
    cache: 'no-store',
    signal
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
  poll(true);
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
        ? `<div class="row-addons">${fmtChoicesHtml(i.choices)}</div>`
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

function fmtChoicesHtml(names) {
  const counts = new Map();
  names.forEach(n => counts.set(n, (counts.get(n) || 0) + 1));
  return [...counts].map(([n, c]) => escapeHtml(c > 1 ? n + ' ×' + c : n)).join(' · ');
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s || '';
  return div.innerHTML;
}

/* ===== Polling ===== */
async function poll(force) {
  if (!currentKey) return;
  const statusEl = document.getElementById('connStatus');
  const mine = ++pollSeq; // only the newest request may update the screen
  lastPollAt = Date.now();
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const orders = await fetchOrders(ctrl.signal);
    if (mine !== pollSeq) return;
    lastOk = Date.now();
    statusEl.classList.remove('offline');
    const upd = document.getElementById('lastUpdate');
    if (upd) upd.textContent = 'Обновено ' + new Date().toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setAlarm(orders.some(o => o.status === 'new'));
    firstLoad = false;
    renderOrders(orders);
  } catch (err) {
    if (mine !== pollSeq) return;
    if (err.message === 'unauthorized') {
      lock();
      return;
    }
    statusEl.classList.add('offline');
  } finally {
    clearTimeout(timeout);
  }
}

// Called every few seconds from a Web Worker (not throttled like page timers)
// and from a normal interval as a backup.
function tick() {
  if (!currentKey) return;
  const now = Date.now();
  if (now - lastPollAt >= POLL_MS - 500) poll();
  if (now - lastOk > 20000) document.getElementById('connStatus').classList.add('offline');
  if (!document.hidden && now - lastOk > RELOAD_AFTER_MS) location.reload();
}

async function keepAwake() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (e) { /* not supported or denied */ }
}

/* ===== Gate / auth ===== */
function unlock(key) {
  currentKey = key;
  localStorage.setItem(DASHBOARD_KEY_STORAGE, key);
  document.getElementById('ordersGate').hidden = true;
  document.getElementById('ordersMain').hidden = false;
  firstLoad = true;
  lastOk = Date.now();
  poll(true);
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(tick, 4000);
  if (!ticker && window.Worker) {
    try {
      ticker = new Worker('js/orders-ticker.js');
      ticker.onmessage = tick;
    } catch (e) { ticker = null; }
  }
  keepAwake();

  // Auto-login has no click, so audio can't be unlocked yet; the banner asks
  // for one tap (any tap on the page also unlocks it, see below).
  const unlockBtn = document.getElementById('soundUnlockBtn');
  if (unlockBtn) unlockBtn.hidden = !!keepAliveNode || localStorage.getItem(SOUND_PREF_STORAGE) === 'off';
}

function lock() {
  currentKey = null;
  localStorage.removeItem(DASHBOARD_KEY_STORAGE);
  if (tickTimer) clearInterval(tickTimer);
  setAlarm(false);
  document.getElementById('ordersGate').hidden = false;
  document.getElementById('ordersMain').hidden = true;
  document.getElementById('gateKeyInput').value = '';
}

async function tryKey(key) {
  const errEl = document.getElementById('gateError');
  errEl.hidden = true;
  try {
    const res = await fetch('/.netlify/functions/list-orders', { headers: { 'x-dashboard-key': key }, cache: 'no-store' });
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
  // A bookmarked link like orders.html#key=PAROLA signs in without typing a
  // password (the part after # is never sent to the server).
  const fromLink = /[#&]key=([^&]+)/.exec(location.hash);
  if (fromLink) {
    const k = decodeURIComponent(fromLink[1]);
    history.replaceState(null, '', location.pathname);
    unlock(k);
  } else {
    const savedKey = localStorage.getItem(DASHBOARD_KEY_STORAGE);
    // Saved key: go straight in; a wrong/changed key is caught by the first poll (401).
    if (savedKey) unlock(savedKey);
  }

  // Any first tap/click on the page unlocks sound (browsers block audio until then).
  const firstGesture = () => {
    startAudioKeepAlive();
    keepAwake();
    const b = document.getElementById('soundUnlockBtn');
    if (b) b.hidden = true;
  };
  document.addEventListener('pointerdown', firstGesture, { once: true });
  document.addEventListener('keydown', firstGesture, { once: true });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { keepAwake(); poll(true); }
  });
  window.addEventListener('online', () => poll(true));
  window.addEventListener('focus', () => poll());

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
      poll(true);
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
    ringOnce();
    if (wasOff) localStorage.setItem(SOUND_PREF_STORAGE, 'off');
  });

  document.getElementById('ordersList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    setStatus(btn.dataset.id, btn.dataset.status);
  });
});
