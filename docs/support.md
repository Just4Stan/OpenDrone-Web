# OpenDrone support system

End-to-end guide to how customers reach us, where staff replies happen,
and how the wires connect. Read this first before digging into the
code-level README at `app/lib/support/README.md`.

---

## TL;DR for staff

1. **Watch the support forum channel in Discord** — every web ticket
   opens as a forum thread there.
2. **Reply in the thread.** Anything you type lands in the customer's
   web chat within 4 seconds.
3. **When the answer is final, react to your message with 📧.** That's
   the trigger that emails the customer. Without it: no email, just
   the live web reply.
4. **Don't post sensitive identifiers.** Email, order number, and
   Shopify customer ID are pinned in a private `#support-staff` channel
   already — pull them from there, not by asking the customer to retype.
5. **Close = customer-side action.** When the customer clicks "End
   ticket" they get a feedback survey. The thread auto-archives.

---

## What the customer sees

### `/contact`

Marketing page. Three blocks, in order of how loud they shout:

- **Discord widget** (primary) — official `<iframe>` to the OpenDrone
  server. Customers can join straight from here.
- **No Discord? Open a ticket** (secondary) — a single button that
  links to `/support`.
- **Direct contact** (tertiary) — phone, email, security disclosure
  link, business hours.

If the customer is signed in and already has an open ticket, the
"open a ticket" tile is replaced by a banner pointing them at the
existing thread. We **do not** present "open new ticket" as a primary
CTA when an open ticket exists — soft single-thread default.

### `/support`

Three states based on auth + ticket state:

| State | Trigger | What renders |
|---|---|---|
| Signed-out | No customer session | Sign-in prompt + "or use Discord" alt path |
| Intake | Signed in, no open ticket | Form (product, firmware, subject, message, attachments) + Turnstile |
| Active thread | Cookie-bound ticket exists | Live chat — sticky header, scrollable log, sticky composer |

Intake submit → POST `/api/support/start` → creates Discord forum
thread → sets the cookie → redirects to `/support` which now renders
the active thread. No interstitial.

### `/account/support`

Two-pane: ticket list on the left, selected thread on the right. The
list comes from KV (`idx:cust:{customerId}`); the right pane mounts
the same `<SupportThread>` component used on `/support`. Closed
tickets render read-only.

### `/account` dashboard

A "Support" tile shows open ticket count when > 0, otherwise an
"Open a ticket" CTA. Becomes gold-bordered when active.

### Feedback survey

Triggered by clicking **End ticket**. Modal with three 1-5 ratings
(response speed, helpfulness, overall) + free-text notes. Submit
posts to `/api/support/feedback`, which:

1. Writes `fb:{tid}` to KV.
2. Posts a structured message to `DISCORD_FEEDBACK_CHANNEL_ID` (or
   `DISCORD_STAFF_METADATA_CHANNEL_ID` as fallback).
3. Marks the ticket as `feedbackSubmitted` in the index.

Then the close call archives the Discord thread.

---

## How replies surface

```
Customer types in /support  -->  POST /api/support/send
                                       |
                                       v
                            Bot posts to Discord forum thread
                            (prefixed `**<First>:**` so the projection
                             knows it's customer-relayed, not staff)


Staff types in Discord thread  -->  GET /api/support/poll (every 4s)
                                          |
                                          v
                                  Scrubber + moderation gate
                                          |
                                          v
                                  JSON delta delivered to widget
                                          |
                                          v
                              Widget renders bubble in chat log
```

The web widget polls every 4 seconds while the tab is active, every
15 seconds when it's hidden. The first poll after page load uses
`?initial=1` to backfill the entire thread history (refresh-safe).

### Bot vs human authorship

