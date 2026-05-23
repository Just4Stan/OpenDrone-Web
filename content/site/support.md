# Support — `/support`, `/support/resume`

> source: app/routes/support.tsx, app/routes/support.resume.tsx, app/components/SupportThread.tsx, app/components/FeedbackModal.tsx

The support page has three phases driven by the loader: **signed-out**
(no account session), **intake** (signed in, no active ticket → show the
open-a-ticket form), and **active** (a cookie-bound ticket exists → render
the live chat thread). The active phase mounts the `SupportThread` chat UI
and, on "End ticket", the `FeedbackModal`. `/support/resume` is a
redirect-only endpoint (no visible copy of its own); it bounces to
`/contact` with a `?support=…` flag the contact widget reads — see the
do-not-edit block. Ticket subject, customer name, product, firmware,
timestamps, chat messages, and attachment filenames are dynamic
(loader / Discord thread data) — not editable here.

## Meta (browser tab + search/social)

- **title:** Support
- **description:** Open a support ticket — replies routed to our Discord crew.

## Signed-out phase — header

- **eyebrow:** FILE 09.A · SUPPORT
- **heading_line1:** Sign in to open
- **heading_line2_emphasis:** support ticket
- **heading_trailing:** .

### prose: signed_out_intro

We tie tickets to your account so we can pull your order, see what board rev you’re on, and so you can pick the thread back up from any device.

## Signed-out phase — sign in tile

- **signin_tile_eyebrow:** → SIGN IN REQUIRED
- **signin_tile_heading:** Continue with your OpenDrone account
- **signin_tile_body:** One ticket, one thread. Resume from desktop or phone.
- **signin_reason_1:** We see exactly which SKU and firmware rev you have.
- **signin_reason_2:** You can attach order files without typing the order number.
- **signin_cta:** Sign in →
- **create_account_cta:** Create account

## Signed-out phase — Discord alt tile

- **discord_tile_eyebrow:** ↗ ALT PATH
- **discord_tile_heading:** Or come hang out on Discord
- **discord_tile_body:** Discord doesn’t need an account on our side — fastest path for general build questions, tuning, or show-and-tell.
- **discord_tile_cta:** Open Discord →

## Intake phase — header

- **eyebrow:** FILE 09.A · OPEN A TICKET
- **heading_lead:** Tell us what’s
- **heading_emphasis:** not behaving
- **heading_trailing:** .
- **intro:** One thread per issue. We’ll reply in the same window — usually within a few hours during CET business time.

## Intake phase — form fields

- **product_label:** Product
- **product_label_optional:** — optional
- **product_option_placeholder:** — Pick one —
- **product_option_openesc:** OpenESC (Electronic Speed Controller)
- **product_option_openfc:** OpenFC (Flight Controller)
- **product_option_openrx:** OpenRX (Receiver)
- **product_option_openmotor:** OpenMotor
- **product_option_openframe:** OpenFrame
- **product_option_other:** Other / not sure
- **firmware_label:** Firmware version
- **firmware_label_optional:** — if known
- **firmware_placeholder:** e.g. BLHeli-32 v32.10
- **subject_label:** Subject
- **subject_required_aria:** required
- **subject_placeholder:** A short title — what's the issue in 5 words?
- **message_label:** What’s happening
- **message_required_aria:** required
- **message_placeholder:** Describe what you tried, what you saw, and what you expected. Logs and a short clip help a lot.
- **attachments_label:** Attachments
- **attachments_label_hint:** — images, logs, video up to 24 MB
- **attachments_strip_aria:** Attached files
- **add_file_button:** + Add file

## Intake phase — bot check / honeypot

- **honeypot_label:** Website
- **turnstile_placeholder:** Verifying you’re human · Cloudflare Turnstile
- **turnstile_container_aria:** Bot check

## Intake phase — submit + footer help

- **submit_idle:** Open ticket →
- **submit_busy:** Opening ticket…
- **help_one_ticket:** One open ticket at a time — keeps things tidy on both sides.
- **help_prefer_discord_lead:** Prefer Discord?
- **help_prefer_discord_link:** Open the server →
- **help_signed_in_as_lead:** Signed in as

## Intake phase — attachment validation errors

- **err_max_files:** Max 5 files.
- **err_over_8mb:** *(template — `name` is the dynamic filename)* {name}: over 8 MB.
- **err_total_over_24mb:** Total over 24 MB.

## Intake phase — submit errors

- **err_server_unreachable:** Could not reach the server. Try again in a moment.

## Intake phase — attachment chip

*(filename, file size, and 📎 paperclip are dynamic / static glyphs.)*

- **chip_remove_aria:** *(template — `name` is the dynamic filename)* Remove {name}

## Active phase — thread header

*(Subject and ticket id `#{pid}` are dynamic.)*

- **subject_fallback:** Support ticket
- **end_ticket_button:** End ticket

## Active phase — status badge

- **status_open:** Open
- **status_awaiting:** Awaiting your reply
- **status_progress:** In progress
- **status_resolved:** Resolved

## Active phase — empty thread state

- **empty_heading:** Sent to our Discord — members will reply ASAP.

### prose: active_empty_body

Your message was posted as a private thread. The first member to grab it will reply here. We’ll email you the moment a moderator confirms an answer, so you don’t need to keep this tab open.

