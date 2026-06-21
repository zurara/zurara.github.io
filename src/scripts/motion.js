/* Smooth scroll (Lenis) + scroll-driven floating/rotating work cards (GSAP).
   Progressive enhancement: cards are fully visible by default in CSS, so if
   this never runs (no JS) or motion is reduced, the site is still complete. */
import Lenis from 'lenis';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduce) {
  gsap.registerPlugin(ScrollTrigger);

  // --- Global smooth scroll, synced to GSAP's ticker ---
  const lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Anchor links inside the page should hand off to Lenis for smooth jumps.
  document.querySelectorAll('a[href^="/#"], a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').split('#')[1];
      const target = id && document.getElementById(id);
      if (target) {
        e.preventDefault();
        lenis.scrollTo(target, { offset: -80 });
      }
    });
  });

  // --- Floating / rotating project cards ---
  const cards = gsap.utils.toArray('[data-card]');
  cards.forEach((card, i) => {
    const dir = i % 2 === 0 ? 1 : -1; // alternate tilt direction per column
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: card,
        start: 'top 95%',
        end: 'bottom 30%',
        scrub: 1,
      },
    });

    tl.fromTo(
      card,
      {
        y: 70,
        rotateZ: dir * -5,
        rotateY: dir * 10,
        scale: 0.96,
        opacity: 0.35,
        transformPerspective: 1000,
        transformOrigin: 'center center',
      },
      { y: 0, rotateZ: 0, rotateY: 0, scale: 1, opacity: 1, ease: 'power2.out' }
    ).to(card, { y: -44, rotateZ: dir * 3, ease: 'power1.in' });
  });

  // Recalculate once fonts/images settle.
  window.addEventListener('load', () => ScrollTrigger.refresh());
}
