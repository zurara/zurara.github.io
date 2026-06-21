import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Projects — each Markdown/MDX file is one project. Keystatic manages these.
const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    year: z.string().default(''),
    // Optional so an entry never silently disappears when a field is left
    // blank in the CMS — empty values simply render nothing.
    role: z.string().optional().default(''),
    summary: z.string().optional().default(''),
    // Cover image path under /public (e.g. "/uploads/projects/foo.jpg").
    // Optional — falls back to the accent color block when absent.
    cover: z.string().nullable().optional(),
    accent: z.string().default('#cf5a3c'),
    tags: z.array(z.string()).default([]),
    externalUrl: z.string().url().nullable().optional(),
    featured: z.boolean().default(false),
    order: z.number().default(0),
    draft: z.boolean().default(false),
  }),
});

// Articles — each Markdown/MDX file is one post.
const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    excerpt: z.string().optional().default(''),
    cover: z.string().nullable().optional(),
    tags: z.array(z.string()).default([]),
    // If set, the article lives elsewhere and the card links out instead of
    // rendering a local detail page.
    externalUrl: z.string().url().nullable().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, articles };