## Active phase — message log

*(Author names, timestamps, message text, and attachment filenames are
dynamic. Day separators render the date, e.g. "Today, May 23".)*

- **day_separator_today_prefix:** Today,
- **message_role_self:** You
- **message_role_ai:** Assistant
- **message_role_staff:** Staff
- **dropzone_overlay:** ↓ Drop files to attach

## Active phase — composer

- **composer_label_sr:** Reply to ticket
- **composer_placeholder:** Type a reply…  ⌘ + Enter to send
- **composer_textarea_aria:** Reply to ticket
- **attach_file_aria:** Attach file
- **send_reply_aria:** Send reply
- **send_idle:** Send →
- **send_busy:** Sending…
- **files_to_send_aria:** Files to send
- **composer_hint:** *(⌘ and Enter render as keyboard keys)* ⌘ + Enter to send · drag files anywhere to attach

## Active phase — composer validation errors

- **err_max_files:** *(template — `5` is MAX_FILES)* Max 5 files per message.
- **err_over_8mb:** *(template — `name` is the dynamic filename)* {name}: over the 8 MB limit.
- **err_total_over_24mb:** Total attachment size over 24 MB.

## Active phase — send / poll status messages

- **err_session_expired:** Your session expired — refresh to continue.
- **send_failed_inline:** *(appended to the failed message; `message` is the dynamic server reason)* [failed: {message}]
- **send_failed_network:** *(appended to the failed message)* [failed: network]

## Active phase — closed ticket banner

- **closed_banner:** This ticket is closed. Open a new one if you need more help.

## Active phase — sidebar: ticket details

*(Ticket id, opened date, product, and firmware values are dynamic;
rows only appear when present. Em dash shown when ticket id missing.)*

- **sidebar_details_eyebrow:** → TICKET DETAILS
- **sidebar_aria:** Ticket details
- **sidebar_row_ticket:** Ticket
- **sidebar_row_opened:** Opened
- **sidebar_row_product:** Product
- **sidebar_row_firmware:** Firmware

## Active phase — sidebar: replies

- **sidebar_replies_eyebrow:** ⌘ REPLIES
- **sidebar_count_visible:** visible
- **sidebar_count_awaiting:** awaiting confirmation
- **sidebar_pending_help:** A moderator approves replies before you see them — protects you from drive-by misinformation.

## Active phase — sidebar: while you wait

- **sidebar_faq_eyebrow:** ↗ WHILE YOU WAIT
- **sidebar_link_discord:** Search the Discord — someone may have asked already →
- **sidebar_link_buildnotes:** Latest build notes →
- **sidebar_link_firmware:** Firmware partner docs →
- **sidebar_ai_help:** AI suggestions land here once the bot has read your ticket.

## Active phase — section aria-labels

- **thread_section_aria:** Support ticket
- **thread_log_aria:** Message thread

## Feedback modal (on "End ticket")

- **eyebrow:** → THANKS FOR USING SUPPORT
- **heading:** How did we do?
- **intro:** Three quick taps. Helps us figure out what to fix next.
- **q_speed:** Response speed
- **q_speed_hint:** 1 = slow · 5 = fast
- **q_helpfulness:** How helpful was the answer?
- **q_helpfulness_hint:** 1 = not at all · 5 = nailed it
- **q_overall:** Overall feeling about this ticket
- **q_overall_hint:** 1 = rough · 5 = great
- **rating_dot_aria:** *(template — `n` is 1–5)* {n} out of 5
- **notes_label:** Anything else?
- **notes_label_optional:** — optional
- **notes_placeholder:** What we got right, what we missed…
- **end_without_feedback_button:** End without feedback
- **submit_idle:** Submit & close ticket →
- **submit_busy:** Submitting…
- **err_submit_failed:** Could not submit feedback. Try again.

```do-not-edit
Routes / endpoints (structural):
- Sign in / create account → /account/login?return_to=<encoded>/support
- Discord invite → env DISCORD_SUPPORT_INVITE, default https://discord.gg/ABajnacUsS
- Sidebar links → https://discord.gg/ABajnacUsS, /newsletter, /firmware-partners
- Form submit → POST /api/support/start
- Live polling → /api/support/poll?initial=1 then /api/support/poll
- Send reply → POST /api/support/send
- Close ticket → POST /api/support/close, then nav → /account/support
- Feedback → POST /api/support/feedback
- Open another ticket entry point → /support?new=1
- Bot check → Cloudflare Turnstile (env TURNSTILE_SITE_KEY)

/support/resume is redirect-only (no rendered copy). It reads ?t=<token>
and redirects to /contact with a flag the contact widget surfaces:
  /contact?support=rate-limited   (per-IP cap hit)
  /contact?support=invalid-link   (bad/expired token)
  /contact?support=ticket-gone    (Discord thread deleted)
  /contact?support=resumed        (success — cookie re-issued)
The user-facing text for those flags lives in the /contact widget, see
contact.md — not here.

Limits (structural): max 5 files; 8 MB per file; 24 MB total; subject
4–120 chars; firmware ≤80 chars; message ≤4000 chars; composer ≤1800
chars; feedback notes ≤1500 chars.
```
