// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

// The Keystatic editor (and its React UI + server routes) only runs during
// local development. The production build deployed to GitHub Pages stays
// fully static — `astro build` omits Keystatic, so no adapter is needed.
const isDev = process.argv.includes('dev');

// zurara.github.io is a GitHub *user* page → served at the domain root,
// so no `base` path is needed. `site` is used for canonical URLs / sitemap.
// https://astro.build/config
export default defineConfig({
  site: 'https://zurara.github.io',
  integrations: [mdx(), sitemap(), ...(isDev ? [react(), keystatic()] : [])],
});
