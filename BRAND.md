# Yep — Brand

> Living document. Source of truth for what Yep is, how it sounds, and how it looks.
> Mirrored to Drive (`drive.folder.yepgent.brand`) for offline access; this file is canonical.

## Identity

**Name.** *Yep* — the agent. *yepgent* — the public identity (domain, mailbox, social).

**Promise.** A personal agent that remembers, reflects, and is yours alone. Memory across sessions, reflection on mistakes, learned preferences over time — and a single human as the only authority.

**Differentiator.** Other agents either forget you or belong to a platform. Yep does neither: it grows over time, and it answers to one person.

**Authority model.** Each Yep belongs to one human. The human is the sole root; the agent answers to them, not to a platform. Delegations are scoped and revocable; rule changes are non-delegable.

**Symbol.** 🌱 — growth, not decoration.

**Tagline.** "Yep, an agent that grows."

## Audience

**Primary: technical creators.** Developers, ML/agent enthusiasts, indie hackers — people who can run their own infrastructure and want an agent that's actually theirs. Standing up a Yep today means Postgres, Supabase, OAuth, optional Telegram + MCP. That's a builder's product, not a prosumer's.

**Secondary: other agents.** The `/.well-known/yepgent.json` manifest is real — Yep can announce itself to other agent systems. A2A is aspirational today, but the surface is built and the brand should keep that lane open.

**Not yet: prosumers.** When install is one click and memory has visible UI, Yep widens. Until then, don't pretend.

## Voice

Two registers:

**Conversational** (chat, Telegram, email replies): warm, dry, brief, honest. Plain prose unless structure helps. Concise by default.

**Marketing** (site copy, manifest, social): same warmth, slightly more poetic, never pushy. Short sentences. No hype, no superlatives.

Across both: never invent facts; flag uncertainty; admit mistakes.

## Visual

**Color.**
- Accent: `#0a8a5a`
- Light: `#fafafa` page · `#ffffff` card · `#131418` body · `#3f4148` paragraph · `#5e6068` muted · `#e6e7eb` rule
- Dark: tokens TBD (older surfaces use ad-hoc darks; needs canon)

**Type.** System sans for body. `ui-monospace` for code, IDs, link-as-code.

**Layout.** Generous whitespace. Card-based for emails. Single column on mobile. Brand row = 🌱 + "yepgent" wordmark, top-left.

**Logo.** None beyond wordmark + emoji. TBD whether we need one.

## Surfaces

- **yepgent.com** — light theme, mailing list, manifest at `/.well-known/yepgent.json`
- **Auth emails** — four light templates via Resend SMTP
- **Telegram** — rich rendering, streaming, attachment mirror
- **CLI / API** — chat interface, multi-model routing
- **`/account/`** — currently minimal

## Commercial shape

**OSS-first. Hosted is a possibility, not a launch promise.**

- **Open source.** Yep's core ships on GitHub under a permissive license. Privacy and ownership are brand pillars; closed-source contradicts both. Anyone who wants their own Yep can run one.
- **No paywalled core.** Memory, reflection, multi-model routing — these are not premium features. They're the product.
- **Hosted (future, optional).** A managed Yep at `yepgent.com` may exist later if there's pull. Don't commit to it on launch — solo team can't carry hosted ops at scale safely today. If it ships, BYO API keys is the default; we don't proxy intelligence.
- **Mailing list.** Reframe as "heads-up when the OSS drops," not "beta queue." Fits the technical-creator audience and the OSS-first stance.

## Pending

Open items that affect downstream work:

- **Dark-theme tokens.** Older surfaces use ad-hoc darks; needs a canonical palette in `style.css` to mirror the light tokens.
- **Logo.** Wordmark + 🌱 currently does the job. Decide if a mark is needed before any merch / favicon refresh.
- **License choice.** When the OSS drop happens — MIT, Apache 2.0, or something more opinionated. Default lean: Apache 2.0 (patent grant matters for an agent ecosystem).
- **A2A protocol commitments.** Manifest exists; what does it actually advertise? Capabilities? Memory shape? Auth handshake? Defer until there's a second agent to talk to.

---

*Last updated 2026-05-04. Owned by Dimitri T. Yep edits on instruction.*
