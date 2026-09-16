/* ===================== CART STATE ===================== */
const CART_KEY = 'naugula_cart_v1';

function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
}

// Two cart lines are the same product only if they also have the same
// addons — a Маргарита with bacon must stay a separate line from a plain
// Маргарита so the kitchen can see exactly what each one needs.
function itemKey(item) {
  const addonKey = (item.addons || []).map(a => a.key).sort().join(',');
  return item.id + '::' + addonKey;
}

function lineUnitPrice(item) {
  return item.price + (item.addons || []).reduce((s, a) => s + a.price, 0);
}

function addToCart(item) {
  const cart = getCart();
  const key = itemKey(item);
  const existing = cart.find(i => itemKey(i) === key);
  if (existing) {
    existing.qty += item.qty || 1;
  } else {
    cart.push({ ...item, qty: item.qty || 1 });
  }
  saveCart(cart);
  openCart();
}

function updateQty(id, delta) {
  const cart = getCart();
  const item = cart.find(i => itemKey(i) === id);
  if (!item) return;
  item.qty += delta;
  const next = item.qty <= 0 ? cart.filter(i => itemKey(i) !== id) : cart;
  saveCart(next);
}

function removeFromCart(id) {
  saveCart(getCart().filter(i => itemKey(i) !== id));
}

function clearCart() {
  saveCart([]);
}

function cartTotal() {
  return getCart().reduce((sum, i) => sum + lineUnitPrice(i) * i.qty, 0);
}

function cartCount() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}

function fmtEUR(n) {
  return n.toFixed(2) + '€';
}

/* ===================== RENDER ===================== */
function renderCart() {
  const count = cartCount();
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = count;
    el.hidden = count === 0;
  });

  const itemsEl = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');
  const checkoutBtn = document.getElementById('cartCheckoutBtn');
  if (!itemsEl) return; // this page has no drawer DOM (e.g. checkout.html uses its own renderer)

  const cart = getCart();
  if (cart.length === 0) {
    itemsEl.innerHTML = '<p class="cart-empty">Количката е празна.</p>';
    if (checkoutBtn) checkoutBtn.classList.add('disabled');
    if (totalEl) totalEl.textContent = fmtEUR(0);
    return;
  }
  if (checkoutBtn) checkoutBtn.classList.remove('disabled');

  itemsEl.innerHTML = cart.map(i => {
    const key = itemKey(i);
    const addonsHtml = (i.addons || []).length
      ? `<div class="cart-item-addons">${i.addons.map(a => `+ ${a.name}`).join(', ')}</div>`
      : '';
    return `
    <div class="cart-item" data-id="${key}">
      <img src="${i.img || 'assets/img/logo.png'}" alt="${i.name}">
      <div class="cart-item-info">
        <strong>${i.name}</strong>
        ${addonsHtml}
        <span class="cart-item-price">${fmtEUR(lineUnitPrice(i))}</span>
        <div class="qty-stepper">
          <button type="button" class="qty-btn" data-action="dec" data-id="${key}" aria-label="Намали">&minus;</button>
          <span>${i.qty}</span>
          <button type="button" class="qty-btn" data-action="inc" data-id="${key}" aria-label="Увеличи">&plus;</button>
        </div>
      </div>
      <button type="button" class="cart-item-remove" data-id="${key}" aria-label="Премахни">&times;</button>
    </div>
  `;
  }).join('');

  if (totalEl) totalEl.textContent = fmtEUR(cartTotal());
}

/* ===================== DRAWER ===================== */
function openCart() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (!drawer) return;
  drawer.classList.add('open');
  overlay.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (!drawer) return;
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

/* ===================== ADDON MODAL ===================== */
// Pizzas, hot dogs and sandwiches prompt for extras (same flow as the
// restaurant's Bolt Food listing) before the item is added to the cart.
let addonState = null;

