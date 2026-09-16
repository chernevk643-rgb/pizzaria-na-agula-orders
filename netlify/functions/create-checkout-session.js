// Netlify serverless function — creates a Stripe Checkout Session.
// SECURITY: prices are NEVER trusted from the client. Every line item price
// is looked up server-side from products.json, keyed by product id only.
const Stripe = require('stripe');
const products = require('./products.json');
const addonGroups = require('./addons.json');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const MAX_QTY_PER_ITEM = 20;
const MAX_LINE_ITEMS = 60;

function isValidEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
}
function isValidPhone(v) {
  return typeof v === 'string' && /^[0-9+ ()-]{6,20}$/.test(v);
}
function cleanText(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/[<>]/g, '').trim().slice(0, max);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Невалидна заявка.' }) };
  }

  const { items, customer } = payload;

  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINE_ITEMS) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Количката е празна или невалидна.' }) };
  }

  if (!customer || typeof customer !== 'object') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Липсват данни за клиента.' }) };
  }

  const name = cleanText(customer.name, 100);
  const phone = cleanText(customer.phone, 30);
  const email = cleanText(customer.email, 254);
  const address = cleanText(customer.address, 250);
  const notes = cleanText(customer.notes, 400);

  if (!name || name.length < 2) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Моля, въведете вашето име.' }) };
  }
  if (!isValidPhone(phone)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Моля, въведете валиден телефонен номер.' }) };
  }
  if (!isValidEmail(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Моля, въведете валиден имейл адрес.' }) };
  }
  if (!address || address.length < 5) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Моля, въведете адрес за доставка.' }) };
  }

  const line_items = [];
  for (const it of items) {
    const id = typeof it.id === 'string' ? it.id : '';
    const qty = Number.isInteger(it.qty) ? it.qty : 0;
    const product = products[id];
    if (!product || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Артикул от количката вече не е наличен. Презаредете страницата.' }) };
    }

    // Add-ons are only valid if the product declares a matching group, and
    // every requested add-on key must exist in that group — prices always
    // come from our own catalog, never from the client.
    const group = product.addonGroup ? addonGroups[product.addonGroup] : null;
    const requestedAddons = Array.isArray(it.addons) ? it.addons : [];
    const addons = [];
    for (const key of requestedAddons) {
      const addon = group && typeof key === 'string' ? group[key] : null;
      if (!addon) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Невалидна добавка. Презаредете страницата.' }) };
      }
      addons.push(addon);
    }

    const unitPrice = product.price + addons.reduce((s, a) => s + a.price, 0);
    const name = addons.length ? `${product.name} (${addons.map(a => a.name).join(', ')})` : product.name;
    line_items.push({
      price_data: {
        currency: 'eur',
        product_data: { name },
        unit_amount: Math.round(unitPrice * 100)
      },
      quantity: qty
    });
  }

  const host = event.headers && (event.headers.host || event.headers.Host);
  const siteUrl = process.env.URL || (host ? `https://${host}` : null);
  if (!siteUrl) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Конфигурационна грешка на сървъра.' }) };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: email,
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancel.html`,
      metadata: {
        customer_name: name,
        customer_phone: phone,
        delivery_address: address,
        order_notes: notes
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    // Never leak internal error details (e.g. Stripe key issues) to the client.
    console.error('Stripe session error:', err.message);
    return { statusCode: 502, body: JSON.stringify({ error: 'Плащането не може да бъде стартирано в момента. Опитайте по-късно или изберете плащане в брой.' }) };
  }
};