Discord shows the bot as the author of:
- The thread starter (customer's first message).
- Every customer reply (relayed by the bot via `/api/support/send`).
- AI draft suggestions (Stage 4 — prefixed with a marker).
- AI summaries (Stage 5 — prefixed with another marker).

Staff humans show up as themselves. The poll endpoint distinguishes
all of these and projects them with the right `role` to the widget:

- `role: 'self'`  — customer's own message (bot-authored, `**<First>:**` prefix)
- `role: 'helper'` — staff human reply
- `role: 'ai'` — AI draft or summary (only surfaces if approved, see below)

---

## Staff workflow in Discord

### Where to look

- **`#support` (or whatever `DISCORD_SUPPORT_CHANNEL_ID` points at)** —
  forum channel. Every web ticket opens a thread here. Title format:
  `#1234567890 [<FirstName>] <subject>`.
- **`#support-staff` (or `DISCORD_STAFF_METADATA_CHANNEL_ID`)** —
  private staff-only channel. Each new ticket fires a metadata
  message here with the customer's full name + email + Shopify
  customer ID + IP hint + UA. Use this to look up the order; **do
  not** post these IDs back into the public forum thread.

### Replying

Just type in the thread. The customer sees your message within 4 s.

The bot may post an `🤖 OpenDrone DRAFT:` message at the top of new
threads — that's the AI first-responder. **The customer doesn't see
it until a moderator approves it** (see moderation gate below).

### Marking the final answer

When you've given the conclusive reply:

> **React to your message with 📧.**

That's the only signal that fires the email-on-reply notification.
Every other message stays web-only. The email contains:

- Subject: `Re: <ticket subject>`
- Preview: first ~240 chars of the message you reacted to
- "Continue chat →" button → magic-link resume URL

Debounced to one email per ticket per 5 minutes — toggling 📧 off
and back on within that window won't double-send.

If you want a different emoji, override `SUPPORT_EMAIL_EMOJI` in
Oxygen env (the staff Discord onboarding doc should match whatever
value is set).

### Approving messages (moderation gate)

If `SUPPORT_MODERATION_MODE=enforce` and `SUPPORT_MOD_ROLE_ID` is set:

> **Anyone with the moderator role can react to a message with ✅
> (or whatever `SUPPORT_APPROVE_EMOJI` is set to) to surface it.**

Without approval, messages stay invisible to the customer. This gates
both AI drafts and (depending on mode) general staff replies. Modes:

- `enforce` — only ✅-reacted messages surface.
- `log` — relay everything; log which messages *would* have been
  held. Good for dry runs before flipping to enforce.
- `off` — gate disabled entirely. Incident-only.

The mod role allowlist is cached in memory; reactor IDs are fetched
on-demand only when a ✅ count appears, so the moderation cost is
zero on un-reacted messages.

### Editing a message

Discord edits propagate. The next poll picks up the new content
and re-surfaces it (subject to the moderation gate, if enabled).
Customer sees the updated text on their next poll.

### Closing a thread

Customers close tickets by clicking **End ticket** in the web
widget — this triggers the feedback survey, archives the Discord
thread, and clears the customer's cookie.

If you need to close a thread from the Discord side (escalation,
abuse, dropped customer), archive the forum post manually. The
widget's next poll detects `thread.archived === true` and locks
the customer's UI to "ticket closed". The customer can then open
a new one if they need more help.

---

## Architecture at a glance

```
┌───────────────┐    HTTPS    ┌──────────────────┐     ┌──────────┐
│  Browser      │ ──────────► │  Hydrogen Worker │     │  Discord │
│  /support     │ ◄────────── │  (Cloudflare     │ ─── │  REST    │
│  /contact     │   poll      │   Oxygen)        │ ─── │  /v10    │
│  /account/*   │             └──────────────────┘     └──────────┘
└───────────────┘                       │
                                        │ KV reads/writes
                                        ▼
                               ┌──────────────────┐
                               │  TICKETS_KV      │
                               │  - tk:{tid}      │
                               │  - idx:cust:{id} │
                               │  - idx:email:{h} │
                               │  - fb:{tid}      │
                               └──────────────────┘
                                        ▲
                                        │
                            ┌───────────┴────────────┐
                            │                        │
                       Resend (email)          Cloudflare cache
                       reply notifs +          (60s on /contact
                       resume links            loader, edge KV)
```

**No gateway bot, no WebSocket.** Workers can't hold long-lived
connections — staff replies surface via the customer's poll loop,
not via push. The 📧 email reaction is the only push-style signal,
and it fires only when a customer poll picks up the reaction within
the 5-min debounce window.

### Trust boundary

The poll endpoint is the trust boundary between Discord (untrusted
free-form text) and the customer's browser. Every Discord message
runs through:

1. **Moderation gate** — drops messages without the approve emoji
   when enforce mode is on.
2. **Scrubber** — strips bidi overrides, control chars, JWTs, card
   numbers, IBANs, long hex secrets, emails, phones. See
   `app/lib/support/scrubber.ts`.
3. **Projection** — drops everything except `id`, `firstName`,
   `role`, scrubbed `content`, `createdAt`, sanitized
   `attachments`. No author IDs, avatars, discriminators, embeds,
   roles, or guild metadata reach the wire.

---

## Storage

### Cookie (`od_support`)

Signed (HMAC-SHA256, key = `SUPPORT_SESSION_SECRET` ?? `SESSION_SECRET`),
HttpOnly, Secure, SameSite=Strict, Max-Age 30 days. Carries:

```ts
{
  v: 1,
  tid: string,        // Discord thread id
  uid: string,        // random ticket id (rate-limit + log key)
  pid?: string,       // 10-digit public reference
  name: string,
  email: string,
  createdAt: number,  // unix seconds
  lastCursor?: string,        // last seen Discord message id
  lastReplyEmailAt?: number,  // debounce for 📧-triggered email
}
```

### KV (`TICKETS_KV`)

Bound in Oxygen dashboard. Keys:

- `tk:{tid}` — full ticket meta (single source of truth per ticket).
- `idx:cust:{customerId}` — JSON list of `TicketIndexEntry`, capped
  at 200 most-recent. Powers `/account/support` and the open-ticket
  banner on `/contact`.
- `idx:email:{sha256-hex-32}` — same shape, keyed by hashed email.
  Used by the resume-by-email flow.
- `fb:{tid}` — feedback record (3 ratings + notes + timestamp).

When `TICKETS_KV` is unbound (default until provisioned), list
operations return empty and `/account/support` shows the empty
state. Discord stays the source of truth for thread content, so
nothing breaks — you just lose the cross-device index.

### Discord forum

Source of truth for every message body. Threads auto-archive
after 24 h of inactivity (`auto_archive_duration: 1440`).

---

## Environment variables

Required:

| Var | Purpose |
|---|---|
| `DISCORD_BOT_TOKEN` | Bot auth for posting + polling. Bot must have `Send Messages`, `Create Public Threads`, `Send Messages in Threads`, `Read Message History` in the support channel. |
| `DISCORD_SUPPORT_CHANNEL_ID` | Numeric forum channel ID. |
| `SUPPORT_SESSION_SECRET` | HMAC key for the support cookie. `openssl rand -hex 32`. |

Strongly recommended:

| Var | Purpose |
|---|---|
| `DISCORD_GUILD_ID` | Required for moderation gate role lookup + the public widget on `/contact`. |
| `DISCORD_STAFF_METADATA_CHANNEL_ID` | Private staff channel for PII. Without it, full email + customer ID + IP go into the public forum thread (legacy behavior). |
| `RESEND_API_KEY` | Outbound email (resume links, reply notifications, feedback). |
| `SUPPORT_FROM_EMAIL` | Sender for support email. Domain must be verified in Resend. |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Bot check on intake form. |

Optional:

| Var | Default | Purpose |
|---|---|---|
| `PUBLIC_DISCORD_GUILD_ID` | falls back to `DISCORD_GUILD_ID` | Public widget guild ID; lets the customer-facing widget point at a different server than the support bridge. |
| `PUBLIC_DISCORD_INVITE` | falls back to `DISCORD_SUPPORT_INVITE` | Invite URL on `/contact`. |
| `DISCORD_SUPPORT_INVITE` | hardcoded fallback | Bridge-side invite. |
| `SUPPORT_EMAIL_EMOJI` | `📧` | Reaction that flags a message as the final answer worth emailing. |
| `SUPPORT_APPROVE_EMOJI` | `✅` | Reaction that surfaces a message past the moderation gate. |
| `SUPPORT_MOD_ROLE_ID` | unset | Discord role ID with approval power. Without this, the moderation gate is disabled. |
| `SUPPORT_MODERATION_MODE` | `off` | `enforce` / `log` / `off`. |
| `SUPPORT_AI_DRAFTS_ENABLED` | `false` | Stage 4 AI first-responder. Requires `ANTHROPIC_API_KEY`. |
| `SUPPORT_AI_MODEL` | latest Sonnet | Override AI draft / summary model. |
| `DISCORD_FEEDBACK_CHANNEL_ID` | falls back to staff metadata channel | Where the feedback survey posts land. |
| `TICKETS_KV` | unbound | KV namespace binding for the ticket index. |

`PUBLIC_*` vars surface to the client bundle. None of the
`DISCORD_*_TOKEN` / secret values do.

---

## One-time setup checklist

Server-side (Discord admin):

- [ ] Create the support forum channel; copy its ID into `DISCORD_SUPPORT_CHANNEL_ID`.
- [ ] Create a private staff channel; deny `View Channel` for `@everyone`, allow for the staff role. Copy ID into `DISCORD_STAFF_METADATA_CHANNEL_ID`.
- [ ] (Optional) Create a feedback channel, copy ID into `DISCORD_FEEDBACK_CHANNEL_ID`.
- [ ] Create a moderator role (e.g. `@support-mod`), copy its ID into `SUPPORT_MOD_ROLE_ID`. Assign to staff.
- [ ] **Server Settings → Widget → toggle on.** Required for the `<iframe>` widget on `/contact` to render the server card. Without this, the iframe shows "Widget Disabled".
- [ ] Create a bot application, invite to server with the permissions listed above.

Cloudflare / Oxygen:

- [ ] Provision a Workers KV namespace; bind it as `TICKETS_KV` in the Hydrogen storefront environment.
- [ ] Add `RESEND_API_KEY` + `SUPPORT_FROM_EMAIL`. Verify the sender domain in Resend (SPF/DKIM/DMARC).
- [ ] Add Turnstile site + secret keys. Add the dev/preview/prod hostnames in Cloudflare Turnstile dashboard.
- [ ] Add `SUPPORT_SESSION_SECRET` (`openssl rand -hex 32`).

Staff onboarding:

- [ ] Pin a `#support-staff` post explaining the reaction emojis: 📧 = email customer, ✅ = approve message (if moderation is on).
- [ ] Walk new helpers through one ticket end-to-end before they reply solo.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Customer never sees a staff reply | Moderation gate is on (`enforce`) and no one has reacted ✅. Check `SUPPORT_MODERATION_MODE`. |
| Customer doesn't get an email after a reply | Staff didn't react with 📧, OR `RESEND_API_KEY` / `SUPPORT_FROM_EMAIL` not set, OR domain not verified in Resend, OR within the 5-min debounce window of an earlier email. |
| Discord widget on `/contact` shows "Widget Disabled" | Server admin hasn't enabled the widget. Server Settings → Widget → toggle on. |
| `/account/support` shows empty list even though tickets exist | `TICKETS_KV` not bound. Provision in Oxygen, redeploy. Discord still has the threads. |
| New ticket form rejects with "Could not verify you are human" | Turnstile keys missing, or current hostname not whitelisted in the Turnstile dashboard. |
| Refresh wipes the chat | Customer's poll endpoint isn't returning their own messages. Check that `api.support.poll.tsx` projects bot messages whose content starts with `**<Name>:**` as `role: 'self'`. |
| Staff metadata posts never arrive in the private channel | `DISCORD_STAFF_METADATA_CHANNEL_ID` unset, or the bot lacks `Send Messages` in that channel. |

For deeper code-level questions see `app/lib/support/README.md`.

---

## Privacy + safety notes

- The cookie's `email` and `name` are signed but **not** encrypted —
  they're readable by anyone with browser access. They're never
  considered secret.
- The scrubber is best-effort. Staff should still treat support
  messages as customer-supplied and avoid pasting them into other
  systems verbatim.
- The `IP hint` posted to the staff channel is anonymized
  (`/24` for IPv4, `/48` for IPv6). The full IP is never stored.
- Discord is US-hosted. The customer is shown a privacy notice on
  the intake form: *"Your message is sent to our team over Discord
  (US-hosted). We store your name, email and conversation to help
  you."* Don't drop that line.
