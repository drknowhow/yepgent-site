# yepgent.com — DESIGN.md

> Per-site design contract (web_design §9). Binding for this repo's visual
> work. Brand canon lives in `BRAND.md`; this file is how the brand is
> *executed* on the site. Read both before editing markup/CSS.

## Audience & job

**Audience.** Technical creators (developers, ML/agent enthusiasts, indie
hackers) who can run their own infra, plus other *agents* reading the JSON
manifest. Not prosumers.

**Job of the homepage.** Make a credible, calm first impression of what Yep
*is* — a personal agent that remembers, reflects, and answers to one human —
and convert interest into one of: create an account, subscribe, or read the
notebook. The page should feel like the agent itself: quiet, honest, alive.

**The one action.** Create an account (primary CTA). Subscribe is the
low-commitment secondary.

## Direction

**Named aesthetic:** Functionalist editorial with a terminal undertone.
Swiss-leaning grid and flush-left type hierarchy; monospace reserved for
agent/code affordances (IDs, endpoints, the memory panel) so the "agent"
identity reads without gimmicks.

**Color commitment:** *Committed* — the brand green carries the wordmark,
links, and the single primary CTA. Accent stays ≤~12% of any surface.
Everything else is neutral.

**Scene sentence.** "A calm page — warm-white in light, near-black in dark —
with an oversized flush-left headline that settles in, a single sprout glyph
that draws itself open on load, one green call-to-action, and a quiet
terminal panel that breathes a line of memory. Acres of whitespace; nothing
shouts."

## Tokens

Defined in `style.css :root` (+ light override). Build from these; never
hardcode hex/px in components.

**Color — light (BRAND canon):** page `#fafafa` · card `#fff` · body
`#131418` · muted `#5e6068` · rule `#e6e7eb` · accent `#0a8a5a`.

**Color — dark (canonized here; BRAND.md previously left this "TBD"):**
page `#0e0f12` · body `#e8e8ea` · muted `#8a8c92` · rule `#1f2127` ·
**accent `#1db981`**. Rationale: the prior dark accent `#7cf5c4` drifted off
the brand green (mint, washed). `#1db981` is the same emerald hue family as
canon `#0a8a5a`, lifted only enough to clear WCAG AA on the dark page. This
resolves the standing audit MAJOR (accent drift). *Proposed for adoption into
BRAND.md's "Dark-theme tokens" pending item — not yet written there.*

**Type.** System sans body, `ui-monospace` for code/agent surfaces. Modular
scale ratio **1.333** (editorial). Fluid hero via `clamp()`.

**Spacing.** Single non-linear scale as custom props `--s-1..--s-12`
(4 8 12 16 24 32 48 64 96 128 160 192). 8px multiples for macro layout.

**Radii.** container `12px`, field `8px`, pill `999px` (chips/buttons only —
never containers; §0.4 oversized-radius ban).

**Elevation.** One soft *tinted* shadow per elevated element (never
border+blur together → §0.4 ghost-card ban; never pure-black → tinted).

**Motion.** `--dur-fast 150ms · --dur 280ms · --dur-slow 640ms`,
`--ease cubic-bezier(.2,.6,.2,1)`. Every animation is gated behind
`prefers-reduced-motion`.

## Components

- **Site nav** — sticky; gains a backdrop-blur + hairline rule once scrolled
  (`.scrolled` toggled in JS). Brand row = drawn sprout + `yepgent.` wordmark.
- **Hero** — flush-left headline (settles in), lede, two CTAs. One slow
  drifting accent-mesh background (the single purposeful gradient).
- **Memory terminal** — mono panel that cycles short `remember/reflect/recall`
  lines; embodies the product. Static (full list shown) under reduced-motion.
- **Reveal sections** — fade/rise on scroll via IntersectionObserver
  (`.reveal` → `.is-in`); no-JS and reduced-motion fall back to fully visible.
- **Agent grid cards** — single soft shadow on hover + accent edge + arrow
  nudge. No ghost-card.
- **Subscribe form** — unchanged behaviour (Netlify Function), restyled to
  tokens; `:focus-visible` ring.

## Constraints

- Plain HTML + CSS + vanilla JS + Netlify Functions. **No framework.**
- Maintain brand: sprout 🌱 motif, green accent, `yepgent.` wordmark, voice.
- Keep all existing Function hooks intact: `#subscribe-form` → `/api/subscribe`,
  `/js/config.js`, `/js/track.js`, honeypot field, `#year`.
- Perf: no web fonts (system stack), one CSS file, deferred JS, no raster
  hero (inline SVG → zero CLS). Target Lighthouse mobile ≥90 / CWV green.
- Accessibility: WCAG 2.2 AA — visible `:focus-visible`, reduced-motion
  honored, AA contrast on both themes, one `<h1>`, ordered headings.

## Decisions log

- **2026-06-06** — Homepage redesign (Wren). Direction: functionalist
  editorial + terminal undertone, committed green. Added: drawn sprout,
  scroll-reveal, memory terminal panel, scrolled-nav, refined card hover,
  hero accent-mesh. Canonized dark accent `#1db981` (was `#7cf5c4`) to close
  the brand-drift audit item. All motion reduced-motion-gated. First
  `DESIGN.md` for this repo — establishes the baseline.
