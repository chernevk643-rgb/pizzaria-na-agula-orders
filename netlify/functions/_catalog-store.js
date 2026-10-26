// Owner-editable overrides (price / description / availability) kept in
// Netlify Blobs on top of the base catalog in products.json.
const { getStore } = require('@netlify/blobs');
const products = require('./products.json');

function store() {
  const opts = { name: 'catalog', consistency: 'strong' };
  if (process.env.NETLIFY_BLOBS_TOKEN) {
    opts.siteID = process.env.SITE_ID;
    opts.token = process.env.NETLIFY_BLOBS_TOKEN;
  }
  return getStore(opts);
}

async function getOverrides() {
  return (await store().get('overrides', { type: 'json' })) || {};
}

// Order functions use this: a Blobs hiccup must never block orders, so fall
// back to the base catalog.
async function getOverridesSafe() {
  try {
    return await getOverrides();
  } catch (err) {
    console.error('catalog overrides unavailable, using base catalog:', err.message);
    return {};
  }
}

function clean(patch) {
  const out = {};
  if (patch.price !== undefined) {
    const p = Number(patch.price);
    if (!Number.isFinite(p) || p < 0 || p > 999) throw new Error('Невалидна цена.');
    out.price = Math.round(p * 100) / 100;
  }
  if (patch.description !== undefined) {
    if (typeof patch.description !== 'string') throw new Error('Невалидно описание.');
    out.description = patch.description.replace(/[<>]/g, '').trim().slice(0, 500);
  }
  if (patch.available !== undefined) {
    if (typeof patch.available !== 'boolean') throw new Error('Невалидна наличност.');
    out.available = patch.available;
  }
  return out;
}

async function saveOverride(id, patch) {
  if (!Object.prototype.hasOwnProperty.call(products, id)) throw new Error('Непознат артикул.');
  const s = store();
  const all = (await s.get('overrides', { type: 'json' })) || {};
  const next = clean(patch);
  if (Object.keys(next).length) all[id] = next; else delete all[id];
  await s.setJSON('overrides', all);
  return all;
}

module.exports = { getOverrides, getOverridesSafe, saveOverride };
