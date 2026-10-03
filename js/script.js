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
