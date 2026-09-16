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

// Menu tabs — only one category is shown at a time. While the mouse/finger
// is over the visible category, we drive its internal scroll ourselves
// (instead of letting the browser do it) so the page underneath can never
// scroll at the same time — that double-scroll is what felt broken before.
// Only once the category is fully scrolled to its top/bottom do we either
// switch to the next/previous category, or — at the very first/last
// category — hand scrolling back to the page.
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

let switchLock = false;
function unlockSoon() { setTimeout(() => { switchLock = false; }, 550); }

panels.forEach(panel => {
  panel.addEventListener('wheel', (e) => {
    if (!panel.classList.contains('active')) return;
    const atTop = panel.scrollTop <= 0;
    const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1;

    if (e.deltaY > 0 && atBottom) {
      if (activeIdx < order.length - 1) {
        e.preventDefault();
        if (switchLock) return;
        switchLock = true;
        showPanel(activeIdx + 1, { scrollIntoView: true });
        unlockSoon();
      }
      // last category, already at its bottom: let the page scroll past the menu normally
      return;
    }
    if (e.deltaY < 0 && atTop) {
      if (activeIdx > 0) {
        e.preventDefault();
        if (switchLock) return;
        switchLock = true;
        showPanel(activeIdx - 1, { toBottom: true, scrollIntoView: true });
        unlockSoon();
      }
      // first category, already at its top: let the page scroll up normally
      return;
    }

    // Not at an edge — scroll only this category's own list, never the page.
    e.preventDefault();
    panel.scrollTop += e.deltaY;
  }, { passive: false });

  let touchStartY = null;
  let touchLastY = null;
  panel.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchLastY = touchStartY;
  }, { passive: true });

  panel.addEventListener('touchmove', (e) => {
    if (!panel.classList.contains('active') || touchLastY === null) return;
    const y = e.touches[0].clientY;
    const stepDelta = touchLastY - y; // positive = finger moving up = scrolling down
    const totalDelta = touchStartY - y;
    touchLastY = y;

    const atTop = panel.scrollTop <= 0;
    const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1;

    if (totalDelta > 24 && atBottom) {
      if (activeIdx < order.length - 1) {
        e.preventDefault();
        if (switchLock) return;
        switchLock = true;
        showPanel(activeIdx + 1, { scrollIntoView: true });
        unlockSoon();
      }
      return;
    }
    if (totalDelta < -24 && atTop) {
      if (activeIdx > 0) {
        e.preventDefault();
        if (switchLock) return;
        switchLock = true;
        showPanel(activeIdx - 1, { toBottom: true, scrollIntoView: true });
        unlockSoon();
      }
      return;
    }

    e.preventDefault();
    panel.scrollTop += stepDelta;
  }, { passive: false });
});
