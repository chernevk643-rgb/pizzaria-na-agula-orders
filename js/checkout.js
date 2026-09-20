function fmt(n) { return n.toFixed(2) + '€'; }

function renderSummary() {
  const cart = getCart();
  const itemsEl = document.getElementById('summaryItems');
  const subtotalEl = document.getElementById('sumSubtotal');
  const totalEl = document.getElementById('sumTotal');

  if (cart.length === 0) {
    window.location.href = 'index.html';
    return;
  }

  itemsEl.innerHTML = cart.map(i => {
    const detail = (i.choices || []).map((c, n) => `Пица ${n + 1}: ${c.name}`)
      .concat((i.addons || []).map(a => '+ ' + a.name));
    const addonsLine = detail.length
      ? `<small>${detail.join(', ')} · × ${i.qty}</small>`
      : `<small>× ${i.qty}</small>`;
    return `
    <div class="summary-item">
      <span>${i.name}${addonsLine}</span>
      <span>${fmt(lineUnitPrice(i) * i.qty)}</span>
    </div>
  `;
  }).join('');

  const total = cartTotal();
  subtotalEl.textContent = fmt(total);
  totalEl.textContent = fmt(total);
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function isValidPhone(v) {
  return /^[0-9+ ()-]{6,20}$/.test(v);
}

function showError(msg) {
  const el = document.getElementById('checkoutError');
  el.textContent = msg;
  el.classList.add('show');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function hideError() {
  document.getElementById('checkoutError').classList.remove('show');
}

function encodeFormData(data) {
  return Object.keys(data)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
    .join('&');
}

document.addEventListener('DOMContentLoaded', () => {
  renderSummary();

  const form = document.getElementById('checkoutForm');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const cart = getCart();
    if (cart.length === 0) {
      showError('Количката е празна.');
      return;
    }

    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();
    const address = document.getElementById('address').value.trim();
    const notes = document.getElementById('notes').value.trim();
    const payment = form.querySelector('input[name="payment"]:checked').value;
    const consent = document.getElementById('consentTerms').checked;

    if (name.length < 2) return showError('Моля, въведете вашето име.');
    if (!isValidPhone(phone)) return showError('Моля, въведете валиден телефонен номер.');
    if (!isValidEmail(email)) return showError('Моля, въведете валиден имейл адрес.');
    if (address.length < 5) return showError('Моля, въведете адрес за доставка.');
    if (!consent) return showError('Моля, приемете Общите условия и Политиката за поверителност, за да продължите.');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Изпращане...';

    try {
      if (payment === 'card') {
        const res = await fetch('/.netlify/functions/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map(i => ({ id: i.id, qty: i.qty, addons: (i.addons || []).map(a => a.key), choices: (i.choices || []).map(c => c.key) })),
            customer: { name, phone, email, address, notes }
          })
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          showError(data.error || 'Възникна грешка при стартиране на плащането.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Завърши поръчката';
          return;
        }
        // Cart is cleared on the success page once Stripe confirms redirect back.
        window.location.href = data.url;
      } else {
        const res = await fetch('/.netlify/functions/submit-cash-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map(i => ({ id: i.id, qty: i.qty, addons: (i.addons || []).map(a => a.key), choices: (i.choices || []).map(c => c.key) })),
            customer: { name, phone, email, address, notes }
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showError(data.error || 'Възникна грешка при записване на поръчката.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Завърши поръчката';
          return;
        }

        // Best-effort: also submit to Netlify Forms so an email notification
        // can be enabled later with zero extra code. Never blocks the order.
        const orderItems = cart.map(i => {
          const extraTxt = (i.choices || []).map(c => c.name).concat((i.addons || []).map(a => a.name));
          const addonsTxt = extraTxt.length ? ` (${extraTxt.join(', ')})` : '';
          return `${i.name}${addonsTxt} × ${i.qty} — ${fmt(lineUnitPrice(i) * i.qty)}`;
        }).join('\n');
        fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: encodeFormData({
            'form-name': 'cash-order',
            name, phone, email, address, notes,
            order_items: orderItems,
            total: fmt(cartTotal())
          })
        }).catch(() => {});

        clearCart();
        window.location.href = 'success.html?method=cash&id=' + encodeURIComponent(data.id);
      }
    } catch (err) {
      showError('Възникна мрежова грешка. Проверете връзката си и опитайте отново.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Завърши поръчката';
    }
  });
});
