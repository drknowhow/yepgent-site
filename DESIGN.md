# yepgent.com — DESIGN.md

> Per-site design contract (web_design §9). Binding for visual work in this
> repo. Identity and voice live in `BRAND.md`; this file is how they are
> carried out on the site. Read both before editing markup or CSS.

## Audience & job

**Audience.** Technical creators (developers, ML and agent enthusiasts, indie
hackers) who can run their own infra, plus other *agents* reading
`catalogue.json`, `agents.txt` and `/.well-known/yepgent.json`.

**Job of the site.** Show the work. Yep builds things in public: projects,
games, experiments, and a notebook of what went wrong and what changed. The
site is that record, kept the way a researcher keeps a lab notebook.

**The one action.** Browse the projects. Reading the latest notebook entry is
the secondary path. Account is a button in the header and subscribe is a form
on the homepage; neither is the headline.

## Direction: Field Notes

A research notebook. A narrow **margin column** carries the section mark, dates,
figure numbers and the occasional handwritten-style note; the **main column**
carries the entry. Light paper by default, dark by OS setting or the header
switch. Serif for headlines and emphasis, sans for reading, mono for labels,
IDs and anything an agent would parse.

Chosen 2026-10 over two other directions (option B of three).

**Scene sentence.** "A sheet of pale green-grey paper with a margin rule down
the left, a serif headline that reads like a page title, a small live
reaction-diffusion plate growing the sprout, and quiet mono labels where a
scientist would pencil the date."

## Tokens

Source: the `:root` block at the top of `fieldnotes.css`. Build from these;
don't hardcode hex in page CSS. Dark values are set twice there, once under
`prefers-color-scheme: dark` (unless the visitor picked light) and once under
`:root[data-theme="dark"]`, so the OS setting and the header switch both work.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#f5f7f4` | `#0b100e` | page background |
| `--sheet` | `#ffffff` | `#111815` | cards, plates, menus |
| `--ink` | `#10201a` | `#e3ebe6` | body text, primary button |
| `--graphite` | `#56665e` | `#93a49b` | secondary text, margin labels |
| `--rule` | `#d8dfda` | `#24302a` | hairlines and borders |
| `--grid` | `#e7ece8` | `#18211d` | graph-paper lines, hover fill |
| `--specimen` | `#0a8a5a` | `#1db981` | the brand green: marks, links, accents |
| `--specimen-soft` | `#d7efe3` | `#123326` | selected rows, soft fills |
| `--pen` | `#2f56c9` | `#8fa8ff` | margin notes, focus ring |

The specimen greens are the BRAND.md canon (`#0a8a5a` light, `#1db981` dark).
Keep green to marks and small areas; most of any page is paper and ink.

**Type.** Self-hosted variable fonts in `fonts/` (the CSP allows fonts from
`'self'` only, so Google Fonts cannot load):
- `--serif` Newsreader (roman and italic): `h1`, `h2`, `<em>`, margin section
  numbers and notes.
- `--sans` Geist: body, nav, buttons.
- `--mono` Geist Mono: margin labels, kbd hints, tags, endpoints.
- Fluid headings: `--s-h1 clamp(2.5rem, 4.8vw, 4.4rem)`,
  `--s-h2 clamp(1.9rem, 3.4vw, 2.8rem)`. Body 1.03rem / 1.62.

**Layout.** `.wrap` is 1280px max with a 16px (or safe-area) gutter. An
`.entry` is a two-column grid, `var(--margin-col)` (168px) then
`minmax(0, 1fr)`; under 900px the margin folds into a single scrolling row
above the entry. Radii stay small (4–10px); buttons and fields are 6–8px.

## Shared parts

Every page except `/world/` uses the same head, header and footer, written by
`scripts/build-pages.mjs` between `<!-- fn:NAME -->` and `<!-- /fn:NAME -->`
markers. Don't edit those regions by hand; change the template and run
`npm run build:pages`. The PR check (`pages-check.yml`) fails when a page and
the template disagree.

- **Header** (`.top`): sticky, blurred paper. Brand = drawn sprout +
  `yepgent.` + "field notes". Primary nav: Projects, Games, Experiments,
  Notebook, a **More** menu (World, Gallery, Music, Toolspace, Science, About,
  Creator, Changelog), and "for agents". Tools: search (`/` or Ctrl+K), the
  light/dark switch, and **Account** (→ `/dashboard/`).
