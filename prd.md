# prd.md — to-do / backlog

Open work for the portfolio after the homepage was rebuilt as the B&W card
conveyor. Roughly priority-ordered. Checkboxes so it doubles as a tracker.

## P1 — correctness & consistency (the site contradicts itself today)

- [ ] **Restyle `404.astro`.** It's the only page still on the legacy
      `BaseLayout` → it renders with the old colorful theme, Header, Footer and
      Lenis. Move it to `MinimalLayout` (or a tiny dedicated B&W 404) so a
      missing page doesn't break the visual system.
- [ ] **Resolve the Header.** `Header` links to `/#work`, `/#writing`,
      `/#about`, `/#contact` — none exist on the conveyor home. Decide whether
      the B&W site needs any global nav. If not, drop it; if yes, repoint links
      (e.g. to `/`) and restyle to match.

## P2 — remove dead code (once P1 decisions are made)

- [ ] **Delete orphaned components** if not repurposed: `Hero`, `Work`,
      `Writing`, `About`, `Contact`.
- [ ] **Retire the legacy runtime** once `404` no longer needs `BaseLayout`:
      `BaseLayout`, `Header`, `Footer`, `scripts/motion.js`, `scripts/site.js`,
      and the now-unused bulk of `styles/global.css`. Reconsider whether `gsap`
      and `lenis` deps are still needed (the conveyor uses neither).

## P3 — content

- [ ] **Replace placeholder content** with real case studies / posts. The
      sample bodies ("This is a placeholder…", the `dddddd` project) and stub
      images are still in `src/content`.
- [ ] **Optional: cover thumbnails on cards.** Cards are intentionally
      type-only (kind + title + date). Schema already has `cover`; could add a
      small grayscale thumbnail per card. `ArticleLayout` already renders
      grayscale covers on detail pages.

## P4 — UX & robustness

- [ ] **No-JS / reduced-motion fallback for the conveyor.** Cards are
      JS-positioned (absolute, transforms set per frame); with JS disabled they
      stack at `0,0`. Add a CSS fallback (simple grid/list) and a static layout
      for `prefers-reduced-motion`.
- [ ] **Sparse-content gaps.** With only a few cards, `SPACING * N` leaves large
      empty stretches in the loop. Tune `SPACING`, or repeat the set when the
      card count is below a threshold.
- [ ] **Snap (optional).** The conveyor can rest between cards. Consider
      snap-to-nearest or a centered "active card" emphasis.
- [ ] **Mobile pass.** Verify card sizing (media query exists), touch-swipe
      momentum, and that swipe-vs-tap guard feels right on a real device.
- [ ] **A11y.** Confirm tab order across cards, focus-visible styling (focus
      already inverts), and that the fixed-height wheel hijack doesn't trap
      keyboard/AT users (arrow keys are wired; verify SR announcement order).

## P5 — nice-to-have

- [ ] Per-page OG/social images (the grayscale aesthetic vs. share previews).
- [ ] Revisit the favicon/logo (`public/logo.svg`) against the new B&W identity.
