# prd.md — to-do / backlog

Open work for the portfolio after the homepage was rebuilt as the B&W card
conveyor. Roughly priority-ordered. Checkboxes so it doubles as a tracker.

## P1 — correctness & consistency (the site contradicts itself today)

- [x] **Restyle `404.astro`.** Done — it wears `TopNav` and the B&W paper
      language on its own small shell: the number ringed by one pen stroke
      (`lib/ring.ts`, shared with `Tags`), the way back handwritten over a
      pencil squiggle. No script, no legacy layout.
- [x] **Resolve the Header.** Dropped. The conveyor home has no anchors to
      point at, and the wordmark in `TopNav` is the only global nav the B&W
      site needs.

## P2 — remove dead code

- [x] **Delete orphaned components**: `Hero`, `Work`, `Writing`, `About`,
      `Contact` — gone.
- [x] **Retire the legacy runtime**: `BaseLayout`, `Header`, `Footer`,
      `scripts/motion.js`, `scripts/site.js`, `styles/global.css`, and the
      `gsap` + `lenis` dependencies — all removed.
- [ ] **`src/content/site.json`** is now read by nothing (its consumers were in
      the deleted set) but is still a Keystatic singleton. Either surface it
      again or retire it from the CMS.

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
