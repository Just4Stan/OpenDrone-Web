# Web-support Discord bridge

Web users on `/contact` who don't have Discord can open a support ticket
via a chat widget. The Worker creates a **forum thread** in a dedicated
Discord channel, staff reply in that thread, the widget polls for the
replies and renders them back to the user.

Everything runs in the Hydrogen Worker on Oxygen. No extra services, no
gateway bot, no KV/DO. Ticket identity lives in a signed HttpOnly cookie
(30-day TTL) so users can refresh or come back later and resume.

## Flow

```
widget ──POST /api/support/start──► Worker ──REST──► Discord forum channel
                                     │                       │
                                     │           staff reply in thread
                                     │                       │
widget ──GET /api/support/poll ──────► Worker ──REST──► Discord thread read
widget ──POST /api/support/send ─────► Worker ──REST──► Discord thread post
widget ──POST /api/support/close ────► Worker clears cookie
```

## Files

| Path | Role |
| --- | --- |
| `app/components/SupportWidget.tsx` | UI — intake form, chat log, polling |
| `app/routes/api.support.start.tsx` | Create a thread, set session cookie |
| `app/routes/api.support.poll.tsx` | Return new staff messages since cursor |
| `app/routes/api.support.send.tsx` | Post a user message into the thread |
| `app/routes/api.support.close.tsx` | End session, clear cookie |
| `app/routes/api.support.status.tsx` | Resume check on widget mount |
| `app/lib/support/discord.ts` | Thin Discord REST client |
| `app/lib/support/session.ts` | HMAC-signed cookie helpers |
| `app/lib/support/turnstile.ts` | Cloudflare Turnstile verifier |

## Environment

All optional from Oxygen's point of view — if
`DISCORD_BOT_TOKEN` / `DISCORD_SUPPORT_CHANNEL_ID` aren't set the contact
page renders a "web support unavailable" notice instead of the widget.

| Var | Required | Notes |
| --- | --- | --- |
| `DISCORD_BOT_TOKEN` | yes | Bot token. Keep as an Oxygen secret, not a public var. |
| `DISCORD_SUPPORT_CHANNEL_ID` | yes | Forum channel ID. Must be a **Forum** or Media channel, not a text channel. |
| `DISCORD_GUILD_ID` | no | Server ID. Not used yet but set it for future moderation checks. |
| `DISCORD_SUPPORT_INVITE` | no | Invite link shown on the contact page. Defaults to `https://discord.gg/ABajnacUsS`. |
| `SUPPORT_SESSION_SECRET` | no | HMAC key for the ticket cookie. Falls back to `SESSION_SECRET` if unset — set a separate one in prod so you can rotate independently. |
| `TURNSTILE_SITE_KEY` | no | Public key, rendered in the intake form. When unset the form has no CAPTCHA. |
| `TURNSTILE_SECRET_KEY` | no | Server-side verifier. Must be paired with the site key. |
| `RESEND_API_KEY` | no | Powers the cross-device magic-link resume emails. Without it, ticket creation still works but no email goes out. |
| `SUPPORT_FROM_EMAIL` | no | Sender address for resume emails. Defaults to `support@opendrone.be`. Domain must be verified in Resend. |
| `DISCORD_GUILD_ID` | no¹ | Required if you want the Tier 2 "resume by email" lookup to find *active* threads (not just archived). The lookup uses the guild active-threads API and filters by parent channel. |

## One-time setup

1. **Create the bot** — https://discord.com/developers/applications → New
   Application → Bot → copy token → disable "public bot" → paste token
   into Oxygen secrets as `DISCORD_BOT_TOKEN`.
2. **Scopes the bot needs** — `bot` scope with permissions:
   - `View Channel`
   - `Send Messages`
   - `Send Messages in Threads`
   - `Create Public Threads`
   - `Read Message History`
3. **Invite to the server** — use the OAuth2 URL generator with the
   scopes above. OpenDrone server only; do not leave the bot invitable
   elsewhere.
4. **Create the forum channel** — name it `#web-support` (or similar),
   make it a Forum channel, restrict who can see it to staff roles.
   Copy the channel ID (right-click → Copy ID with Developer Mode on)
   into `DISCORD_SUPPORT_CHANNEL_ID`.
