# @echoguide/docs

Documentation site for EchoGuide, built with Astro and Starlight.

**Live demo:** https://echo-guide-docs.vercel.app/

## Commands

Run from the repo root:

```bash
npm run start:docs
```

Or from this directory:

| Command | Action |
| --- | --- |
| `npm run dev` | Start the dev server on `localhost:4321` |
| `npm run build` | Build the static site to `dist/` |
| `npm run preview` | Serve the built site locally |

## Structure

```
src/
  content/docs/     Pages — each .md/.mdx file becomes a route
    guides/         Task-oriented pages
    reference/      Terse, comprehensive pages
  styles/theme.css  Design tokens and component styling
public/             Static assets served at the root
astro.config.mjs    Site config, sidebar, fonts
```

## Theming

All colour, radius, shadow, and typography decisions live in `src/styles/theme.css`
as custom properties. The `--eg-*` tokens define the palette; the `--sl-*` tokens map
that palette onto Starlight's own variables.

Dark is the primary theme. The light palette is a derived counterpart, and both are
verified against WCAG AA for text and interactive borders. Change a colour in one
place and it propagates everywhere.

## Writing

Pages use Starlight's Markdown and MDX components. Every page needs `title` and
`description` frontmatter — the description is the meta tag and the search result
snippet, so write it for someone who has not seen the page.
