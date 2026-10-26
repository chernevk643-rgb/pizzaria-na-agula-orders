// Applies the owner's edits (price, description, availability) from the admin
// panel on top of the static menu. The server re-checks everything on order.
(function () {
  const fmt = (n) => Number(n).toFixed(2) + ' €';

  function applyToCard(btn, ov) {
    const card = btn.closest('.card, .combo-card');
    if (!card) return;
    if (ov.name !== undefined) {
      const h3 = card.querySelector('h3');
      const origName = btn.dataset.name || '';
      const origTitle = h3 ? h3.textContent.trim() : origName;
      const suffix = origName.startsWith(origTitle) ? origName.slice(origTitle.length) : '';
      btn.dataset.name = ov.name;
      if (h3) h3.textContent = suffix && ov.name.endsWith(suffix) ? ov.name.slice(0, -suffix.length) : ov.name;
    }
    if (ov.image) {
      const url = '/.netlify/functions/product-image?k=' + encodeURIComponent(ov.image);
      const im = card.querySelector('img');
      if (im) im.src = url;
      btn.dataset.img = url;
    }
    if (ov.price !== undefined) {
      btn.dataset.price = String(ov.price);
      const priceEl = card.querySelector('.price');
      if (priceEl) priceEl.textContent = fmt(ov.price);
    }
    if (ov.description !== undefined) {
      let el = card.querySelector('.desc') || card.querySelector('.combo-body p');
      if (!el) {
        el = document.createElement('p');
        el.className = 'desc';
        (card.querySelector('.card-body') || card).appendChild(el);
      }
      el.textContent = ov.description;
      el.hidden = ov.description === '';
    }
    if (ov.available === false) {
      card.classList.add('sold-out');
      btn.disabled = true;
      btn.textContent = 'Изчерпано';
    }
  }

  fetch('/.netlify/functions/get-catalog')
    .then(r => r.ok ? r.json() : { overrides: {} })
    .then(({ overrides }) => {
      document.querySelectorAll('.btn-cart[data-id]').forEach(btn => {
        const ov = overrides[btn.dataset.id];
        if (ov) applyToCard(btn, ov);
      });
    })
    .catch(() => {});
})();
