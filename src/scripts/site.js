/* wangtsaiti — site interactions: theme toggle, scroll reveal, header shadow.
   Initial theme is set pre-paint by an inline script in BaseLayout. */

const root = document.documentElement;
const STORE_KEY = 'theme';

function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  const btn = document.querySelector('.theme-toggle');
  if (btn) {
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
    btn.setAttribute('title', theme === 'dark' ? 'Switch to light' : 'Switch to dark');
  }
}

// Reflect the pre-paint theme on the toggle button.
applyTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

const toggle = document.querySelector('.theme-toggle');
if (toggle) {
  toggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(STORE_KEY, next);
    } catch (e) {
      /* storage unavailable — theme still applies for this session */
    }
  });
}

// Header shadow on scroll
const header = document.querySelector('.site-header');
if (header) {
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// Scroll reveal
const reveals = document.querySelectorAll('.reveal');
const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (reduce || !('IntersectionObserver' in window)) {
  reveals.forEach((el) => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );
  reveals.forEach((el, i) => {
    el.style.transitionDelay = Math.min(i % 5, 4) * 60 + 'ms';
    io.observe(el);
  });
}
