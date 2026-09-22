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
    Top bar comes from `components/TopNav.astro`.
- **`components/TopNav.astro`** — the one top bar for every scrolling page
  (article, work, writing, minimap, 404): wordmark left, OPTIONAL `cta` right
  (`{label, href, note?, icon?, download?, external?}`), plus an OPTIONAL
  `secondary` of the same shape that renders as a quieter link to the CTA's
  left (its note is always emitted, empty until a page fills it client-side).
  `rough` draws the CTA's outline by hand and rings it on hover — opt-in,
  because it needs the page to define the `#rough-*` filters, which only
  `/minimap` does. The wordmark is written in Gochi Hand (19px/400, no
  tracking, no uppercasing — the face ships one weight), and its 64px height
  and 28px inset are tuned so it sits on exactly the same pixel as the home
  conveyor's `.cv-tl`: box top 22px on desktop, 15px under 640px. Changing one
  means changing the other, and the numbers are measured, not chosen.
- **`src/pages/404.astro`** — its own small shell (`Fonts` + `TopNav`, no
  layout). Two marks and nothing else: the number, ringed by one pen stroke
  that is drawn on arrival, and `back home`, under which a line is ruled on
  hover. No script — every path and the per-letter lean are built at build
  time. **One nib across the page**: Gochi Hand's stem measures 0.133em (4px
  at the link's 30px), so the ring and the rule are both 4px. Tag rings are
  finer (1.4px at 22px text); that ratio carried up to a 136px number swallows
  the digits, so this page matches the pen, not the ratio.
- **`src/lib/ring.ts`** — the hand, shared: `ringPath()` (one continuous stroke
  circled round something, overshooting where it closes), `rulePath()` (a line
  ruled under a word, one pass, off level, round-capped — ONE path rather than
  a repeating tile, so the ends can be round and it can be drawn on with
  `stroke-dashoffset`) and `scrawl()` (per-letter lean and drop). All seeded
  from their text, so a given word is always written the same way. Used by
  `Tags.astro` and `404.astro`.

## Style system

Strict **black `#0a0a0a` on white `#fff`** across the active pages. One
deliberate exception, **marker orange `#ff7a1a`**, used in exactly two places:
the article-page highlighter ink (a hand-drawn wave UNDER the line, one pass,
not a filled band, and only when a visitor drags the pen) and the prose list
marks (hand-inked bullet blobs and Gochi-Hand numbers, all hung from one axis).
Media forced to grayscale. Handwritten moments (the note under the ripped page)
use the Caveat font. Tags = the label in the display hand with a single pen
stroke ringed round it (`components/Tags.astro`). Display/headings = Gochi Hand
(`--font-display`); body = Onest (`--font-body`). New pages should use
`MinimalLayout` / `ArticleLayout` — not the legacy `BaseLayout`.

## Removed legacy (do not bring it back)

The original multi-section homepage was replaced by the conveyor, and the
legacy runtime it needed has now been deleted: `BaseLayout`, `Header`,
`Footer`, the orphaned `Hero` / `Work` / `Writing` / `About` / `Contact`
sections, `scripts/motion.js`, `scripts/site.js` and `styles/global.css`, plus
the `gsap` and `lenis` dependencies (the conveyor uses neither). Every page now
runs on `MinimalLayout`, `ArticleLayout`, or its own small shell.

`src/content/site.json` is still edited through Keystatic but no component
reads it any more — the components that did were part of the deleted set.

Remaining backlog lives in **`prd.md`**.
