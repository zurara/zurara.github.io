import { config, fields, collection } from '@keystatic/core';

// Local storage: the editor writes Markdown/MDX + images straight into the
// repo on your machine. Commit + push → the GitHub Action rebuilds the site.
// Switch `kind` to 'github' later for a hosted, log-in-from-anywhere editor.
export default config({
  storage: { kind: 'local' },
  ui: {
    brand: { name: 'zurara' },
  },
  collections: {
    projects: collection({
      label: 'Projects',
      slugField: 'title',
      path: 'src/content/projects/*',
      format: { contentField: 'content' },
      columns: ['title', 'year'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        year: fields.text({ label: 'Year', defaultValue: '2025' }),
        role: fields.text({ label: 'Role', description: 'e.g. Product design' }),
        summary: fields.text({
          label: 'Summary',
          description: 'Short blurb shown on the card.',
          multiline: true,
        }),
        cover: fields.image({
          label: 'Cover image',
          description: 'Optional. Falls back to the accent color when empty.',
          directory: 'public/uploads/projects',
          publicPath: '/uploads/projects/',
        }),
        accent: fields.text({
          label: 'Accent color',
          description: 'Hex color used when there is no cover image.',
          defaultValue: '#cf5a3c',
        }),
        tags: fields.array(fields.text({ label: 'Tag' }), {
          label: 'Tags',
          itemLabel: (props) => props.value,
        }),
        externalUrl: fields.url({
          label: 'External URL',
          description: 'If set, the card links here instead of a detail page.',
        }),
        featured: fields.checkbox({ label: 'Featured', defaultValue: false }),
        order: fields.integer({ label: 'Order', defaultValue: 0 }),
        draft: fields.checkbox({ label: 'Draft', defaultValue: false }),
        content: fields.mdx({ label: 'Body' }),
      },
    }),

    articles: collection({
      label: 'Articles',
      slugField: 'title',
      path: 'src/content/articles/*',
      format: { contentField: 'content' },
      columns: ['title', 'date'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        date: fields.date({ label: 'Date', defaultValue: { kind: 'today' } }),
        excerpt: fields.text({ label: 'Excerpt', multiline: true }),
        cover: fields.image({
          label: 'Cover image',
          directory: 'public/uploads/articles',
          publicPath: '/uploads/articles/',
        }),
        tags: fields.array(fields.text({ label: 'Tag' }), {
          label: 'Tags',
          itemLabel: (props) => props.value,
        }),
        externalUrl: fields.url({
          label: 'External URL',
          description: 'If set, the post links here instead of a detail page.',
        }),
        draft: fields.checkbox({ label: 'Draft', defaultValue: false }),
        content: fields.mdx({ label: 'Body' }),
      },
    }),
  },
});
