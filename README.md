# OpenDrone Web

Open-source storefront for [OpenDrone](https://opendrone.be) — FPV flight controllers, ESCs, frames, and receivers. Built on Shopify Hydrogen 2026.x (React Router 7, Tailwind v4, react-three-fiber hero).

## Quick start

```sh
git clone https://github.com/Just4Stan/OpenDrone-Web.git
cd OpenDrone-Web
npm install
cp .env.example .env   # fill in tokens — see .env.example for sources
npm run dev            # http://localhost:3000  (uses Hydrogen tunnel for Customer Account OAuth)
```

Requires Node 22 or 24, npm 10+.

## Production workflow

Continuous deployment is live — every push to `main` triggers an Oxygen build + deploy. PR branches get a preview URL as a status check.

```sh
git checkout -b feat/topic       # branch off main
# work, commit (DCO-signed: git commit -s)
git push -u origin feat/topic
gh pr create --web               # CI runs lint + typecheck + build
                                 # Oxygen posts preview URL
# review, merge → auto-deploy (~2 min)
```

Monitor deploys in Shopify admin → Hydrogen → storefront → Deployments.

**Manual deploy (emergency only):** `npx shopify hydrogen deploy` ships the current local tree directly, bypassing CI and git history. Use only when the CD path is broken.

### DNS

Mail (MX + DKIM + DMARC) is on the email provider — only web records point at Shopify:

- `A @` → `23.227.38.65`
- `CNAME www` → `shops.myshopify.com.` (trailing dot matters)

Do not modify MX, `_domainkey`, `_dmarc`, or SPF TXT records. When Shopify needs SPF updated, merge into a single TXT.

## Stack

Shopify Hydrogen 2026.x on Oxygen · React Router 7 (file-based routes in `app/routes/`) · Tailwind CSS v4 (tokens in `app/styles/app.css` `@theme`) · react-three-fiber hero · TypeScript strict · Plausible analytics (cookieless).

| Script | Purpose |
|---|---|
| `npm run dev` | Local dev + codegen + Hydrogen tunnel |
| `npm run build` | Production build (runs `sync:legal` first) |
| `npm run preview` | Serve the production bundle locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript + React Router typegen |
| `npm run codegen` | Regenerate Storefront API types |
| `npm run sync:legal` | Refresh legal Markdown snapshots |
| `npm run compose:newsletter <handle>` | Render a newsletter email from a blog article |

`lint` and `typecheck` must pass before every PR — CI will reject otherwise.

## Project layout

```
app/
  routes/           file-based routes (React Router 7)
  components/       shared components
  styles/app.css    Tailwind v4 + @theme tokens
  content/legal/    generated, do not hand-edit
  graphql/          Customer Account API queries
  lib/              i18n, SEO, company, support bridge, fragments
  lib/support/      Discord ↔ web support bridge (see below)
public/             static assets
scripts/            build-time scripts
```

## Contributing

1. Branch from fresh `main`: `<type>/<topic>` — `feat`, `fix`, `chore`, `refactor`, or `docs`.
2. Commit with DCO sign-off: `git commit -s -m "subject"`. Subject ≤60 chars, imperative mood.
3. Run `npm run lint && npm run typecheck && npm run build` locally.
4. `gh pr create --web` — CI and Oxygen preview run automatically.
5. Address feedback with new commits. Maintainers squash-merge.

Forgot `-s`? `git commit --amend -s --no-edit && git push --force-with-lease`.

### Rules

- Lint + typecheck must pass locally before pushing.
- No new npm deps without opening an issue first (supply-chain hygiene).
- Mobile-first: design at 375px, enhance at 768px and 1440px.
- WCAG 2.1 AA baseline — semantic HTML, alt text, keyboard nav, ≥4.5:1 contrast.
- Bundle additions >50 KB gzipped need justification.
- No `console.log` in prod — strip or guard with `if (import.meta.env.DEV)`.
- Dependabot runs weekly — don't duplicate its PRs.

## Support / contact bridge

`/contact` lets a signed-in customer open a support ticket from the website. The ticket lands in a Discord forum thread; replies in the thread come back to the customer's browser via short polling. Stateless on the server (cookie-only); no DB.

```
                   ┌──────────────────────── browser ─────────────────────────┐
                   │ /contact widget                                          │
                   │   open ticket  →  api.support.start  ──┐                 │
                   │   send reply   →  api.support.send   ──┤                 │
                   │   poll loop    ←  api.support.poll   ──┤                 │
                   └─────────────────────────────────────────│─────────────────┘
                                                             │
        Cloudflare Worker (Oxygen) ──────────────────────────┘
                │
                │  Discord REST (bot-authenticated)
                ▼
   ┌─ public forum channel ─────────────────────┐    ┌─ private staff channel ──┐
   │ thread-starter (first name + message)      │    │ full PII metadata        │
   │ helper messages (any Discord member)       │    │ (email, customer GID,    │
   │ AI drafts (🤖 prefix, gated behind ✅)     │◀───┤ user-agent, IP hint)     │
   │ AI summaries (🤖 prefix, gated behind ✅)  │    │ + jump URL to thread     │
   └────────────────────────────────────────────┘    └──────────────────────────┘
```

The bridge has five staged layers, each toggleable via env vars:

1. **Outbound scrubber** — every Discord message is run through `app/lib/support/scrubber.ts` before reaching the browser. Strips Unicode bidi overrides + control chars, redacts emails / IBANs / phones / cards / JWTs / Discord mentions, and never leaks the author's Discord ID, avatar, or discriminator. Helper attribution is first-name only.
2. **Moderation gate** — the same Discord message is only delivered to the customer when a member of `SUPPORT_MOD_ROLE_ID` reacts with the approve emoji (default `✅`). `SUPPORT_MODERATION_MODE=enforce | log | off`. Falls back to `log` when the role id isn't configured, so a half-set deploy doesn't silently drop everything. Mod allowlist is cached per-isolate for an hour.
3. **Inbound scrubber** — narrower than outbound. The user's own email / phone / order numbers pass through (they need them for help context); only credentials, cards, and bidi/control chars are stripped before the message hits Discord.
4. **AI first-responder** *(off by default)* — `SUPPORT_AI_DRAFTS_ENABLED=1` + `ANTHROPIC_API_KEY` enables an AI-drafted reply on every new ticket. The draft posts to the Discord thread with a `🤖 **AI draft:**` header and goes through the same moderation gate. Customer never sees it without an approval reaction.
5. **Thread summariser** *(same flag)* — once a thread has accumulated ≥8 non-bot messages since the last recap, the bot drafts a summary tagged `🤖 **Recap so far up to msg_id=…:**`. Mod ✅ → customer's widget shows the recap as a single `role: 'ai'` message, replacing the back-and-forth.

### Public vs staff visibility

Discord cannot hide parts of a single message from some viewers. The bridge uses a **two-channel** model: a public forum where anyone in the server can help, and a private staff-only channel that the bot copies sensitive metadata to. Set `DISCORD_STAFF_METADATA_CHANNEL_ID` to the second channel's ID and grant **only** the `SUPPORT_MOD_ROLE_ID` role View Channel on it (deny `@everyone`). When the env is unset the bot falls back to embedding the metadata in the public thread (legacy mode).

### Env vars

All optional unless noted. See `.env.example` for the full list with comments and source pointers.

| Var | What it does |
|---|---|
| `DISCORD_BOT_TOKEN` | Bot auth (required for the bridge to work at all) |
| `DISCORD_SUPPORT_CHANNEL_ID` | Forum channel for new tickets |
| `DISCORD_GUILD_ID` | Server ID — required for Stage 2 mod-role lookup |
| `DISCORD_STAFF_METADATA_CHANNEL_ID` | Private channel for full PII (Stage 1 split-channel model) |
| `SUPPORT_MOD_ROLE_ID` | Role whose reactions ✅ approve a draft for delivery (Stage 2) |
| `SUPPORT_APPROVE_EMOJI` | Default `✅` |
| `SUPPORT_MODERATION_MODE` | `enforce` / `log` / `off` |
| `SUPPORT_SESSION_SECRET` | HMAC key for the support cookie. Falls back to `SESSION_SECRET`. |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile bot challenge. Fail-closed in prod. |
| `SUPPORT_TURNSTILE_DEV_SKIP=1` | Local-dev escape hatch when secret is unset (never set in Oxygen) |
| `RESEND_API_KEY` / `SUPPORT_FROM_EMAIL` | Cross-device "resume by email" magic link |
| `ANTHROPIC_API_KEY` / `SUPPORT_AI_DRAFTS_ENABLED` | Stage 4 + 5 AI drafts and summaries |
| `SUPPORT_AI_MODEL` | Override the default Claude model |

### Files

```
app/lib/support/
  discord.ts        REST API wrapper (threads, messages, reactions, members)
  session.ts        signed-cookie ticket session
  resume-token.ts   HMAC magic-link tokens for cross-device resume
  scrubber.ts       outbound + inbound regex pipelines
  moderation.ts     mod-role cache + per-message approval decision
  ai-draft.ts       Claude-powered drafts and recap generation
  email.ts          Resend wrapper for the resume link
  uploads.ts        attachment MIME / extension allowlist
  turnstile.ts      Cloudflare Turnstile server-side verification

app/routes/
  api.support.start.tsx  open a new ticket (POST, signed-in only)
  api.support.send.tsx   post a reply (POST)
  api.support.poll.tsx   pull staff replies + approved drafts/recaps (GET)
  api.support.close.tsx  end the ticket from the widget
  api.support.lookup.tsx email-driven resume-link request
  api.support.status.tsx widget bootstrap query
  support.resume.tsx     entry point for the resume magic link
```

### Tests

The bridge modules are all pure-ish (regex, HMAC, fetch with mockable boundaries). Unit tests run on Node's built-in test runner — no extra dependencies.

```sh
node --experimental-strip-types --test app/lib/support/*.test.ts
```

## Newsletter

Monthly-ish email to opt-in subscribers. Teaser + CTA format — full content lives on the site, the email drives traffic.

```
  subscribe form  ──▶  Shopify Customers (acceptsMarketing=true, tag: newsletter)
  (Hydrogen)             │
                         ├──▶  Shopify Email campaign ──▶  inbox
                         │
  blog post (Shopify)  ──┘
       │
  compose-newsletter.mjs  ──▶  scripts/out/newsletter-<slug>.html
                                          │
                                          └──▶ paste into Shopify Email (Custom HTML)
```

- Subscribers: `app/routes/newsletter.tsx` writes to Shopify's customer list via Storefront API.
- Content: authored as a blog article in Shopify admin, renders at `/blogs/<blog>/<article>`.
- Email: `npm run compose:newsletter <handle>` renders `scripts/out/newsletter-<handle>.html`. Paste into Shopify admin → Marketing → Campaigns → Custom HTML. Subject + preheader are printed to stdout.

Shopify Email injects `{% unsubscribe %}` automatically. Free up to 10K emails/month.

Template placeholders (`scripts/newsletter-template.html`): `{{TITLE}}`, `{{EXCERPT_HTML}}`, `{{HERO_IMAGE_BLOCK}}`, `{{PUBLISHED_DATE}}`, `{{ISSUE_LABEL}}`, `{{ARTICLE_URL}}`, `{{SUBJECT}}`, `{{PREHEADER}}`. Keep table-based with inline styles — most email clients strip modern CSS.

## Security

**Do not open a public GitHub issue for security vulnerabilities.** Use:

- [GitHub private vulnerability reporting](https://github.com/Just4Stan/OpenDrone-Web/security/advisories/new)

Machine-readable pointer at [`/.well-known/security.txt`](https://opendrone.be/.well-known/security.txt).

**In scope:** this repo and the deployed site — auth, sessions, checkout, customer data. XSS, CSRF, SSRF, injection, auth bypass, IDOR.

**Out of scope:** DoS, volumetric testing, physical or social-engineering attacks, third-party services not operated by us, reports from automated scanners without proof of exploitability.

Do not access accounts/data/orders that aren't your own, run automated scanners against production, or test payment flows with real cards.

## License

[MIT](LICENSE). Hardware repos are CERN-OHL-S — see [OpenFC](https://github.com/Just4Stan/OpenFC) and [OpenESC](https://github.com/Just4Stan/Open-4in1-AM32-ESC).
