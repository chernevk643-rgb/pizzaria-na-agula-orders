const { listOrders } = require('./_orders-store.js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const key = event.headers && (event.headers['x-dashboard-key'] || event.headers['X-Dashboard-Key']);
  if (!process.env.ORDERS_DASHBOARD_KEY || key !== process.env.ORDERS_DASHBOARD_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Невалиден или липсващ ключ.' }) };
  }

  try {
    const orders = await listOrders(150);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders })
    };
  } catch (err) {
    console.error('list-orders error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Грешка при зареждане на поръчките.' }) };
  }
};
