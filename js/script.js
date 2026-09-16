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

// Menu tabs — only one category is shown at a time. Modeled on the classic
// "one page at a time" scroll pattern (the technique behind sites like
// Apple's old iPhone 5S page / the "onepage-scroll" plugin): scroll input is
// fully swallowed while paging between categories, and — critically — we
// never hand control back to the page mid-gesture. A trackpad/mouse-wheel
// swipe keeps generating events after the user's hand has stopped moving
// (momentum/inertia), so instead of releasing to normal page scroll the
// instant we hit the last category, we keep absorbing events and restart a
// short "quiet" timer on every one of them. Only once that timer fires with
// no further input (the momentum has actually died down) do we hand scrolling
// back to the page — that's what stops a single swipe from flying straight
// past the menu into the About section.
const tabs = document.querySelectorAll('#menuTabs .tab');
const panels = document.querySelectorAll('.menu-panel');
const order = [...tabs].map(t => t.dataset.target);
const menuSection = document.getElementById('menu');
let activeIdx = 0;
let paging = true;       // true while this section owns the scroll wheel/touch
let switching = false;   // true for the short cooldown right after a category change
let releaseTimer = null;

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
  tab.addEventListener('click', () => {
    paging = true;
    showPanel(i, { scrollIntoView: true });
  });
});

// Re-engage paging whenever the menu section scrolls back into view — e.g.
// the user scrolled past it into "About" and then scrolls back up.
new IntersectionObserver((entries) => {
  entries.forEach(entry => { if (entry.isIntersecting) paging = true; });
}, { threshold: 0 }).observe(menuSection);

const SWITCH_COOLDOWN = 550;   // matches the debounce big "one page at a time" sites use
const RELEASE_QUIET_GAP = 400; // how long input must be silent before we hand scroll back to the page

function armRelease() {
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => { paging = false; }, RELEASE_QUIET_GAP);
}

// Whether each panel is scrolled to the bottom of its own content. Driven by
// IntersectionObserver rather than scrollTop/scrollHeight arithmetic —
// comparing those directly is off by fractions of a pixel once lazy-loaded
// images reflow the layout, which made the edge check silently never fire.
const atBottomState = new Map();
panels.forEach(panel => {
  const sentinel = panel.lastElementChild;
  if (!sentinel) { atBottomState.set(panel, true); return; }
  atBottomState.set(panel, false);
  new IntersectionObserver((entries) => {
    entries.forEach(entry => atBottomState.set(panel, entry.isIntersecting));
  }, { root: panel, threshold: 0.01 }).observe(sentinel);
});

// Returns true if the event should be swallowed (preventDefault), false if
// it should be left alone to scroll the page normally.
function handleDelta(deltaY) {
  if (!paging) return false;

  const panel = panels[activeIdx];
  const atTop = panel.scrollTop <= 0;
  const atBottom = atBottomState.get(panel);
  const goingDown = deltaY > 0;
  const goingUp = deltaY < 0;

  // Mid-list: just drive this category's own scroll, page never moves.
  if ((goingDown && !atBottom) || (goingUp && !atTop)) {
    panel.scrollTop += deltaY;
    return true;
  }

  // At an edge of the current category's content.
  if (goingDown && activeIdx < order.length - 1) {
    if (!switching) {
      switching = true;
      showPanel(activeIdx + 1);
      setTimeout(() => { switching = false; }, SWITCH_COOLDOWN);
    }
    return true;
  }
  if (goingUp && activeIdx > 0) {
    if (!switching) {
      switching = true;
      showPanel(activeIdx - 1, { toBottom: true });
      setTimeout(() => { switching = false; }, SWITCH_COOLDOWN);
    }
    return true;
  }

  // Very first/last category, already at its outer edge: keep absorbing
  // events (so leftover scroll momentum can't fling the page past us) until
  // input has been quiet for a moment, then hand scrolling back to the page.
  armRelease();
  return true;
}

panels.forEach(panel => {
  panel.addEventListener('wheel', (e) => {
    if (handleDelta(e.deltaY)) e.preventDefault();
  }, { passive: false });

  let touchLastY = null;
  panel.addEventListener('touchstart', (e) => { touchLastY = e.touches[0].clientY; }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    if (touchLastY === null) return;
    const y = e.touches[0].clientY;
    const deltaY = touchLastY - y; // positive = finger moving up = scrolling down
    touchLastY = y;
    if (handleDelta(deltaY)) e.preventDefault();
  }, { passive: false });
});
