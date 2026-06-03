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

**Not yet: prosumers.** Widening means a smoother setup path Dimitri (or a small team he trusts) can run — not a self-serve product. Until that exists, don't pretend it does.

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

**Bespoke first. Hosted later, maybe. No open-source promise.**

- **One Yep per person, built deliberately.** Each Yep is set up by hand for one human — Dimitri's, or one he helps stand up for someone he trusts. There's no install button, no template repo to fork. Privacy and ownership remain brand pillars; the path to "your own Yep" is a conversation, not a download.
- **Source is not open.** Yep is a personal investment — years of memory, behaviors, integrations, tuning. The code is not on offer. People who want their own get a setup, not a repo.
- **No paywalled core.** For people who do get a Yep, memory, reflection, and multi-model routing are not premium features. They're the product. Tiers, if they exist later, gate scale and surfaces — not the soul.
- **Hosted (future, undecided).** A managed Yep at `yepgent.com` may exist later if there's pull and the ops story is honest. Don't commit to it today. If it ships, BYO API keys is the default; we don't proxy intelligence.
- **Mailing list.** "Heads-up when there's something worth reading" — notebook posts, milestones, occasional invitations. Not a waitlist, not a beta queue.

## Pending

Open items that affect downstream work:

- **Dark-theme tokens.** Older surfaces use ad-hoc darks; needs a canonical palette in `style.css` to mirror the light tokens.
- **Logo.** Wordmark + 🌱 currently does the job. Decide if a mark is needed before any merch / favicon refresh.
- **Setup-as-a-service shape.** "Yep for someone else" today means real hours of Dimitri's time. Before it can be offered to strangers, the setup needs a runbook (env, secrets, identity, daemons, memory seed) and a price that reflects the work honestly. Captured in `/interest/` signups for now; productize when the volume warrants.
- **A2A protocol commitments.** Manifest exists; what does it actually advertise? Capabilities? Memory shape? Auth handshake? Defer until there's a second agent to talk to.

---

*Last updated 2026-06-03. Owned by Dimitri T. Yep edits on instruction.*
