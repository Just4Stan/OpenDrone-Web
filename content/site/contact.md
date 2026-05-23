# Contact — `/contact`

> source: app/routes/contact.tsx

Contact hub: a Discord widget (or an invite card when no guild is
configured), a ticket pointer tile, and a direct-contact tile. An
"active ticket" banner appears at the top only when the visitor already
has an open support ticket. Some values (phone, email, Discord invite,
guild presence/member counts, guild name/description) come from
environment config or the Discord API — see the do-not-edit blocks and
notes; those are not editable here.

## Meta (browser tab + search/social)

- **title:** Contact
- **description:** Reach the OpenDrone team via Discord, a support ticket, or direct phone/email.

## Page header

- **eyebrow:** FILE 09 · CONTACT
- **title:** Talk to 
- **title_em:** builders
- **title_suffix:** , not a help desk.

### prose: lede

OpenDrone is run by a small team. Most questions get answered fastest in our Discord — that’s where the engineers live. If Discord isn’t your thing, open a ticket and we’ll thread it back to the same crew.

## Active-ticket banner (only when visitor has an open ticket)

- **status_open:** Open
- **banner_text:** You have an active support ticket
- **banner_last_reply:** continue where you left off
- **banner_cta:** Continue thread →

Note: the ticket number shown after `banner_text` (e.g. `#<pid>`) is
dynamic, pulled from the visitor's support session/ticket index.

## Discord widget / invite card

- **discord_eyebrow:** ↗ PRIMARY · LIVE NOW
- **discord_title:** Join the OpenDrone Discord
- **discord_lede:** Direct line to the people building the boards. Show your bench, post your logs, get feedback.
- **discord_cta:** Go to server →
- **online_label:** online
- **members_label:** members
- **est_label:** Est.
- **est_date:** Apr 2026

Notes:
- When a Discord guild ID is configured, this section renders an
  embedded Discord widget iframe instead of the invite card; its only
  copy is the iframe `title` ("OpenDrone on Discord") and the section
  aria-label ("Join the OpenDrone Discord").
- On the invite card, the guild name, description, online count and
  member count are pulled live from the Discord API (Shopify-style
  dynamic data) — not editable here. `discord_lede` is only shown as the
  description fallback when the API returns no guild description.
- The `est_label` ("Est.") and `est_date` ("Apr 2026") render together
  as "Est. Apr 2026"; the date is hardcoded in source next to the label.
- `discord_cta` ("Go to server →") has its trailing arrow stripped when
  shown on the live invite card, but kept on the fallback card.

```do-not-edit
Invite-card aria-labels: "Discord" (fallback, no preview) /
"<guild name> on Discord" (with preview).
Discord CTA link → discordInvite (env PUBLIC_DISCORD_INVITE /
DISCORD_SUPPORT_INVITE, default https://discord.gg/ABajnacUsS),
opens in new tab.
Widget iframe src → https://discord.com/widget?id=<guildId>&theme=dark
```

## Ticket pointer tile

- **ticket_eyebrow:** → SECONDARY
- **ticket_title:** No Discord? Open a ticket.
- **ticket_lede:** Goes to the same Discord crew via a private thread. Sign in so we can link it to your order.
- **ticket_cta:** Open a ticket

When the visitor already has an open ticket, this tile switches to a
"separate ticket" variant:

- **ticket_title_alt:** Open a separate ticket
- **ticket_lede_alt:** Different problem? Start a new thread instead of mixing it into the active one. Your current ticket stays open.
- **ticket_cta_alt:** Open a new ticket

```do-not-edit
Tile CTA target → /support (default) or /support?new=1 (when an
active ticket exists).
```

## Direct-contact tile

- **direct_eyebrow:** ⌖ DIRECT
- **phone_label:** Phone
- **email_label:** Email
- **security_label:** Security
- **security_value:** Responsible disclosure ↗
- **hours_label:** Hours · CET
- **hours_value:** Mon–Fri · 09:00–18:00

Note: the phone number and email address values are environment-config
(env PUBLIC_COMPANY_TEL / PUBLIC_COMPANY_EMAIL, default email
`contact@opendrone.be`) — not editable here. The phone row only renders
when a number is configured.

```do-not-edit
Phone value → tel:<contactTel digits>
Email value → mailto:<contactEmail>
Security row → /security
```
