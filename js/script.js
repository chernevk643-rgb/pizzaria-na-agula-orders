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

// Reviews carousel — drifts sideways on its own in a seamless loop; pauses while
// the visitor hovers or touches it, and the arrows still step one card at a time.
const reviewTrack = document.getElementById('reviewTrack');
if (reviewTrack) {
  [...reviewTrack.children].forEach(c => {
    const clone = c.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    reviewTrack.appendChild(clone);
  });
  const half = () => reviewTrack.scrollWidth / 2;
  const step = () => reviewTrack.children[0].offsetWidth + 24;
  const SPEED = 0.04; // px per ms
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pos = 0, last = performance.now(), paused = false, resumeTimer;

  const normalize = () => {
    const h = half();
    pos = reviewTrack.scrollLeft;
    if (pos >= h) { pos -= h; reviewTrack.scrollLeft = pos; }
  };
  const pause = () => { paused = true; clearTimeout(resumeTimer); };
  const resumeSoon = (ms) => {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => { normalize(); paused = false; last = performance.now(); }, ms);
  };

  const tick = (now) => {
    if (!paused && !reduced) {
      pos += (now - last) * SPEED;
      if (pos >= half()) pos -= half();
      reviewTrack.scrollLeft = pos;
    }
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  reviewTrack.addEventListener('mouseenter', pause);
  reviewTrack.addEventListener('mouseleave', () => resumeSoon(800));
  reviewTrack.addEventListener('touchstart', pause, { passive: true });
  reviewTrack.addEventListener('touchend', () => resumeSoon(2500), { passive: true });

  const nudge = (dir) => {
    pause();
    normalize();
    if (dir < 0 && pos < step()) { pos += half(); reviewTrack.scrollLeft = pos; }
    reviewTrack.scrollBy({ left: dir * step(), behavior: 'smooth' });
    resumeSoon(3500);
  };
  document.getElementById('reviewPrev').addEventListener('click', () => nudge(-1));
  document.getElementById('reviewNext').addEventListener('click', () => nudge(1));
}
