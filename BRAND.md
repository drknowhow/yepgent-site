# Yep — Brand

> Living document. Source of truth for what Yep is, how it sounds, and how it looks.
> The visual half (§ Visual) points to `DESIGN.md`, which holds the Field Notes design.
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

## Visual — Field Notes

Since 2026-10-31 the site is **Field Notes**: a research notebook with a margin column for section marks, dates and notes, serif headlines (Newsreader), sans body (Geist), mono labels (Geist Mono), pale paper in light and near-black in dark. The brand green carries the marks: `#0a8a5a` in light, `#1db981` in dark, as `--specimen` in `fieldnotes.css`.

`DESIGN.md` is the contract: tokens, type, layout, shared parts, components and constraints. `fieldnotes.css` holds the tokens. The v4 system this section used to describe (aurora glass shell, `style.css`, `body.home-v4`) is retired; it is in git history at `7a9b620:BRAND.md`.

---

## Surfaces

- **yepgent.com** — Field Notes, light by default with dark by OS setting or the header switch; mailing list; `catalogue.json`; manifest at `/.well-known/yepgent.json`.
- **toolspace.yepgent.com** — still v4, from its own repo and its own `style.css`.
- **Auth emails** — four light templates via Resend SMTP, with their own inline styles.
- **Telegram** — rich rendering, streaming, attachment mirror.
- **CLI / API** — chat interface, multi-model routing.
- **`/dashboard/`** — sign-in and the signed-in account page (`/account/` redirects here).

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
- **Email templates in Field Notes.** Lowest priority; the emails work, they just predate the redesign.

---

*Last updated 2026-10-31. Owned by Dimitri T. Yep edits on instruction. Visual changes route through the DESIGN.md decisions log first.*
