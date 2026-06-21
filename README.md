# zurara.github.io — personal site

Editorial portfolio for **wangtsaiti**. Astro (static) + Keystatic (git-based CMS)
+ GSAP/Lenis scroll animation, deployed to GitHub Pages.

## Run it

```sh
npm install
npm run dev        # site at http://localhost:4321  ·  editor at /keystatic
npm run build      # static output to ./dist (this is what GitHub Pages serves)
npm run preview    # preview the production build
```

## Editing content (Keystatic)

Run `npm run dev` and open **`/keystatic`**. Add or edit **Projects** and
**Articles** there — it writes Markdown/MDX into `src/content/` and images into
`public/uploads/`. Then:

```sh
git add -A && git commit -m "content: ..." && git push
```

The push triggers the GitHub Action, which rebuilds and redeploys (~1–2 min).

> The Keystatic editor runs in **local mode** and is only available in `npm run dev`.
> It is deliberately excluded from the production build, so GitHub Pages stays
> fully static (no server/adapter). To get a hosted, log-in-from-anywhere editor
> later, switch `storage` in `keystatic.config.ts` to `kind: 'github'` and deploy
> the admin to a small SSR host (e.g. Vercel/Netlify).

## Structure

```
src/
├── components/      # Header, Hero, Work, Writing, About, Contact, Footer
├── content/         # projects/ and articles/ (Markdown/MDX — CMS-managed)
├── content.config.ts# collection schemas (must match keystatic.config.ts)
├── layouts/         # BaseLayout (head, theme, header/footer)
├── pages/           # index + /work/[slug] + /writing/[slug]
├── scripts/         # site.js (theme/reveal) · motion.js (GSAP + Lenis)
└── styles/global.css
keystatic.config.ts  # CMS field definitions
.github/workflows/deploy.yml  # build + deploy to GitHub Pages
```

## Deploying

The repo's GitHub Pages source must be set to **GitHub Actions**
(Settings → Pages → Build and deployment → Source). After that, every push to
`main` builds and deploys automatically.
