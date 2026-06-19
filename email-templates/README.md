# Auth email templates

Branded HTML for the four Supabase auth emails on the yepgent project.
Single source of truth lives here; the deployed copies are pasted into
**Supabase &rarr; Authentication &rarr; Email Templates** (free tier
has no API for templates &mdash; dashboard only).

## Files

| File                 | Supabase template      | Subject line                       |
| -------------------- | ---------------------- | ---------------------------------- |
| `confirm-signup.html`| Confirm signup         | `Confirm your email — yepgent`     |
| `magic-link.html`    | Magic Link             | `Your yepgent sign-in link`        |
| `change-email.html`  | Change Email Address   | `Confirm your new yepgent email`   |
| `reset-password.html`| Reset Password         | `Reset your yepgent password`      |

## Design

- Light v4 editorial, matching the warm-white design-system face:
  body `#fafafa`, white card `#ffffff`, ink `#131418`, committed brand
  green `--accent #0a8a5a`, rule `#e6e7eb`. Inline styles only; many
  email clients strip `<style>` blocks.
- Type: a Georgia serif-italic display headline (the editorial signal,
  email-safe via the system serif), a system-sans body, and monospace
  for the eyebrow and the fallback link. No webfonts.
- A small uppercase mono eyebrow with a green tick sits above each
  headline; the `yepgent.` wordmark carries the one green dot.
- Table-based layout, 560px max width, fluid on mobile via the one
  `<style>` block we keep for media queries (Apple Mail / Gmail honor
  it; Outlook ignores it but the desktop width still renders fine).
- Single green CTA (pill, white text on `#0a8a5a`) with a plain-text
  fallback link below for any client that strips buttons or for users
  who copy-paste. Green stays a minority: the dot, the CTA, the links.
- Preheader hidden div on top &mdash; provides inbox-preview text.
- Footer: `yepgent.com` &middot; `manifest` &middot; `account`, plus a
  one-line tagline ("Yep, an agent that grows.").

## Supabase template variables

These Go-template vars are interpolated server-side by Supabase:

| Variable                | Used in              | Notes                              |
| ----------------------- | -------------------- | ---------------------------------- |
| `{{ .ConfirmationURL }}`| all four             | The clickable link with token.     |
| `{{ .Email }}`          | change-email         | Current email.                     |
| `{{ .NewEmail }}`       | change-email         | Pending email.                     |
| `{{ .Token }}`          | (not used today)     | 6-digit OTP, if you want code-based fallback later. |
| `{{ .SiteURL }}`        | (not used today)     | Project Site URL.                  |

If you want to add code-based fallback (a 6-digit OTP for users to
type instead of clicking), add a styled box rendering `{{ .Token }}`
and a "have a code?" entry box on `/account/`.

## Updating

1. Edit the `.html` file here. Diff is the truth-of-record.
2. In Supabase dashboard &rarr; Authentication &rarr; Email Templates,
   pick the matching template, paste the file body into the HTML
   editor, set the subject line above, **Save**.
3. Send yourself a self-test (e.g. trigger a magic link to your own
   address) to verify rendering before committing changes.

## Known caveats

- **No SVG.** Outlook strips it; we use the &#127793; emoji as a
  consistent cross-client wordmark glyph.
- **No background gradients.** Outlook ignores them; we render a flat
  `#fafafa` body and a white `#ffffff` card with a hairline border.
- **Light-locked.** `color-scheme: light` + `supported-color-schemes`
  are set so clients do not auto-invert the warm-white card into a
  muddy dark approximation.
- **Mobile clip.** On screens narrower than 600px the card goes
  full-bleed (no rounded corners, no side margin) for legibility.
- **Reauthenticate template** is intentionally not branded yet &mdash;
  it&rsquo;s only triggered for sensitive ops we don&rsquo;t expose
  to users today. Add it the same way when needed.
