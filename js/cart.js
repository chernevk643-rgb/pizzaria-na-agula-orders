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

function addToCart(item) {
  const cart = getCart();
  const existing = cart.find(i => i.id === item.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...item, qty: 1 });
  }
  saveCart(cart);
  openCart();
}

function updateQty(id, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  const next = item.qty <= 0 ? cart.filter(i => i.id !== id) : cart;
  saveCart(next);
}

function removeFromCart(id) {
  saveCart(getCart().filter(i => i.id !== id));
}

function clearCart() {
  saveCart([]);
}

function cartTotal() {
  return getCart().reduce((sum, i) => sum + i.price * i.qty, 0);
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

  itemsEl.innerHTML = cart.map(i => `
    <div class="cart-item" data-id="${i.id}">
      <img src="${i.img || 'assets/img/logo.png'}" alt="${i.name}">
      <div class="cart-item-info">
        <strong>${i.name}</strong>
        <span class="cart-item-price">${fmtEUR(i.price)}</span>
        <div class="qty-stepper">
          <button type="button" class="qty-btn" data-action="dec" data-id="${i.id}" aria-label="Намали">&minus;</button>
          <span>${i.qty}</span>
          <button type="button" class="qty-btn" data-action="inc" data-id="${i.id}" aria-label="Увеличи">&plus;</button>
        </div>
      </div>
      <button type="button" class="cart-item-remove" data-id="${i.id}" aria-label="Премахни">&times;</button>
    </div>
  `).join('');

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

/* ===================== EVENTS ===================== */
document.addEventListener('DOMContentLoaded', () => {
  renderCart();

  // Add-to-cart buttons (event delegation, works for all injected buttons)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-cart');
    if (btn) {
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
    if (qtyBtn) {
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
