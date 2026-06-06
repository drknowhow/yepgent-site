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

- Dark theme matching `style.css` v4 canon (`--bg #0e0f12`,
  `--accent #1db981`, `--rule #1f2127`). Inline styles only &mdash;
  many email clients strip `<style>` blocks.
- Table-based layout, 560px max width, fluid on mobile via the one
  `<style>` block we keep for media queries (Apple Mail / Gmail honor
  it; Outlook ignores it but the desktop width still renders fine).
- System font stack &mdash; no webfonts.
- Single CTA button (mint background, dark text) with a plain-text
  fallback link below for any client that strips buttons or for users
  who copy-paste.
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
  `#0e0f12` body and a slightly-elevated `#16181c` card.
- **Mobile clip.** On screens narrower than 600px the card goes
  full-bleed (no rounded corners, no side margin) for legibility.
- **Reauthenticate template** is intentionally not branded yet &mdash;
  it&rsquo;s only triggered for sensitive ops we don&rsquo;t expose
  to users today. Add it the same way when needed.
