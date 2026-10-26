// Owner-editable overrides (name / price / description / availability / photo)
// kept in Netlify Blobs on top of the base catalog in products.json.
const { getStore } = require('@netlify/blobs');
const products = require('./products.json');

function open(name) {
  const opts = { name, consistency: 'strong' };
  if (process.env.NETLIFY_BLOBS_TOKEN) {
    opts.siteID = process.env.SITE_ID;
    opts.token = process.env.NETLIFY_BLOBS_TOKEN;
  }
  return getStore(opts);
}
const store = () => open('catalog');
const imageStore = () => open('catalog-images');

const MAX_IMAGE_BYTES = 1500000;
const IMAGE_KEY_RE = /^[a-z0-9-]{1,80}-\d{10,16}$/;

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
  if (patch.name !== undefined) {
    if (typeof patch.name !== 'string') throw new Error('Невалидно заглавие.');
    const n = patch.name.replace(/[<>]/g, '').trim().slice(0, 80);
    if (!n) throw new Error('Невалидно заглавие.');
    out.name = n;
  }
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

function decodeJpeg(dataUrl) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw new Error('Невалидна снимка. Използвайте JPG или PNG.');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > MAX_IMAGE_BYTES) throw new Error('Снимката е твърде голяма.');
  if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) throw new Error('Невалидна снимка. Използвайте JPG или PNG.');
  return buf;
}

// patch: price/description/available/name. opts: { imageData, keepImage }.
async function saveOverride(id, patch, opts = {}) {
  if (!Object.prototype.hasOwnProperty.call(products, id)) throw new Error('Непознат артикул.');
  const s = store();
  const imgs = imageStore();
  const all = (await s.get('overrides', { type: 'json' })) || {};
  const existing = all[id] || {};
  const next = clean(patch);

  let newKey = null;
  if (opts.imageData) {
    const buf = decodeJpeg(opts.imageData);
    newKey = `${id}-${Date.now()}`;
    await imgs.set(newKey, buf);
    next.image = newKey;
  } else if (opts.keepImage && existing.image) {
    next.image = existing.image;
  }

  if (Object.keys(next).length) all[id] = next; else delete all[id];
  await s.setJSON('overrides', all);

  if (existing.image && existing.image !== next.image) {
    try { await imgs.delete(existing.image); } catch (e) { /* best effort */ }
  }
  return all;
}

async function getImage(key) {
  if (!IMAGE_KEY_RE.test(key || '')) return null;
  return imageStore().get(key, { type: 'arrayBuffer' });
}

module.exports = { getOverrides, getOverridesSafe, saveOverride, getImage };
