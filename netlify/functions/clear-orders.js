// Wipes every stored order from Netlify Blobs. Protected by the same
// dashboard password used for orders.html, plus an explicit confirm flag
// so it can never be triggered by an accidental GET/click.
const { clearAllOrders } = require('./_orders-store.js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const key = event.headers && (event.headers['x-dashboard-key'] || event.headers['X-Dashboard-Key']);
  if (!process.env.ORDERS_DASHBOARD_KEY || key !== process.env.ORDERS_DASHBOARD_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Невалиден или липсващ ключ.' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    payload = {};
  }
  if (payload.confirm !== 'DELETE_ALL_ORDERS') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Липсва потвърждение.' }) };
  }

  try {
    const count = await clearAllOrders();
    return { statusCode: 200, body: JSON.stringify({ ok: true, deleted: count }) };
  } catch (err) {
    console.error('clear-orders error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Грешка при изчистване.' }) };
  }
};
