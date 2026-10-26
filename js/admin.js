const KEY_STORAGE = 'naugula_admin_key';
const $ = (id) => document.getElementById(id);
let adminKey = null;
let items = [];
let overrides = {};

const imageUrl = (key) => '/.netlify/functions/product-image?k=' + encodeURIComponent(key);

// Shrinks the chosen photo to a 900x900 JPEG on black (same look as the menu photos).
// Read via FileReader (data: URL) because the site's CSP does not allow blob: images.
function fileToJpeg(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Невалидна снимка.'));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error('Невалидна снимка. Използвайте JPG или PNG.'));
      im.onload = () => {
        const S = 900;
        const c = document.createElement('canvas');
        c.width = S; c.height = S;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, S, S);
        const r = Math.min(S / im.width, S / im.height);
        const w = im.width * r, h = im.height * r;
        ctx.drawImage(im, (S - w) / 2, (S - h) / 2, w, h);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

async function api(method, body) {
  const res = await fetch('/.netlify/functions/admin-catalog', {
    method,
    headers: { 'X-Admin-Key': adminKey, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Грешка.'), { status: res.status });
  return data;
}

// The menu itself is the source of truth for names, descriptions and base prices.
async function loadItems() {
  const html = await (await fetch('/index.html', { cache: 'no-store' })).text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  doc.querySelectorAll('.menu-panel').forEach(panel => {
    const category = (panel.querySelector('.panel-heading') || {}).textContent || panel.id;
    panel.querySelectorAll('.btn-cart[data-id]').forEach(btn => {
      const card = btn.closest('.card, .combo-card');
      const descEl = card && (card.querySelector('.desc') || card.querySelector('.combo-body p'));
      const img = card && card.querySelector('img');
      out.push({
        id: btn.dataset.id,
        name: btn.dataset.name,
        category: category.trim(),
        price: parseFloat(btn.dataset.price),
        description: descEl ? descEl.textContent.trim() : '',
        img: img ? img.getAttribute('src') : ''
      });
    });
  });
  return out;
}

function render() {
  const q = $('adminSearch').value.trim().toLowerCase();
  const onlyChanged = $('adminOnlyChanged').checked;
  const list = $('adminList');
  list.textContent = '';
  const groups = new Map();
  items.forEach(it => {
    if (q && !(it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q))) return;
    if (onlyChanged && !overrides[it.id]) return;
    if (!groups.has(it.category)) groups.set(it.category, []);
    groups.get(it.category).push(it);
  });
  if (!groups.size) {
    const p = document.createElement('p');
    p.className = 'admin-empty';
    p.textContent = 'Няма намерени артикули.';
    list.appendChild(p);
    return;
  }
  groups.forEach((arr, cat) => {
    const h = document.createElement('h2');
    h.className = 'admin-cat';
    h.textContent = cat;
    list.appendChild(h);
    arr.forEach(it => list.appendChild(row(it)));
  });
}

function row(it) {
  const ov = overrides[it.id] || {};
  const price = ov.price !== undefined ? ov.price : it.price;
  const desc = ov.description !== undefined ? ov.description : it.description;
  const available = ov.available !== false;

  const el = document.createElement('div');
  el.className = 'admin-row' + (overrides[it.id] ? ' changed' : '') + (available ? '' : ' off');

  const img = document.createElement('img');
  img.src = ov.image ? imageUrl(ov.image) : it.img; img.alt = ''; img.className = 'admin-thumb'; img.loading = 'lazy';

  const name = document.createElement('div');
  name.className = 'admin-name';
  const nameIn = document.createElement('input');
  nameIn.type = 'text'; nameIn.maxLength = 80; nameIn.className = 'admin-title';
  nameIn.value = ov.name !== undefined ? ov.name : it.name;
  nameIn.setAttribute('aria-label', 'Заглавие');
  const badge = document.createElement('span');
  badge.className = 'admin-badge'; badge.textContent = 'променен'; badge.hidden = !overrides[it.id];
  name.append(nameIn, badge);

  const priceIn = document.createElement('input');
  priceIn.type = 'number'; priceIn.step = '0.01'; priceIn.min = '0'; priceIn.value = Number(price).toFixed(2);
  priceIn.className = 'admin-price'; priceIn.setAttribute('aria-label', 'Цена в евро');
  const priceWrap = document.createElement('label');
  priceWrap.className = 'admin-field';
  priceWrap.append('Цена €', priceIn);

  const descIn = document.createElement('textarea');
  descIn.rows = 2; descIn.value = desc; descIn.maxLength = 500; descIn.className = 'admin-desc';
  descIn.setAttribute('aria-label', 'Описание');

  const availIn = document.createElement('input');
  availIn.type = 'checkbox'; availIn.checked = available;
  const availWrap = document.createElement('label');
  availWrap.className = 'admin-avail';
  availWrap.append(availIn, ' Наличен');

  let pendingImage = null;
  let imageRemoved = false;
  const fileIn = document.createElement('input');
  fileIn.type = 'file'; fileIn.accept = 'image/*'; fileIn.hidden = true;
  const pick = document.createElement('button');
  pick.type = 'button'; pick.className = 'btn btn-ghost admin-pick'; pick.textContent = 'Смени снимка';
  const origImg = document.createElement('button');
  origImg.type = 'button'; origImg.className = 'btn btn-ghost admin-pick'; origImg.textContent = 'Оригинална снимка';
  origImg.hidden = !ov.image;
  pick.addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', async () => {
    const file = fileIn.files && fileIn.files[0];
    if (!file) return;
    try {
      pendingImage = await fileToJpeg(file);
      imageRemoved = false;
      img.src = pendingImage;
      origImg.hidden = false;
      msg.textContent = 'Снимката е избрана — натиснете „Запази“.';
    } catch (e) { msg.textContent = e.message; }
    fileIn.value = '';
  });
  origImg.addEventListener('click', () => {
    pendingImage = null; imageRemoved = true; img.src = it.img; origImg.hidden = true;
    msg.textContent = 'Ще се върне оригиналната снимка — натиснете „Запази“.';
  });

  const save = document.createElement('button');
  save.type = 'button'; save.className = 'btn btn-primary admin-save'; save.textContent = 'Запази';
  const reset = document.createElement('button');
  reset.type = 'button'; reset.className = 'btn btn-ghost admin-reset'; reset.textContent = 'Върни оригинала';
  reset.hidden = !overrides[it.id];
  const msg = document.createElement('span');
  msg.className = 'admin-msg';

  save.addEventListener('click', async () => {
    const body = { id: it.id };
    const newName = nameIn.value.trim();
    if (!newName) { msg.textContent = 'Заглавието не може да е празно'; return; }
    if (newName !== it.name) body.name = newName;
    const p = parseFloat(priceIn.value);
    if (!Number.isFinite(p) || p < 0) { msg.textContent = 'Невалидна цена'; return; }
    if (Math.abs(p - it.price) > 0.001) body.price = p;
    if (descIn.value.trim() !== it.description) body.description = descIn.value.trim();
    if (!availIn.checked) body.available = false;
    if (pendingImage) body.imageData = pendingImage;
    else if (ov.image && !imageRemoved) body.keepImage = true;
    save.disabled = true; msg.textContent = 'Запазване…';
    try {
      const res = await api('POST', Object.keys(body).length === 1 ? { id: it.id, reset: true } : body);
      overrides = res.overrides;
      render();
    } catch (e) {
      msg.textContent = e.message; save.disabled = false;
    }
  });
  reset.addEventListener('click', async () => {
    reset.disabled = true; msg.textContent = 'Връщане…';
    try { overrides = (await api('POST', { id: it.id, reset: true })).overrides; render(); }
    catch (e) { msg.textContent = e.message; reset.disabled = false; }
  });

  const actions = document.createElement('div');
  actions.className = 'admin-actions';
  actions.append(save, pick, origImg, fileIn, reset, msg);

  const fields = document.createElement('div');
  fields.className = 'admin-fields';
  fields.append(priceWrap, availWrap);

  const col = document.createElement('div');
  col.className = 'admin-body-col';
  col.append(name, fields, descIn, actions);

  el.append(img, col);
  return el;
}

async function unlock(key, remember) {
  adminKey = key;
  const data = await api('GET');
  overrides = data.overrides || {};
  items = await loadItems();
  if (remember) sessionStorage.setItem(KEY_STORAGE, key);
  $('adminGate').hidden = true;
  $('adminMain').hidden = false;
  $('adminLock').hidden = false;
  render();
}

$('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('adminLoginError');
  err.hidden = true;
  try {
    await unlock($('adminPass').value, true);
  } catch (ex) {
    err.textContent = ex.status === 401 ? 'Грешна парола.' : (ex.message || 'Грешка при вход.');
    err.hidden = false;
  }
});
$('adminLock').addEventListener('click', () => { sessionStorage.removeItem(KEY_STORAGE); location.reload(); });
$('adminSearch').addEventListener('input', render);
$('adminOnlyChanged').addEventListener('change', render);

const saved = sessionStorage.getItem(KEY_STORAGE);
if (saved) unlock(saved, false).catch(() => sessionStorage.removeItem(KEY_STORAGE));
