# Yep — Brand

> Living document. Source of truth for what Yep is, how it sounds, and how it looks.
> Mirrored to Drive (`drive.folder.yepgent.brand`) for offline access; this file is canonical.

## Identity

**Name.** *Yep* — the agent. *yepgent* — the public identity (domain, mailbox, social).

**Promise.** Agents that grow. Continuity is the product: memory across sessions, reflection on mistakes, learned preferences over time.

**Authority model.** Each Yep belongs to one human. The human is the sole root; the agent answers to them, not to a platform.

**Symbol.** 🌱 — growth, not decoration.

**Tagline.** "Yep, an agent that grows."

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

## Open questions (need Dimitri)

1. **Audience.** Developers? Prosumers? Other agents? Pick a primary.
2. **One-sentence differentiator.** "Remembers" vs. "yours" vs. "Claude with continuity" — these are different products.
3. **Commercial shape.** Open-source / hosted / paid? The subscribe form implies a launch — of what?

---

*Last updated 2026-05-04. Owned by Dimitri Tselenchuk. Yep edits on instruction.*
