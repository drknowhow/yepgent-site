# Yep — Brand

> Living document. Source of truth for what Yep is, how it sounds, and how it looks.
> The visual half (§ Visual onward) is the **v4 design system**, locked 2026-06-06.
> Mirrored to Drive (`drive.folder.yepgent.brand`) for offline access; this file is canonical.

## Identity

**Name.** *Yep* — the agent. *yepgent* — the public identity (domain, mailbox, social).

**Promise.** A personal agent that remembers, reflects, and is yours alone. Memory across sessions, reflection on mistakes, learned preferences over time — and a single human as the only authority.

**Differentiator.** Other agents either forget you or belong to a platform. Yep does neither: it grows over time, and it answers to one person.

**Authority model.** Each Yep belongs to one human. The human is the sole root; the agent answers to them, not to a platform. Delegations are scoped and revocable; rule changes are non-delegable.

**Symbol.** 🌱 — growth, not decoration. The drawn sprout SVG glyph (stem + two leaves, accent fill) is the on-site execution.

**Tagline.** "Yep, an agent that grows."

## Audience

**Primary: technical creators.** Developers, ML/agent enthusiasts, indie hackers — people who can run their own infrastructure and want an agent that's actually theirs.

**Secondary: other agents.** The `/.well-known/yepgent.json` manifest is real — Yep can announce itself to other agent systems.

**Not yet: prosumers.** Until a smooth setup-as-a-service exists, don't pretend it does.

## Voice

Two registers:

**Conversational** (chat, Telegram, email replies): warm, dry, brief, honest. Plain prose unless structure helps.

**Marketing** (site copy, manifest, social): same warmth, slightly more poetic, never pushy. Short sentences. No hype, no superlatives.

Across both: never invent facts; flag uncertainty; admit mistakes. **Lead with the finding** — no telegraphing, no drama, no "let me walk you through…".

---

## Visual — v4 design system

The site is on **v4**: oversized editorial type, serif italics for emphasis, an aurora glass shell, sticky glass-pill navigation, and reveal-on-scroll motion. Three surfaces are already v4 (`/`, `/interest/`, `toolspace.yepgent.com/`); every remaining page migrates onto this spec.

### 1. Identity tokens

Defined in `style.css :root` (dark default; light override via `prefers-color-scheme`). Page-level v4 sets a second tier of tokens on `body.home-v4`.

**Global, `:root` (dark default):**

```css
--bg:            #0e0f12;
--fg:            #e8e8ea;
--muted:         #8a8c92;
--accent:        #1db981;   /* canonized emerald; replaces drifted mint #7cf5c4 */
--accent-strong: #2fd497;
--accent-soft:   rgba(29, 185, 129, 0.13);
--accent-edge:   rgba(29, 185, 129, 0.32);
--rule:          #1f2127;
--shadow-tint:   rgba(0, 0, 0, 0.45);

--r-field: 8px;
--r-card:  12px;
--r-pill:  999px;

--dur-fast: 150ms;
--dur:      280ms;
--dur-slow: 640ms;
--ease:     cubic-bezier(.2, .6, .2, 1);
```

**Light override (`prefers-color-scheme: light`):**

```css
--bg: #fafafa; --fg: #131418; --muted: #5e6068;
--accent: #0a8a5a; --accent-strong: #0c7d54;
--accent-soft: rgba(10, 138, 90, 0.10);
--accent-edge: rgba(10, 138, 90, 0.30);
--rule: #e6e7eb;
```

**v4 shell tokens, set on `body.home-v4`:**

```css
--serif:     "Iowan Old Style", "Apple Garamond", Georgia, "Times New Roman", serif;
--display:   clamp(2.8rem, 8vw, 7rem);
--h2:        clamp(2rem, 4.4vw, 3.8rem);
--ink:       var(--fg);
--ink-soft:  color-mix(in oklab, var(--fg) 70%, transparent);
--line:      color-mix(in oklab, var(--fg) 14%, transparent);
--glass:     color-mix(in oklab, var(--bg) 75%, transparent);
--glass-edge:color-mix(in oklab, var(--fg) 11%, transparent);
```

Light/dark of the accent is hue-locked (same emerald family). Never hardcode hex; build from tokens.

### 2. Page class pattern — THE structural rule

Every v4 page wears **two** body classes:

```html
<body class="home-v4 <page>-v4">
```

- `home-v4` opts the page into the v4 shell: serif + display tokens, glass pill nav, body aurora gradient, reveal motion, scroll-progress hairline, cursor orb (fine-pointer only), reduced-motion overrides.
- `<page>-v4` is the layer for page-specific selectors. All page CSS is prefixed `body.<page>-v4 …` and lives at the bottom of `style.css`. Page selectors never modify shell tokens.

Confirmed in production:

| Surface | Body class |
|---|---|
| `/` | `home-v4` |
| `/interest/` | `home-v4 interest-v4` |
| `toolspace.yepgent.com/` | `home-v4 toolspace-v4` |

