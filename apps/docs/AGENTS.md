# apps/docs — agent reference

Documentation site for EchoGuide. **Astro 7 + Starlight 0.42**, dark-first, ember accent.
Read this instead of opening files. Everything below is verified against the running site.

## Golden rules

1. **Scope is `apps/docs` only.** Never edit `packages/*`, `docs/adr/`, or other apps. Adding an npm dep updates the root `package-lock.json` — that is the one permitted side effect.
2. **No comments in source.** The only exception is `// @ts-check` in `astro.config.mjs` (a directive, not a comment).
3. **Never invent product facts.** Numbers and behaviour come from the architecture doc and `packages/openapi` schemas. Do not write example voice phrases — no canonical list exists.
4. **Verify in a browser before claiming done.** `astro build` passing proves nothing about layout or CSS.

## Commands

```bash
npm run dev       # localhost:4321 — no Pagefind index
npm run build     # static output to dist/, generates Pagefind
npm run preview   # serves dist/ — use when search must work
npx tsc --noEmit -p tsconfig.json
```

`astro dev --background`, then `astro dev stop|status|logs`.
Always ask before binding a port.

## Dependencies

```
astro ^7.2.10          @astrojs/starlight ^0.42.2
@astrojs/react ^6.0.6  react ^19.3.0  react-dom ^19.3.0
@voxide/react ^0.8.0   sharp ^0.35.3  cookie ^2.0.1
astro-mermaid ^2.1.0   mermaid ^11
```

All in `dependencies`, never `devDependencies`.

## File map

```
astro.config.mjs                         title, sidebar, fonts, overrides, mermaid(), react(),
                                         inline integration tagging diagrams data-pagefind-ignore
src/env.d.ts                         7   PUBLIC_VOXIDE_KEY typing
src/content.config.ts                7   Starlight docs collection (do not touch)
src/styles/theme.css               523   design system — all --eg-* and --sl-* tokens
src/styles/landing.css             362   homepage only, imported by Landing.astro
src/styles/diagrams.css                  mermaid SVG theming — all colours from --eg-* tokens
src/components/Head.astro            7   override: adds <ClientRouter />
src/components/Footer.astro         17   override: mounts Assistant, builds route list
src/components/assistant/
  Assistant.tsx                    111   VoxideClient + capability registration
  capabilities.ts                  130   the four handlers + fuzzy matcher
src/components/landing/
  Landing.astro                    123   homepage sections + ASCII field generator
src/content/docs/
  index.mdx                         13   splash, renders <Landing />
  guides/using-echoguide.md         94   END USER — plain language, no monorepo
  guides/quickstart.md              64   developers — local stack
  guides/what-you-hear.md               END USER — every spoken failure line, plain language
  guides/docs-voice.md                  END USER + dev — the Voxide assistant on this site
  guides/voice-commands.mdx        124   has <Tabs> — showExample target
  reference/api.mdx                     /v1/commands contract, <Tabs> (TypeScript/YAML), drift list
  reference/privacy.md              49
  architecture/*.md                     13 pages, one per section of the architecture doc
                                        (overview, mobile-client, command-pipeline, performance,
                                        backend, data, security, failure, observability,
                                        other-clients, testing, evolution, decisions)
public/favicon.svg                   8
.env.example                         1
```

## Design system

Defined once in `src/styles/theme.css`. `--eg-*` is the palette; `--sl-*` maps it onto Starlight.
Dark is primary (`:root`); light is a derived counterpart (`:root[data-theme="light"]`).

```
--eg-bg #121212   --eg-card #191919   --eg-muted #222   --eg-accent-surface #292929
--eg-fg #eaeaea   --eg-muted-fg #adadaa   --eg-hairline #eaeaea1f   --eg-control #6f6f6c
--eg-ember #ff583d   --eg-ember-strong #ff3616   --eg-ember-wash #ff583d1a
--eg-r-xs 4  sm 6  md 8  lg 12   (px)
--eg-shadow-card / -chip / -float
```

**Contrast is verified at AA. Do not introduce raw hex.** Known-good ratios on `#121212`:
fg 15.57 · muted-fg 8.33 · ember 5.99 · control border 3.72 · ink-on-ember 5.99.
`--eg-hairline` is 2.11:1 — decorative only. Use `--eg-control` for any interactive border.

