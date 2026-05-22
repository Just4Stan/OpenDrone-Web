# Environment variables

The full list with inline comments and source pointers lives in
[`.env.example`](../.env.example) — copy it to `.env` and fill in the
values. This page is the grouped summary.

## Required

Storefront cannot boot without these.

- `SESSION_SECRET` (`openssl rand -hex 32`)
- `PUBLIC_STORE_DOMAIN`, `PUBLIC_STOREFRONT_API_TOKEN`, `PUBLIC_STOREFRONT_ID`, `SHOP_ID`, `PRIVATE_STOREFRONT_API_TOKEN`
- `PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID`, `PUBLIC_CUSTOMER_ACCOUNT_API_URL`

## Optional core

- `PUBLIC_CHECKOUT_DOMAIN` — dedicated checkout subdomain; falls back to `PUBLIC_STORE_DOMAIN` when unset.

## Legal entity

WER Art. VI.45 mandates these on every page.

- `PUBLIC_COMPANY_NAME`, `PUBLIC_COMPANY_ADDRESS`, `PUBLIC_COMPANY_KBO`, `PUBLIC_COMPANY_VAT`, `PUBLIC_COMPANY_EMAIL`, `PUBLIC_COMPANY_TEL`

## Support bridge

All optional; the bridge degrades gracefully when unset.

- `DISCORD_BOT_TOKEN`, `DISCORD_SUPPORT_CHANNEL_ID` (forum channel), `DISCORD_GUILD_ID`
- `DISCORD_STAFF_METADATA_CHANNEL_ID` — private staff channel for PII split
- `DISCORD_SUPPORT_INVITE` — invite link shown on the contact page + widget
- `PUBLIC_DISCORD_GUILD_ID`, `PUBLIC_DISCORD_INVITE` — public guild + invite for the `/contact` invite card (member/online counts); fall back to `DISCORD_GUILD_ID` / `DISCORD_SUPPORT_INVITE`
- `SUPPORT_MOD_ROLE_ID`, `SUPPORT_APPROVE_EMOJI`, `SUPPORT_MODERATION_MODE`
- `SUPPORT_SESSION_SECRET` — falls back to `SESSION_SECRET`
- `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` — fail-closed in prod
- `SUPPORT_TURNSTILE_DEV_SKIP=1` — local-dev escape only; gated behind `process.env.NODE_ENV !== 'production'` so it can't activate in Oxygen
- `RESEND_API_KEY`, `SUPPORT_FROM_EMAIL`
- `ANTHROPIC_API_KEY`, `SUPPORT_AI_DRAFTS_ENABLED`, `SUPPORT_AI_MODEL`

## Ticket index (Upstash Redis REST)

- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

## Blog / newsletter

- `NEWSLETTER_BLOG_HANDLE` — Shopify blog the `/blog` feed + RSS read from; defaults to `news`
- Sends are manual via Shopify admin (Shopify Email → "Subscribed" segment); no dispatch secrets or ESP keys needed

## Blog publisher (`scripts/publish-post.mjs`, reads `.env` directly)

- `SHOPIFY_ADMIN_API_TOKEN` — "OpenDrone Infra" custom app; needs `read_content` + `write_content` + `write_files`
- `SHOPIFY_ADMIN_API_VERSION` — defaults to `2026-01`

## Ops

- `SUPPORT_CLEANUP_SECRET` — bearer for the daily cleanup workflow
- `COMPLIANCE_SRC` — override path for `npm run sync:legal`
