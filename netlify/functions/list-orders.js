const { listOrders } = require('./_orders-store.js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const key = event.headers && (event.headers['x-dashboard-key'] || event.headers['X-Dashboard-Key']);
  const expected = process.env.ORDERS_DASHBOARD_KEY;

  // TEMPORARY DIAGNOSTIC — logs only lengths/presence, never the actual secret values.
  console.log('DEBUG auth check:', {
    envVarIsSet: !!expected,
    envVarLength: expected ? expected.length : 0,
    receivedKeyPresent: !!key,
    receivedKeyLength: key ? key.length : 0,
    match: key === expected
  });

  if (!expected || key !== expected) {
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
