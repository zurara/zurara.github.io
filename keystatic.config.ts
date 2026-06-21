import { config, fields, collection, singleton } from '@keystatic/core';

// Local storage: the editor writes Markdown/MDX + images straight into the
// repo on your machine. Commit + push → the GitHub Action rebuilds the site.
// Switch `kind` to 'github' later for a hosted, log-in-from-anywhere editor.
export default config({
  storage: { kind: 'local' },
  ui: {
    brand: { name: 'zurara' },
  },
  singletons: {
    home: singleton({
      label: 'Home & About text',
      path: 'src/content/site',
      format: { data: 'json' },
      schema: {
        name: fields.text({ label: 'Your name', defaultValue: 'wangtsaiti' }),
        greeting: fields.text({ label: 'Hero greeting', defaultValue: 'High five 🙌' }),
        heroBefore: fields.text({ label: 'Hero — text before the highlighted word', defaultValue: 'I turn' }),
        heroEmphasis: fields.text({ label: 'Hero — highlighted word', defaultValue: 'chaos' }),
        heroAfter: fields.text({
          label: 'Hero — text after the highlighted word',
          defaultValue: 'into clever, deliberate work.',
          multiline: true,
        }),
        introMiddle: fields.text({
          label: 'Intro — connective text',
          description: 'Shown as: I\'m [name] — [this text] [org name].',
          defaultValue: 'a designer supporting early-stage tech innovation at',
          multiline: true,
        }),
        orgName: fields.text({ label: 'Org name', defaultValue: 'Orthogonal Supersystems' }),
        orgUrl: fields.url({ label: 'Org URL', defaultValue: 'https://orthogonal.dev' }),
        status: fields.text({
          label: 'Status line',
          defaultValue: 'Currently — shaping product & design for early-stage teams',
          multiline: true,
        }),
        aboutParagraphs: fields.array(
          fields.text({ label: 'Paragraph', multiline: true }),
          { label: 'About paragraphs', itemLabel: (p) => p.value.slice(0, 48) || 'Paragraph' }
        ),
        aboutFacts: fields.array(
          fields.object({
            label: fields.text({ label: 'Label' }),
            value: fields.text({ label: 'Value' }),
          }),
          {
            label: 'About facts',
            itemLabel: (p) => `${p.fields.label.value} — ${p.fields.value.value}`,
          }
        ),
        contactTitle: fields.text({ label: 'Contact title', defaultValue: "Let's make something." }),
        contactLede: fields.text({
          label: 'Contact lede',
          defaultValue: "Have a problem worth untangling? I'd love to hear about it.",
          multiline: true,
        }),
        email: fields.text({ label: 'Email', defaultValue: 'zurara@orthogonal.dev' }),
        socials: fields.array(
          fields.object({
            label: fields.text({ label: 'Label' }),
            url: fields.url({ label: 'URL' }),
          }),
          { label: 'Social links', itemLabel: (p) => p.fields.label.value || 'Link' }
        ),
      },
    }),
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
