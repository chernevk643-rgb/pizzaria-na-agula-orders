async function initSuccessPage() {
  const params = new URLSearchParams(window.location.search);
  const method = params.get('method');
  const sessionId = params.get('session_id');
  const cashId = params.get('id');
  const titleEl = document.getElementById('statusTitle');
  const bodyEl = document.getElementById('statusBody');
  const trackerEl = document.getElementById('trackerContainer');

  if (method === 'cash') {
    titleEl.textContent = 'Поръчката е приета!';
    bodyEl.innerHTML = `
      <p><strong>Благодарим ви!</strong> Поръчката ви е получена и ще бъде платена в брой на куриера при доставка.</p>
      <p>Ще се свържем с вас на посочения телефон, ако е необходимо да уточним детайли по доставката.</p>
      <p><a href="index.html" class="btn btn-primary">Обратно към сайта</a></p>
    `;
    if (cashId && trackerEl) startTracking(cashId, trackerEl);
    return;
  }

  if (sessionId) {
    try {
      const res = await fetch('/.netlify/functions/verify-session?session_id=' + encodeURIComponent(sessionId));
      const data = await res.json();
      if (res.ok && data.paid) {
        clearCart();
        titleEl.textContent = 'Плащането е успешно!';
        const amount = (data.amount_total / 100).toFixed(2);
        const currencySymbol = (data.currency || 'eur').toUpperCase() === 'EUR' ? '€' : data.currency;
        bodyEl.innerHTML = `
          <p><strong>Благодарим ви за поръчката!</strong> Плащането от ${amount}${currencySymbol} беше успешно обработено от Stripe.</p>
          <p>Потвърждение е изпратено на вашия имейл. Пицарията вече подготвя поръчката ви.</p>
          <p><a href="index.html" class="btn btn-primary">Обратно към сайта</a></p>
        `;
        if (data.id && trackerEl) startTracking(data.id, trackerEl);
      } else {
        titleEl.textContent = 'Плащането не е потвърдено';
        bodyEl.innerHTML = `
          <p>Не успяхме да потвърдим плащането. Ако сте въвели данни на картата, но виждате тази страница, моля свържете се с нас на <a href="tel:+359895069669">0895 069 669</a>, преди да опитвате отново.</p>
          <p><a href="checkout.html" class="btn btn-primary">Обратно към плащане</a></p>
        `;
      }
    } catch (e) {
      titleEl.textContent = 'Грешка при проверка';
      bodyEl.innerHTML = `<p>Не можахме да проверим статуса на плащането. Моля, свържете се с нас на <a href="tel:+359895069669">0895 069 669</a>.</p>`;
    }
    return;
  }

  window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', initSuccessPage);
