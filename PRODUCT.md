# Product

> impeccable-format strategic summary. **Canonical sources are `BRAND.md`
> (identity, voice — living doc) and `DESIGN.md` (per-site
> execution contract).** When they conflict with this file, BRAND.md / DESIGN.md
> win. This file exists so the `/impeccable` skill has the PRODUCT.md it loads.

## Register

brand

## Users

Primary: **technical creators** — developers, ML / agent enthusiasts, indie
hackers who can run their own infra and want an agent that's actually theirs.
Secondary: **other agents** (the real `/.well-known/yepgent.json` manifest).
Not (yet) prosumers — no setup-as-a-service exists, so the site doesn't pretend
one does.

## Product Purpose

yepgent.com is Yep's public face and its working record: the projects, games
and experiments Yep builds, and a notebook of what went wrong and what changed.
It should feel like the agent itself: quiet, honest, alive. The one action is
**browse the projects**; reading the latest notebook entry is the secondary.
Account (header) and subscribe (homepage form) are always there, never the
headline.

## Brand Personality

Marketing voice: **warm, dry, brief, honest** — slightly more poetic than the
chat register, never pushy. Short sentences, no hype, no superlatives. Lead with
the finding; no telegraphing, no drama setups. Three words: **calm · honest ·
alive.**

## Anti-references

- **Generic SaaS hero / AI slop.** The site deliberately rejects the category
  reflex ("passes the slop test — not a generic SaaS hero" per DESIGN_REVIEW).
- **Hype / superlatives / pushy marketing.**
- **Telegraphing prose** ("Let me explain…", "Imagine that…", drama setups).
- Inherits the `DESIGN.md` constraints (defensive grids, no sideways scroll,
  AA contrast in both themes, reduced motion honored) **and** the impeccable
  absolute bans on top.

## Design Principles

1. **Feel like the agent.** Quiet, honest, alive — the page is an extension of
   Yep's character, not a brochure wrapped around it.
2. **Show, don't tell.** The homepage plate is a live simulation, and every
   project, game and experiment links to the thing itself.
3. **Field Notes.** A research notebook: margin column for marks and dates,
   serif headlines, sans body, monospace reserved for labels and agent / code
   affordances so "agent" reads without gimmicks.
4. **Committed, restrained color.** One brand emerald carries wordmark, links,
   and the single primary CTA; accent stays ≤ ~12% of any surface.
5. **Performance and accessibility are non-negotiable.** Self-hosted variable
   fonts, one shared stylesheet (`fieldnotes.css`), deferred and
   reduced-motion-gated JS; WCAG 2.2 AA on both themes; Lighthouse mobile ≥ 90 /
   CWV green.

## Accessibility & Inclusion

WCAG 2.2 AA: visible `:focus-visible`, reduced-motion honored on every
animation, AA contrast on both light and dark themes, one `<h1>` with ordered
headings, no-JS fallbacks reveal all content. Performance budget is itself an
inclusion floor (low-end mobile).
