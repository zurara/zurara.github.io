# CLAUDE.md

Guidance for working in this repo. Read before making changes.

## What this is

`wangtsaiti` — personal portfolio for zurara (designer at Orthogonal). Static
Astro site deployed to GitHub Pages at **https://zurara.github.io**.

The homepage is a **black-&-white card conveyor**: projects and articles are
cards on a fixed-height, scroll-hijacked horizontal track (inspired by
meech213.com). Cards keep a fixed tilt (they translate, they do **not**
self-rotate), slide leftward on scroll, loop infinitely, invert on hover, and
link through to a detail page.

## Stack

- **Astro 6**, static output. MDX content. `@astrojs/sitemap`.
- **Keystatic CMS** — dev-only. `react` + `keystatic` integrations load only when
  the command is `dev` (see `astro.config.mjs`); the production build is fully
  static, no adapter. CMS editor at `/keystatic` in dev.
- **Fonts**: Fraunces (serif — titles/headings), Urbanist (sans — body), via
  Google Fonts.
- **Deploy**: GitHub Action builds on push to `main` → Pages. User page served
  at domain root, so no `base` path. `site` drives canonical URLs / sitemap.
- Node >= 22.12.

## Run

```
npm run dev       # http://localhost:4321  (+ /keystatic editor)
npm run build     # static output to dist/
npm run preview
```

## Content model — `src/content.config.ts`

- `projects/*.mdx`: `title, year, role?, summary?, cover?, accent, tags[],
  externalUrl?, featured, order, draft`. Detail page: `/work/{id}`.
- `articles/*.mdx`: `title, date, excerpt?, cover?, tags[], externalUrl?, draft`.
  Detail page: `/writing/{id}`.
- `externalUrl` set → the card links out and **no** local detail page is built.
- `draft: true` hides an entry. CMS body images save under `public/uploads/...`.

## Active architecture (what's actually on the site)

- **Home** `src/pages/index.astro` → `MinimalLayout` + `Conveyor`.
  - `components/Conveyor.astro` — fetches both collections, interleaves them,
    renders cards, and runs the conveyor in an inline `<script>`. Cards are
    absolutely positioned; JS sets `translate/rotate/scale` each frame. Knobs at
    the top of the script: `TILTS`, `YPCT`, `SCALES`, `SPACING`, wheel `* 0.9`,
    lerp `* 0.12`. Wheel + touch + arrow-key driven. No snap.
  - `layouts/MinimalLayout.astro` — white/black shell, fonts only,
    `overflow:hidden` (fixed height), **no** Header/Footer/Lenis.
- **Detail pages** `src/pages/work/[...slug].astro`, `writing/[...slug].astro`
  → `ArticleLayout`.
  - `layouts/ArticleLayout.astro` — scrolling B&W content shell. Global styles
    for `.detail` / `.prose` / tags / grayscale media / Fraunces headings.
    Fixed topbar (wordmark + "← Index").

## Style system

Strict **black `#0a0a0a` on white `#fff`** across the active pages. No accent
colors. Media forced to grayscale. Tags = 1px black-border chips. Titles &
headings = Fraunces; body = Urbanist. New pages should use
`MinimalLayout` / `ArticleLayout` — not the legacy `BaseLayout`.

## ⚠️ Legacy / orphaned — do NOT assume these are live

The original multi-section homepage was replaced by the conveyor. As a result:

- **Orphaned components** (imported by nothing): `Hero`, `Work`, `Writing`,
  `About`, `Contact`.
- **`BaseLayout`** (with `Header`, `Footer`, `styles/global.css`,
  `scripts/motion.js` [Lenis + GSAP], `scripts/site.js`) is now used **only by
  `404.astro`**. So Lenis smooth-scroll and the GSAP card animation no longer
  run on the real site, and `global.css` is largely dead.
- **`Header`** still links to `/#work`, `/#writing`, `/#about`, `/#contact` —
  anchors that don't exist on the conveyor home.

Cleanup plan lives in **`prd.md`**.