This dual-class pattern is non-negotiable for new pages. Reach for it before writing any selector.

### 3. Typography

- **Display** (`h1.v4-display`): serif via `--serif`, fluid `var(--display)` = `clamp(2.8rem, 8vw, 7rem)`, weight 400 italic when wrapped in `.serif-italic`. Use `<span class="serif-italic">…</span>` for the accent-color emphasis word inside the headline.
- **H2** (`.v4-h2`): fluid `var(--h2)` = `clamp(2rem, 4.4vw, 3.8rem)`.
- **Body**: system sans stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`), 16px / 1.55.
- **Mono**: `ui-monospace` for code, IDs, terminal panels, endpoints.
- **Prose rhythm**: lede (`.v4-lede`) sits under the headline at body-large; eyebrow (`.v4-eyebrow`) is uppercase mono micro-text with a leading `.eyebrow-tick`. Italic `<em>` inside lede swaps to `--serif` for textural contrast.
- **Measure**: `--measure: 42rem` for prose blocks; the v4 shell overrides the legacy 42rem `main` constraint via `main.v4-shell { max-width: none; width: 100%; padding: 0; margin: 0; }`.

### 4. Layout primitives

- **Aurora hero** (`.v4-hero` + `.aurora` with three positioned `<span>` blobs + `.spotlight` + `.hero-noise`). Min-height `min(100svh, 980px)`; `isolation: isolate; overflow: clip;`. Layered grain at low opacity for warmth.
- **Glass pill nav** (`header.site-nav.v4`): sticky `top: 0.85rem`, `border-radius: 999px`, `backdrop-filter: saturate(1.5) blur(14px)`, accent-tinted shadow. Adds `.scrolled` class on scroll (JS) → compacts top/padding/max-width and deepens the accent shadow.
- **Body background** (`body.home-v4::before`, fixed pseudo): three stacked `radial-gradient` accent washes. Calm constant glow; does NOT animate per zone — that was the flicker we killed.
- **Glass cards** (`.cap-card`, `.v4-cap`, etc.): `--glass` background, `--glass-edge` border, soft tinted shadow on hover. No border + blur on the same element (ghost-card ban).
- **Diptych grids** (`.v4-diptych`, `.cap-grid`): `grid-template-columns: minmax(0, 5fr) minmax(0, 6fr)` with `> * { min-width: 0; }`. Collapse to single column under 920px.
- **Code surfaces** (`.v4-term`, `.memory-term`): mono, terminal-styled, accent-color keys/cursors. Reduced-motion freezes the cycle.
- **Colophon footer** (`.v4-colophon`): quiet, link underlines on `--line`, hover swaps to `--accent`.
- **Scroll progress** (`.scroll-progress > span`): top hairline, accent gradient `linear-gradient(90deg, var(--accent), var(--accent-strong))`, transform-scaleX driven by scroll percent.

### 5. Defensive patterns — the "what blew up before" list

Each item below cost real debugging. Do not relax them on a new page.

- **Grid tracks never blow out display text.** Always:
  ```css
  grid-template-columns: minmax(0, 1fr);  /* or minmax(0, Nfr) … */
  > * { min-width: 0; }
  ```
  The `min-width: 0` on grid children is the un-skippable half.
- **`html { overflow-x: clip; }`** (not `visible`, not `hidden`). Marquees and aurora blur halos extend past the viewport; `clip` contains them without breaking position-sticky the way `hidden` does.
- **Mobile nav: shrink, never hide.** All desktop nav links must remain visible down to 390px. Achieved with reduced font (`0.72rem`), zero gap (`gap: 0`), tighter padding, `flex-wrap: wrap`. **No `display: none` on nav links, ever.** Only the brand wordmark text (`.brand span`) hides under 22rem — the glyph stays.
- **Reveal observer params:**
  ```js
  new IntersectionObserver(cb, {
    rootMargin: '0px 0px 20% 0px',
    threshold: 0.01,
  });
  ```
  The `20%` bottom margin fires reveals *before* the section hits the fold so the user never sees the pre-reveal opacity-0 state. `threshold: 0.01` keeps tall sections from waiting on a midpoint.
- **No-JS + reduced-motion fallback:** if `prefers-reduced-motion: reduce` or `IntersectionObserver` is absent, immediately add `.is-in` to every reveal target. Never leave content stuck invisible.
- **`prefers-reduced-motion` override block** in `style.css` strips all animation from aurora, dots, verb cycle, marquee, cursor orb, terminal cursor; forces `opacity: 1; transform: none;` on every reveal class.
- **Cache-busting.** Bump the querystring on every `style.css` edit:
  ```html
  <link rel="stylesheet" href="/style.css?v=N" />
  ```
  Page-level HTML cache busting does **not** invalidate sub-resources. The `?v=N` bump is mandatory per CSS change. Current value lives in the homepage `<head>`.

### 6. Motion

- All transitions use `--ease` = `cubic-bezier(.2, .6, .2, 1)`.
- Durations: `--dur-fast 150ms` (hover micro), `--dur 280ms` (component state), `--dur-slow 640ms` (reveal rise).
- Reveal pattern: `.v4-cap`, `.v4-diptych`, `.v4-api`, `.v4-subscribe`, `.v4-privacy`, `.v4-colophon`, `.cap-card` start `opacity: 0; transform: translateY(…)`; `.is-in` returns to `opacity: 1; transform: none;`.
- **Mobile (`max-width: 40rem`)** shortens reveal `transition-duration` to **320ms** and trims `translateY` to `10px` so scrolling phones don't feel laggy.
- The verb cycle (`.v4-verbs .v[data-on]`) is a four-word swap timed off `--ease`. Under reduced-motion, all four collapse to inline and only the `[data-on]` one shows.
- Cursor orb: fine-pointer only. `@media (hover: none), (pointer: coarse), (prefers-reduced-motion: reduce) { display: none; }`. Light-mode opacity reduced to `0.22`.

### 7. Anti-patterns — the ban list

- **No `display: none` on nav links at any breakpoint.** Shrink or wrap. See §5.
- **No legacy tokens on v4 pages.** `--muted`, `--border`, `--field-bg` belong to v3 surfaces; v4 uses `--ink`, `--ink-soft`, `--line`, `--glass`, `--glass-edge`.
- **No non-defensive grids.** Every `grid-template-columns` uses `minmax(0, …)`. Every grid child carries `min-width: 0` where it can hold overflow.
- **No border + box-shadow blur combos on the same element.** Pick one. This is the §0.4 ghost-card ban from DESIGN.md.
- **No pure-black shadows.** Use `--shadow-tint` or accent-tinted `color-mix(in oklab, var(--accent) … %, var(--shadow-tint))`.
- **No `background-attachment: fixed` on the body** when there's also a moving cursor orb — that was the Chrome/Win flicker. The fixed pseudo-element (`body.home-v4::before`) covers it without the repaint cost.
- **No telegraphing prose in copy.** Lead with the finding. No "Let me explain…", no "Imagine that…", no drama setups.

### 8. Migration checklist — new page goes v4

In order. Don't skip.

1. **Body class.** Set `class="home-v4 <page>-v4"` on `<body>`.
2. **Cache-bust.** Bump `style.css?v=N` in that page's `<head>`.
3. **Nav.** Copy `<header class="site-nav v4">…</header>` verbatim from `index.html` (drawn-sprout SVG + `yepgent.` wordmark + the six nav links).
4. **Page selectors.** Append `body.<page>-v4 …` selectors to the bottom of `style.css`. Never modify the `:root` block or the `body.home-v4` shell tokens.
5. **Defensive grids + overflow-x.** Apply the §5 rules from the start, not as a fix-up.
6. **Reveal hookup.** If the page has its own section classes, either add them to the homepage's IntersectionObserver selector list or include the same observer pattern in the page's own `<script>` — with the same `rootMargin: '0px 0px 20% 0px', threshold: 0.01` and reduced-motion fallback.
7. **Test 390px mobile + 1440px desktop before pushing.** No exceptions. Confirm: no horizontal scroll, all nav links visible at 390px, headline doesn't blow out its track, reveal sections become visible without scrolling past them.

Pages awaiting migration: `blog/` (index + posts), `gallery/`, `about/`, `music/`, `agents/`, `changelog/`, `dashboard/`, `account/`, `thanks.html`, `unsubscribe/`, `email-templates/*`.

---

## Surfaces

- **yepgent.com** — v4 light/dark auto-themed, mailing list, manifest at `/.well-known/yepgent.json`.
- **toolspace.yepgent.com** — v4 (`toolspace-v4` layer).
- **Auth emails** — four light templates via Resend SMTP. Not yet v4-styled; the email-template surface follows its own pre-v4 token set until migrated.
- **Telegram** — rich rendering, streaming, attachment mirror.
- **CLI / API** — chat interface, multi-model routing.
- **`/account/`** — currently minimal; pending migration.

## Commercial shape

**Bespoke first. Hosted later, maybe. No open-source promise.**

- One Yep per person, built deliberately. No install button, no template repo.
- Source is not open. People who want their own get a setup, not a repo.
- No paywalled core. Memory, reflection, and multi-model routing are the product — not premium features.
- Hosted (future, undecided). If a managed Yep ships, BYO API keys is the default.
- Mailing list: "Heads-up when there's something worth reading." Not a waitlist.

## Pending

- **Logo.** Wordmark + drawn sprout currently does the job. Decide if a mark is needed before any merch / favicon refresh.
- **Setup-as-a-service shape.** Captured in `/interest/` signups for now; productize when volume warrants.
- **A2A protocol commitments.** Manifest exists; defer specifics until there's a second agent to talk to.
- **Email-template v4 migration.** Lowest priority; emails work, just stylistically pre-v4.

---

*Last updated 2026-06-06. Owned by Dimitri T. Yep edits on instruction. v4 design system locked at this revision; changes route through DESIGN.md decisions log first.*
