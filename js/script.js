// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Page "views" — clicking Меню / За нас / Отзиви / Контакти in the nav shows
// only that section (header and footer stay put); the site opens on Начало
// (hero + the four highlight tiles). This matches what was asked: being in
// the menu should not keep scrolling into About/Reviews below it.
const viewSections = document.querySelectorAll('[data-view]');
const HASH_TO_VIEW = { '#top': 'home', '#menu': 'menu', '#about': 'about', '#reviews': 'reviews', '#contact': 'contact' };

function showView(view) {
  viewSections.forEach(s => { s.style.display = s.dataset.view === view ? '' : 'none'; });
}

function goToHash(hash) {
  showView(HASH_TO_VIEW[hash] || 'home');
  window.scrollTo({ top: 0 });
  history.replaceState(null, '', hash);
}

document.querySelectorAll('a[href^="#"]').forEach(a => {
  const hash = a.getAttribute('href');
  if (!(hash in HASH_TO_VIEW)) return;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    goToHash(hash);
  });
});

showView(HASH_TO_VIEW[location.hash] || 'home');

// Header scroll state
const header = document.getElementById('siteHeader');
const onScroll = () => {
  if (window.scrollY > 40) header.classList.add('scrolled');
  else header.classList.remove('scrolled');
};
window.addEventListener('scroll', onScroll);
onScroll();

// Mobile nav toggle
const burger = document.getElementById('burgerBtn');
const mainNav = document.getElementById('mainNav');
burger.addEventListener('click', () => {
  mainNav.classList.toggle('open');
});
mainNav.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => mainNav.classList.remove('open'));
});

// Menu tabs — same pattern as Glovo/Bolt: the category bar sticks to the top,
// every category is visible in one continuous scroll (nothing is hidden),
// clicking a tab smooth-scrolls straight to that category, and the tab that
// matches whatever category is currently under the sticky bar lights up as
// you scroll past it.
const tabs = document.querySelectorAll('#menuTabs .tab');
const panels = document.querySelectorAll('.menu-panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    document.getElementById(tab.dataset.target).scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

const setActiveTab = (id) => {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.target === id));
};

const panelObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) setActiveTab(entry.target.id);
  });
}, { rootMargin: '-160px 0px -70% 0px', threshold: 0 });

panels.forEach(p => panelObserver.observe(p));
