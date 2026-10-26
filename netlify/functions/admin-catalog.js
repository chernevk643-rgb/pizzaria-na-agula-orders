// Owner-only: read and change price / description / availability of menu items.
const crypto = require('crypto');
const { getOverrides, saveOverride } = require('./_catalog-store.js');

function authorized(event) {
  const expected = process.env.ADMIN_KEY || process.env.ORDERS_DASHBOARD_KEY;
  const given = event.headers && (event.headers['x-admin-key'] || event.headers['X-Admin-Key']);
  if (!expected || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (!authorized(event)) {
    await new Promise(r => setTimeout(r, 800));
    return json(401, { error: 'Невалидна парола.' });
  }

  try {
    if (event.httpMethod === 'GET') {
      return json(200, { overrides: await getOverrides() });
    }
    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Невалидна заявка.' }); }
      if (typeof body.id !== 'string') return json(400, { error: 'Липсва артикул.' });
      const patch = body.reset ? {} : { name: body.name, price: body.price, description: body.description, available: body.available };
      Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
      const opts = body.reset ? {} : { imageData: body.imageData, keepImage: body.keepImage === true };
      const overrides = await saveOverride(body.id, patch, opts);
      return json(200, { overrides });
    }
    return json(405, { error: 'Method Not Allowed' });
  } catch (err) {
    if (/Невалид|Непознат|твърде голяма/.test(err.message)) return json(400, { error: err.message });
    console.error('admin-catalog error:', err.message);
    return json(500, { error: 'Грешка при запис. Опитайте отново.' });
  }
};
