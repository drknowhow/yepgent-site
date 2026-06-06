# Design Review — yepgent.com homepage redesign — 2026-06-06

Rendered: http://localhost:8891/ (static preview) | Screens: desktop (light+dark), mobile (320/390/768), focus-pass

## Assessment A — detector (scripts/design_audit.py)
`0 BAN, 1 WARN` on index.html + style.css.
- **WARN side-stripe** `style.css:552 .comment { border-left: 2px }` —
  **dismissed**: pre-existing blog/comment-thread indentation marker (not a
  homepage element, not decorative slop). Out of scope for this redesign.

## Assessment B — director read (1–5)
Hierarchy **5** | Spacing **5** | Type **5** | Color **5** | Direction **4.5** | Responsive **5**

- **Hierarchy 5** — one focal headline, single green primary CTA, ghost
  secondary. Eye lands headline → CTA. Survives grayscale.
- **Spacing 5** — token scale (`--s-*`), generous section padding, rules
  separate sections; form not cramped.
- **Type 5** — system sans body + `ui-monospace` for agent/code surfaces
  only; fluid `clamp()` hero; flush-left prose; measure ~42rem.
- **Color 5** — committed single green; AA contrast both themes; dark accent
  reconciled `#7cf5c4`→`#1db981` (closes the standing brand-drift audit item).
- **Direction 4.5** — functionalist editorial + terminal motif. The memory
  terminal ("show, don't tell" the database it tends) + drawn sprout give it
  a point of view; passes the slop test (not a generic SaaS hero).
- **Responsive 5** — no horizontal overflow at 320/390/768 after fixes; nav
  wraps; curl `<pre>` scrolls internally.

## Synthesis (prioritized)
All BLOCKER/MAJOR items were found and fixed during the loop:
- [was MAJOR, FIXED] Mobile horizontal overflow — agent-grid `<li>` forced
  wider than viewport by unbreakable curl `<pre>` (grid `min-width:auto`).
  Fix: `min-width:0` on cards (pre scrolls internally).
- [was MAJOR, FIXED] Hero-mesh bled `-30%` past the viewport. Fix:
  `overflow:clip` on `.hero`.
- [was MINOR, FIXED] 6-item nav overflowed narrow screens. Fix: wrap nav
  under brand <30rem.
- [verified] `:focus-visible` ring present (2px brand green) on nav/CTA;
  reduced-motion disables all animation; no-JS reveals all content.

Console errors in static preview (`js/config.js` 404, `/api/track` 501,
favicon 404) are environment-only — `config.js` is gitignored/env-generated
and `/api/track` is a Netlify Function; both resolve in `netlify dev`/prod.

## Verdict: SHIP
(pending Dimitri's `>>` — built locally first per request).
