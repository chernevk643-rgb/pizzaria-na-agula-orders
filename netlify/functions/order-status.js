// Public endpoint so a customer can track their own order by its id
// (a UUID or Stripe session id — unguessable, so no extra auth needed).
// Deliberately returns only what the customer needs to see: status, items,
// total. Never returns phone/email/address, even though it's their own data,
// to keep the surface minimal in case a tracking link is ever forwarded.
const { getOrder } = require('./_orders-store.js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id || typeof id !== 'string' || id.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Невалиден номер на поръчка.' }) };
  }

  try {
    const order = await getOrder(id);
    if (!order) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Поръчката не е намерена.' }) };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        status: order.status,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        items: order.items,
        total: order.total
      })
    };
  } catch (err) {
    console.error('order-status error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Грешка при проверка на поръчката.' }) };
  }
};