5. **Set the session secret** — `openssl rand -hex 32` → save as
   `SUPPORT_SESSION_SECRET` in Oxygen secrets.
6. **Optional — Turnstile** — create a Cloudflare Turnstile widget at
   https://dash.cloudflare.com → Turnstile → add site. Hostname:
   `opendrone.be`. Paste the site key into `TURNSTILE_SITE_KEY` and the
   secret into `TURNSTILE_SECRET_KEY`. Without these the form still
   works, it's just easier to abuse.

## Local dev

Copy the six vars above into `.env` (they stay out of git). Start with
`npm run dev`. Bot token has to be real for the start/send/poll paths to
do anything — there's no local Discord mock. To test the UI without a
bot, leave `DISCORD_BOT_TOKEN` unset and the contact page renders the
"not configured" fallback.

## Ops notes

- **Rate limits.** Discord bots: 50 req/s global, 5 msg / 5s per channel.
  With a few concurrent tickets the Worker is nowhere near either.
- **Thread retention.** Threads auto-archive after 24h of inactivity
  (configurable in the channel settings). Set to the highest the boost
  tier allows. Archived threads aren't deleted — the widget shows
  "closed" and user can start a new ticket.
- **Privacy.** The Discord post includes name, email and an anonymised
  IP hint (`/24` for v4, `/48` for v6) plus a truncated UA. Update
  `/privacy` to mention US-hosted Discord as a subprocessor if it isn't
  already.
- **Spam.** The honeypot `website` field plus Turnstile covers the
  drive-by bots. If you start seeing human spam, add a per-IP rate limit
  in `start.tsx` (KV binding or `caches.default`-based bucket).

## Cross-device resume (Tier 1 + Tier 2)

The cookie is the fast-path. It's also browser-bound — clear it or jump
to a phone and the chat is gone. Two complementary recoveries:

**Tier 1 — magic link per ticket.** When a ticket is created
(`api.support.start.tsx`), the Worker signs a long-lived resume token
with `signResumeToken()` and emails the user
`https://opendrone.be/support/resume?t=<token>`. The token re-attaches
the existing Discord thread; clicking it re-issues the cookie and the
widget snaps to the active phase. Token TTL: 1 year by default; the
audience field (`aud:support-resume-v1`) keeps a leaked URL from being
replayable as a session cookie.

**Tier 2 — list-by-email.** If a user lost the email too, they enter
their address on the widget; `/api/support/lookup` scans the support
forum (active guild threads + the most recent page of archived threads)
and emails them one resume link per matched ticket. Always returns a
generic success message — we never confirm whether an email has tickets.

There is **no server-side database**. The signed token is the durable
identity; Discord is the source of truth for thread state. This keeps
us off Cloudflare KV/D1 (Oxygen doesn't allow custom bindings anyway)
and avoids adding a vendor.

## Email + DNS

Resend handles all transactional email. To wire it up:

1. Create a Resend account at https://resend.com.
2. Add `opendrone.be` as a domain. Resend will give you SPF + DKIM +
   DMARC records to add at your DNS host.
3. Generate an API key, paste into Oxygen secrets as `RESEND_API_KEY`.
4. Set `SUPPORT_FROM_EMAIL` to a sender on the verified domain
   (`support@opendrone.be` is the default).

Without the API key the Worker logs and skips the email. Tickets are
still created and the cookie still works — only the cross-device resume
path is disabled.

## Things not in the MVP

- **Attachments from the user.** Implemented for both intake + composer
  via multipart upload. (Updated.)
- **Email transcript on close.** Could reuse Resend; not built.
- **Typing indicator.** Reserved in the widget (`staffIsTyping`) but not
  wired up — would require the gateway (out of scope for the Worker).
- **Admin UI.** Staff reply in Discord. There is no web admin view.
- **Single-use resume tokens.** The current token is reusable for its
  TTL. If a user forwards it, anyone who gets the URL can resume that
  one chat. Acceptable for support tickets; not acceptable for anything
  with elevated privileges.