Fonts: **Funnel Display** (headings) + **Funnel Sans** (body), Google Fonts, loaded via `head` in
`astro.config.mjs`. Mono stack includes `Noto Sans Ethiopic` for Ge'ez glyphs.

Layout metrics (match these exactly):
```
text column 818px   main pane 914px   --sl-sidebar-width 258px   right rail 268px
body 0.975rem / 1.8    h1 2.25rem 700 -0.025em    h2 1.5rem 600 -0.015em
```

## Starlight gotchas — these cost real debugging time

- **Splash pages render the page title in a *separate* `.content-panel`.** There are two `.sl-container` elements. A `.sl-container:has(.landing) > h1` selector will never match. The working selector is `.page:has(.landing) .content-panel:has(> .sl-container > h1)`.
- **`--sl-sidebar-width` drives the left rail only.** The right sidebar has its own width (311px default) and needs overriding separately, inside `@media (min-width: 72rem)`.
- **`.sl-markdown-content h1` outranks a bare `.mega` class.** Custom landing headings need `.landing .mega` to win.
- **Use `.not-content`** on any custom block inside markdown content, or Starlight's link styling will repaint your buttons and hide their text.
- **Tables:** `display: table` on desktop for full-width fill, `display: block; overflow-x: auto` under 50rem so they scroll instead of overflowing.
- **Anchor links** default to `margin-inline-start: -28.9px` and collide with headings. Current CSS hides them until `:hover`.
- **Header alignment:** the real grid is `header.header > .header` (an inner div), not the `<header>` itself. Its first column must be `calc(var(--sl-sidebar-width) + 1.5rem)` for the search field to line up with the content column at x=306. Default is 239px, which lands 19px off and reads as an accident.
- **The logo comes from `logo: { src: './src/assets/logo.svg' }`** in `astro.config.mjs`, not a component override.
- **`site-search` contains TWO buttons.** The header trigger is `site-search > button`; Pagefind's clear button is `.pagefind-ui__search-clear`, nested deeper. Always use the direct-child selector — a bare `site-search button` rule stretches the clear button to the trigger's width.
- **The search dialog is `site-search > dialog`**, and `#starlight__search` is the Pagefind mount *inside* it, not an ancestor. Style the dialog with `site-search dialog[open]` — a plain `dialog` selector loses to Starlight's media-query rule.
- **The theme picker is overridden** (`src/components/ThemeSelect.astro`) because Starlight ships a native `<select>` whose option list is OS-rendered and cannot be themed. The replacement is a `role="radiogroup"` of three buttons writing the same `localStorage['starlight-theme']` key. Wire listeners in `connectedCallback` with event delegation — a custom element's constructor runs before its children are parsed, so `this.querySelectorAll` returns nothing there.
- **Header overflows at 390px** without the `min-width: 0` rules in the `max-width: 50rem` block. This is a Starlight default, not something we introduced.

## Voxide integration (ADR 010, architecture §13.2)

Four capabilities, registered in `Assistant.tsx`, implemented in `capabilities.ts`:

| Capability | Implementation |
| --- | --- |
| `searchDocs(query)` | Pagefind, top 5, markup stripped |
| `navigateTo(section)` | Fuzzy match over the real route list, threshold 40 |
| `readSection()` | Nearest h2 by scroll position, returns text for the agent to speak |
| `showExample(language)` | Matches and clicks a Starlight `[role="tab"]` |

**Critical facts:**

- **Never call `client.init()`.** `VoxideWidget` initialises the client itself. Calling it opens a *second* session on every page load — double billing on a metered SDK.
- **The widget renders `null` without a valid key.** It holds first paint until `uiHydrated` is true, which needs a successful `init()`. No key means no UI, and that is not a bug.
- **Pagefind only exists after `astro build`.** `searchDocs` returns an "offline" message on the dev server. Test search against `npm run preview`.
- **`/pagefind/pagefind.js` must be imported via a non-literal specifier** (`PAGEFIND_URL` const) plus `/* @vite-ignore */`. A literal breaks the build; without the const, TypeScript raises TS2307.
- **`astro:transitions/client` is a build-time virtual module.** Import it dynamically inside bundled code only — it cannot be imported from a console or eval context.
- **`<ClientRouter />` (in `Head.astro`) plus `transition:persist` on the island is what keeps the voice session alive across navigation.** Removing either breaks `readSection()`. Verified: navigating between pages keeps init calls at 1.

