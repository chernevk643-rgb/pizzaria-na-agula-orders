// Validates a cash-on-delivery order, prices it server-side from the same
// trusted catalog used for card payments, and stores it for the kitchen
// dashboard (list-orders.js / orders.html).
const crypto = require('crypto');
const products = require('./products.json');
const addonGroups = require('./addons.json');
const { saveOrder } = require('./_orders-store.js');

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

  if (!name || name.length < 2) return { statusCode: 400, body: JSON.stringify({ error: 'Моля, въведете вашето име.' }) };
  if (!isValidPhone(phone)) return { statusCode: 400, body: JSON.stringify({ error: 'Моля, въведете валиден телефонен номер.' }) };
  if (!isValidEmail(email)) return { statusCode: 400, body: JSON.stringify({ error: 'Моля, въведете валиден имейл адрес.' }) };
  if (!address || address.length < 5) return { statusCode: 400, body: JSON.stringify({ error: 'Моля, въведете адрес за доставка.' }) };

  const lineItems = [];
  let total = 0;
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
      addons.push({ name: addon.name, price: addon.price });
    }

    // Combos: the customer picks which standard pizzas are inside. Each
    // chosen id must be a real 30см pizza in our own catalog.
    const requestedChoices = Array.isArray(it.choices) ? it.choices : [];
    const choices = [];
    if (product.pizzaChoices) {
      if (requestedChoices.length !== product.pizzaChoices) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Моля, изберете пиците за комбото.' }) };
      }
      if (new Set(requestedChoices).size !== requestedChoices.length) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Изберете две различни пици.' }) };
      }
      for (const cid of requestedChoices) {
        const pizza = typeof cid === 'string' && addonGroups.comboPizzas.includes(cid) ? products[cid] : null;
        if (!pizza) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Невалидна пица в комбото. Презаредете страницата.' }) };
        }
        choices.push(pizza.name);
      }
    } else if (requestedChoices.length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Невалидна заявка.' }) };
    }

    const unitPrice = product.price + addons.reduce((s, a) => s + a.price, 0);
    total += unitPrice * qty;
    lineItems.push({ name: product.name, price: product.price, addons, choices, qty });
  }

  const order = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    paymentMethod: 'cash',
    status: 'new',
    customer: { name, phone, email, address, notes },
    items: lineItems,
    total: Math.round(total * 100) / 100
  };

  try {
    await saveOrder(order);
    return { statusCode: 200, body: JSON.stringify({ ok: true, id: order.id }) };
  } catch (err) {
    console.error('submit-cash-order error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Поръчката не можа да бъде запазена. Опитайте отново или се обадете на 0895 069 669.' }) };
  }
};
