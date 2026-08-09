const { updateOrderStatus } = require('./_orders-store.js');

const ALLOWED_STATUSES = ['new', 'seen', 'preparing', 'baking', 'done'];

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
    return { statusCode: 400, body: JSON.stringify({ error: 'Невалидна заявка.' }) };
  }

  const { id, status } = payload;
  if (typeof id !== 'string' || !id || !ALLOWED_STATUSES.includes(status)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Невалидни данни.' }) };
  }

  try {
    const order = await updateOrderStatus(id, status);
    if (!order) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Поръчката не е намерена.' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ order }) };
  } catch (err) {
    console.error('update-order-status error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Грешка при обновяване.' }) };
  }
};
