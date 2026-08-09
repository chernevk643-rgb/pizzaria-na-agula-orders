// Shared helper for reading/writing orders in Netlify Blobs.
const { getStore } = require('@netlify/blobs');

function store() {
  // Zero-config auto-detection doesn't work reliably on every Netlify account/plan,
  // so fall back to explicit siteID + token when provided via env vars.
  const opts = { name: 'orders', consistency: 'strong' };
  if (process.env.NETLIFY_BLOBS_TOKEN) {
    opts.siteID = process.env.SITE_ID;
    opts.token = process.env.NETLIFY_BLOBS_TOKEN;
  }
  return getStore(opts);
}

async function getOrder(id) {
  return store().get(id, { type: 'json' });
}

async function saveOrder(order) {
  const s = store();
  await s.setJSON(order.id, order);
  // Maintain a small index of order ids, newest first, capped to last 300.
  const index = (await s.get('_index', { type: 'json' })) || [];
  const next = [order.id, ...index.filter(id => id !== order.id)].slice(0, 300);
  await s.setJSON('_index', next);
}

async function listOrders(limit = 100) {
  const s = store();
  const index = (await s.get('_index', { type: 'json' })) || [];
  const ids = index.slice(0, limit);
  const orders = await Promise.all(ids.map(id => s.get(id, { type: 'json' })));
  return orders.filter(Boolean);
}

async function updateOrderStatus(id, status) {
  const s = store();
  const order = await s.get(id, { type: 'json' });
  if (!order) return null;
  order.status = status;
  order.statusUpdatedAt = new Date().toISOString();
  await s.setJSON(id, order);
  return order;
}

module.exports = { saveOrder, listOrders, updateOrderStatus, getOrder };