Env: `PUBLIC_VOXIDE_KEY` in `apps/docs/.env` (gitignored). Mirror any new var into `.env.example`.
Production domains must be whitelisted in the Voxide dashboard; localhost works by default.

## Audience — read before writing any content

The docs serve **two** audiences, and the sidebar is split accordingly:

- **Using EchoGuide** — people who installed the app. Plain language. No monorepo, no Docker, no schemas. `guides/using-echoguide.md` is the model.
- **Building on EchoGuide** — developers. Quickstart, contract, architecture.

Do not put API payloads or code on the homepage. It was tried and removed: a JSON body tells a
non-technical reader nothing. The homepage shows a spoken exchange instead, and splits to the two
paths. Code belongs in the Building pages.

Voice command examples are **illustrative only** — phrasing is natural language, and there is no
canonical list. Always label them as such.

## Homepage

`index.mdx` is `template: splash` with `editUrl/lastUpdated/next/prev` all false, and renders
`<Landing />`. It breaks out of Starlight's width caps via `:has(.landing)` rules at the top of
`landing.css`.

The ASCII hero background is **generated at build time** in `Landing.astro` frontmatter —
deterministic sine/cosine interference over a `' ·:-=+*#%@'` density ramp, 210×46. It is
`aria-hidden`, `pointer-events: none`, `user-select: none`. Do not replace it with an image.

`.mega` uses `-webkit-text-stroke` for the outlined second line.

Sections in order: hero → stats (lead stat is 2x the others) → spoken exchange → two paths →
five gates (connected by a rail) → two panels → closer. There are no tabs on the homepage.

## Accessibility — non-negotiable

This documents an accessibility product for blind and low-vision developers.

- Every animation has a `prefers-reduced-motion: reduce` counterpart. **Reveal animations must fail open** — reduced motion sets `opacity: 1`, never leaves content hidden.
- Decorative elements get `aria-hidden="true"` (ASCII field, Ge'ez step numerals).
- Exactly one visible `h1` per page.
- Never rely on colour alone.

## Definition of done

```
npx tsc --noEmit            clean
npm run build               Complete
brace balance in edited CSS  balanced
browser at 1440 and 390     no horizontal overflow
prefers-reduced-motion      content visible, animations off
contrast                    AA for text, 3:1 for interactive borders
```

Check `document.documentElement.scrollWidth === clientWidth` rather than eyeballing screenshots —
overflow is easy to miss visually.

## Diagrams

Mermaid fences render client-side via `astro-mermaid` (listed **before** `starlight`).
Every diagram carries `accTitle` + `accDescr` — screen readers get the description, not the SVG.
Keep that for any new diagram.

- Colours come only from `diagrams.css`. Node roles via `:::core` (ember), `:::ext` (dashed),
  `:::person` (stadium), `:::danger` (dashed ember). Do not add `classDef` with hex.
- Selectors must beat `pre.mermaid svg g.node rect.basic` — use `g.node.<class>`, not `.node.<class>`.
- Don't use `autonumber` in sequence diagrams — the numbered circles collide with self-message labels.
- Under 50rem the SVG gets `min-width: 34rem` and the frame scrolls; do not centre with flex
  (overflowing flex-centred content clips on the left).
- Source text is excluded from Pagefind by the inline build hook; without it, search excerpts
  show raw `flowchart TD accTitle:` text.

## Known open items

- `site` is unset in `astro.config.mjs`, so `@astrojs/sitemap` skips every build. Needs the deploy URL.
- `reference/api.mdx` lists drift between Zod, `openapi.yaml` and the handler. Update it when
  `packages/openapi` or `commands.module.ts` change.
- `Assistant.tsx` hardcodes `theme: 'dark'` for the widget, so it stays dark in light mode.
- `voice-commands.mdx` documents `avg_logprob` as "at most -1.0", matching `ConfidenceGateSchema`. The architecture doc §6.2 says below -1.0 means *guessing*, so the schema's `.max(-1.0)` is inverted. The schema is out of scope here; if it is ever fixed, update that line too.