function openAddonModal(btn) {
  const group = btn.dataset.addonGroup;
  const list = (typeof ADDON_GROUPS !== 'undefined' && ADDON_GROUPS[group]) || [];
  addonState = {
    id: btn.dataset.id,
    name: btn.dataset.name,
    price: parseFloat(btn.dataset.price),
    img: btn.dataset.img || '',
    group,
    selected: new Set()
  };

  document.getElementById('addonModalTitle').textContent = addonState.name;
  const listEl = document.getElementById('addonModalList');
  if (list.length === 0) {
    listEl.innerHTML = '<p class="addon-modal-empty">Няма налични добавки за този артикул.</p>';
  } else {
    listEl.innerHTML = list.map(a => `
      <label class="addon-row">
        <input type="checkbox" value="${a.key}">
        <span>${a.name}</span>
        <span class="addon-row-price">${a.price > 0 ? '+' + a.price.toFixed(2) + ' €' : 'безплатно'}</span>
      </label>
    `).join('');
  }
  document.getElementById('addonQtyVal').textContent = '1';
  addonState.qty = 1;
  updateAddonTotal();

  const overlay = document.getElementById('addonOverlay');
  const modal = document.getElementById('addonModal');
  overlay.classList.add('open');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeAddonModal() {
  const overlay = document.getElementById('addonOverlay');
  const modal = document.getElementById('addonModal');
  overlay.classList.remove('open');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  addonState = null;
}

function updateAddonTotal() {
  if (!addonState) return;
  const list = (typeof ADDON_GROUPS !== 'undefined' && ADDON_GROUPS[addonState.group]) || [];
  const addonsSum = [...addonState.selected].reduce((sum, key) => {
    const a = list.find(x => x.key === key);
    return sum + (a ? a.price : 0);
  }, 0);
  const unit = addonState.price + addonsSum;
  document.getElementById('addonTotalPrice').textContent = fmtEUR(unit * addonState.qty);
}

/* ===================== EVENTS ===================== */
document.addEventListener('DOMContentLoaded', () => {
  renderCart();

  // Add-to-cart buttons (event delegation, works for all injected buttons).
  // Items with an addon group open the customization modal instead of
  // adding straight away.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-cart');
    if (btn) {
      if (btn.dataset.addonGroup) {
        openAddonModal(btn);
        return;
      }
      const item = {
        id: btn.dataset.id,
        name: btn.dataset.name,
        price: parseFloat(btn.dataset.price),
        img: btn.dataset.img || ''
      };
      addToCart(item);
      btn.classList.add('added');
      setTimeout(() => btn.classList.remove('added'), 700);
      return;
    }

    const qtyBtn = e.target.closest('.qty-btn');
    if (qtyBtn && qtyBtn.closest('.cart-item')) {
      updateQty(qtyBtn.dataset.id, qtyBtn.dataset.action === 'inc' ? 1 : -1);
      return;
    }

    const removeBtn = e.target.closest('.cart-item-remove');
    if (removeBtn) {
      removeFromCart(removeBtn.dataset.id);
      return;
    }
  });

  const cartBtn = document.getElementById('cartBtn');
  const fabCartBtn = document.getElementById('fabCartBtn');
  const cartCloseBtn = document.getElementById('cartCloseBtn');
  const cartOverlay = document.getElementById('cartOverlay');
  if (cartBtn) cartBtn.addEventListener('click', openCart);
  if (fabCartBtn) fabCartBtn.addEventListener('click', openCart);
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCart);
  if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

  const checkoutBtn = document.getElementById('cartCheckoutBtn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', (e) => {
      if (getCart().length === 0) e.preventDefault();
    });
  }

  /* ===== Addon modal wiring ===== */
  const addonOverlay = document.getElementById('addonOverlay');
  const addonModalClose = document.getElementById('addonModalClose');
  const addonModalList = document.getElementById('addonModalList');
  const addonQtyDec = document.getElementById('addonQtyDec');
  const addonQtyInc = document.getElementById('addonQtyInc');
  const addonAddBtn = document.getElementById('addonAddBtn');

  if (addonOverlay) addonOverlay.addEventListener('click', closeAddonModal);
  if (addonModalClose) addonModalClose.addEventListener('click', closeAddonModal);

  if (addonModalList) {
    addonModalList.addEventListener('change', (e) => {
      const cb = e.target.closest('input[type="checkbox"]');
      if (!cb || !addonState) return;
      if (cb.checked) addonState.selected.add(cb.value);
      else addonState.selected.delete(cb.value);
      updateAddonTotal();
    });
  }

  if (addonQtyDec) addonQtyDec.addEventListener('click', () => {
    if (!addonState) return;
    addonState.qty = Math.max(1, addonState.qty - 1);
    document.getElementById('addonQtyVal').textContent = addonState.qty;
    updateAddonTotal();
  });
  if (addonQtyInc) addonQtyInc.addEventListener('click', () => {
    if (!addonState) return;
    addonState.qty = Math.min(20, addonState.qty + 1);
    document.getElementById('addonQtyVal').textContent = addonState.qty;
    updateAddonTotal();
  });

  if (addonAddBtn) addonAddBtn.addEventListener('click', () => {
    if (!addonState) return;
    const list = (typeof ADDON_GROUPS !== 'undefined' && ADDON_GROUPS[addonState.group]) || [];
    const addons = [...addonState.selected]
      .map(key => list.find(a => a.key === key))
      .filter(Boolean)
      .map(a => ({ key: a.key, name: a.name, price: a.price }));

    addToCart({
      id: addonState.id,
      name: addonState.name,
      price: addonState.price,
      img: addonState.img,
      addons,
      qty: addonState.qty
    });
    closeAddonModal();
  });

  /* ===== Cookie consent ===== */
  const cookieBanner = document.getElementById('cookieBanner');
  if (cookieBanner) {
    const consent = localStorage.getItem('naugula_cookie_consent');
    if (!consent) cookieBanner.hidden = false;
    const acceptBtn = document.getElementById('cookieAcceptBtn');
    const rejectBtn = document.getElementById('cookieRejectBtn');
    if (acceptBtn) acceptBtn.addEventListener('click', () => {
      localStorage.setItem('naugula_cookie_consent', 'all');
      cookieBanner.hidden = true;
    });
    if (rejectBtn) rejectBtn.addEventListener('click', () => {
      localStorage.setItem('naugula_cookie_consent', 'essential');
      cookieBanner.hidden = true;
    });
  }
});