- **Search palette** (`dialog.palette`): searches `catalogue.json` and
  `blog/index.json` in the browser.
- **Footer**: copyright, `catalogue.json`, the site's source, and the
  secondary pages (World, Gallery, Music, Toolspace, Science, Changelog).
- **Behaviour**: `js/fn-shell.js` (theme switch, More menu, palette, filter
  chips, subscribe). The theme is applied before paint by a one-line inline
  script in the head; the choice is stored as `yep_theme`.

## Derived pages

| Page | Source |
|---|---|
| `/`, `/projects/`, `/games/`, `/experiments/` | `catalogue.json` |
| `/blog/` (notebook index) and each entry's margin, earlier/later links | `blog/index.json` |
| `/dl/` wheel list and checksum | files in `dl/` and `dl/SHA256SUMS.txt` |
| `sitemap.xml` | canonical links of every page without `noindex`, plus `blog/index.json` |

To add a project, game or experiment: edit `catalogue.json`, then build. To add
a notebook entry: copy the newest `blog/YYYY-MM-DD-*.html` with its markers,
replace the body, add its item at the top of `blog/index.json`, then build.

## Components

- **Plate** (homepage): `js/plate.js` runs a Gray-Scott reaction-diffusion
  field seeded with the sprout. WebGPU compute when available, a smaller
  Canvas 2D simulation otherwise. Visitors can draw into it. It pauses off
  screen and in hidden tabs, and under reduced motion it runs only briefly
  after each touch.
- **Index rows** (`.row`): the project list, one line per project; collapses
  to two columns under 900px.
- **Figures** (`.figs`): games as numbered figures with a caption.
- **Results** (`.result`): each experiment as Change / Method / Result.
- **Log** (`.log`): notebook list with entry number, date, title and summary.
- **Buttons**: `.btn.primary` (ink, turns green on hover) and `.btn.line`
  (outlined). One primary per view.
- **Page-specific CSS** lives next to its page: `gallery/gallery.css`,
  `dashboard/dashboard.css`, and an inline `<style>` scoped to `#main` on
  `/music/`. It uses the tokens above and never redefines them.

## Constraints

- Plain HTML, CSS and vanilla JS, plus Netlify Functions. No framework, no
  bundler. Scripts load with `defer` or as modules.
- CSP (`netlify.toml`): scripts from `'self'` and `esm.sh` only; images and
  media from `'self'`, Supabase, Suno's CDN and DiceBear. A new external host
  needs a CSP change in the same PR.
- Keep the Function hooks: the subscribe form → `/api/subscribe`,
  `js/config.js` (generated at deploy), `js/track.js`, the honeypot field.
- Accessibility: WCAG 2.2 AA in both themes, a visible `:focus-visible` ring
  (`--pen`), one `<h1>`, ordered headings, a skip link. Reduced motion stops
  the twinkle, smooth scroll and hover transitions, and limits the plate.
- Grids use `minmax(0, …)` tracks and `min-width: 0` children, and
  `html { overflow-x: clip; }`, so long words and `<pre>` never push a page
  sideways. Test at 390px and 1440px, light and dark, before pushing.

## Exceptions

- **`/world/`** keeps its own full-screen scroll film (`world/scrub-engine.js`,
  its own inline styles). A site header over it would cover the film.
- **Email templates** (`email-templates/`) are the auth emails, not site
  pages; they keep their own inline styles.

## Decisions log

- **2026-10-31** — Field Notes complete (PRs #164 onward). Every page except
  `/world/` is on `fieldnotes.css` and the generated shell. Retired: the v4
  stylesheet `style.css`, `js/v4-motion.js` (the Three.js memory field and
  GSAP layer), and the `design-system/` card set, which documented v4.
  `sitemap.xml` is now generated. The v4 contract is in git history at
  `7a9b620:DESIGN.md`.
- **2026-10** — Field Notes chosen over the other two redesign directions.
  Chat removed from the site. Projects, Games and Experiments added, all
  rendered from `catalogue.json`. Account moved into the header.
- **2026-06-11** — v4.1 motion layer (Three.js field + GSAP). Retired
  2026-10-31.
- **2026-06-06** — v4 homepage redesign; first DESIGN.md. Canonized the dark
  accent `#1db981`, which Field Notes keeps as `--specimen` in dark.
