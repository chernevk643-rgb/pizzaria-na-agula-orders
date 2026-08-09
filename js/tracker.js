const TRACK_POLL_MS = 10000;
const ORDER_STAGES = [
  { key: 'new', label: 'Приета' },
  { key: 'preparing', label: 'Приготвя се' },
  { key: 'ready', label: 'Готова' },
  { key: 'picked_up', label: 'Взета от доставчик' }
];

function stageIndex(status) {
  if (status === 'seen') return 0; // staff opened it, but customer-facing stage is still "accepted"
  const idx = ORDER_STAGES.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
}

function renderTracker(container, status) {
  const idx = stageIndex(status);
  container.innerHTML = `
    <div class="tracker">
      ${ORDER_STAGES.map((s, i) => `
        <div class="tracker-step ${i < idx ? 'is-done' : ''} ${i === idx ? 'is-active' : ''}">
          <div class="tracker-dot">${i < idx ? '&#10003;' : i + 1}</div>
          <div class="tracker-label">${s.label}</div>
        </div>
        ${i < ORDER_STAGES.length - 1 ? `<div class="tracker-line ${i < idx ? 'is-done' : ''}"></div>` : ''}
      `).join('')}
    </div>
  `;
}

let trackTimer = null;

// Polls order-status.js for one order and re-renders the stepper into
// `container` every TRACK_POLL_MS. Stops automatically once the order is done.
function startTracking(id, container, onUpdate) {
  async function tick() {
    try {
      const res = await fetch('/.netlify/functions/order-status?id=' + encodeURIComponent(id));
      if (!res.ok) return;
      const data = await res.json();
      renderTracker(container, data.status);
      if (onUpdate) onUpdate(data);
      if (data.status === 'picked_up' && trackTimer) {
        clearInterval(trackTimer);
        trackTimer = null;
      }
    } catch (e) { /* transient network error, try again next tick */ }
  }
  tick();
  if (trackTimer) clearInterval(trackTimer);
  trackTimer = setInterval(tick, TRACK_POLL_MS);
}
