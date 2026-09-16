// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

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

// Menu tabs — all categories are shown at once in one scrollable list.
// Clicking a tab smooth-scrolls to that category; the active tab follows
// scroll position via IntersectionObserver, and CSS scroll-snap carries
// the page into the next category once the current one is scrolled past.
const tabs = document.querySelectorAll('#menuTabs .tab');
const panels = document.querySelectorAll('.menu-panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = document.getElementById(tab.dataset.target);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

const setActiveTab = (id) => {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.target === id));
};

const panelObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) setActiveTab(entry.target.id);
  });
}, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

panels.forEach(p => panelObserver.observe(p));
