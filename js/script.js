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

// Menu tabs — only one category is shown at a time (like before). Scrolling
// down inside the visible category scrolls its own list; once you reach the
// bottom of that category, the next wheel/swipe down switches to the next
// category automatically (and the reverse going up), instead of requiring
// a tab click every time.
const tabs = document.querySelectorAll('#menuTabs .tab');
const panels = document.querySelectorAll('.menu-panel');
const order = [...tabs].map(t => t.dataset.target);
let activeIdx = 0;

function showPanel(i, opts) {
  opts = opts || {};
  i = Math.max(0, Math.min(order.length - 1, i));
  activeIdx = i;
  const id = order[i];
  panels.forEach(p => p.classList.toggle('active', p.id === id));
  tabs.forEach(t => t.classList.toggle('active', t.dataset.target === id));
  const panel = document.getElementById(id);
  panel.scrollTop = opts.toBottom ? panel.scrollHeight : 0;
  if (opts.scrollIntoView) panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => showPanel(i, { scrollIntoView: true }));
});

let wheelLock = false;
function unlockSoon() { setTimeout(() => { wheelLock = false; }, 550); }

panels.forEach(panel => {
  panel.addEventListener('wheel', (e) => {
    if (!panel.classList.contains('active') || wheelLock) return;
    const atTop = panel.scrollTop <= 0;
    const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1;
    if (e.deltaY > 0 && atBottom && activeIdx < order.length - 1) {
      e.preventDefault();
      wheelLock = true;
      showPanel(activeIdx + 1, { scrollIntoView: true });
      unlockSoon();
    } else if (e.deltaY < 0 && atTop && activeIdx > 0) {
      e.preventDefault();
      wheelLock = true;
      showPanel(activeIdx - 1, { toBottom: true, scrollIntoView: true });
      unlockSoon();
    }
  }, { passive: false });

  let touchStartY = null;
  panel.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    if (!panel.classList.contains('active') || wheelLock || touchStartY === null) return;
    const deltaY = touchStartY - e.touches[0].clientY; // positive = swiping up (scroll down)
    const atTop = panel.scrollTop <= 0;
    const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1;
    if (deltaY > 24 && atBottom && activeIdx < order.length - 1) {
      e.preventDefault();
      wheelLock = true;
      showPanel(activeIdx + 1, { scrollIntoView: true });
      unlockSoon();
    } else if (deltaY < -24 && atTop && activeIdx > 0) {
      e.preventDefault();
      wheelLock = true;
      showPanel(activeIdx - 1, { toBottom: true, scrollIntoView: true });
      unlockSoon();
    }
  }, { passive: false });
});
