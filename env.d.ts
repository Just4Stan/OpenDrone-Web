/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/oxygen-workers-types" />
/// <reference types="@shopify/hydrogen/react-router-types" />

// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';

// Extend the Oxygen-provided Env interface with project env vars so
// context.env.* is strongly typed in routes.
declare global {
  // Minimal KVNamespace shape — Oxygen provides the binding at runtime
  // but doesn't re-export Cloudflare's type definition. Only the
  // methods we actually call are declared. Replace with the full
  // @cloudflare/workers-types KVNamespace if that package gets added.
  interface KVNamespace {
    get(key: string): Promise<string | null>;
    put(
      key: string,
      value: string,
      options?: {expirationTtl?: number; expiration?: number; metadata?: unknown},
    ): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: {prefix?: string; limit?: number; cursor?: string}): Promise<{
      keys: Array<{name: string; expiration?: number; metadata?: unknown}>;
      list_complete: boolean;
      cursor?: string;
    }>;
  }

  interface Env {
    SESSION_SECRET: string;
    PUBLIC_STORE_DOMAIN: string;
    PUBLIC_STOREFRONT_API_TOKEN: string;
    PRIVATE_STOREFRONT_API_TOKEN: string;
    PUBLIC_STOREFRONT_ID: string;
    SHOP_ID: string;
    PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID: string;
    PUBLIC_CUSTOMER_ACCOUNT_API_URL: string;
    PUBLIC_CHECKOUT_DOMAIN: string;

    PUBLIC_COMPANY_NAME?: string;
    PUBLIC_COMPANY_ADDRESS?: string;
    PUBLIC_COMPANY_KBO?: string;
    PUBLIC_COMPANY_VAT?: string;
    PUBLIC_COMPANY_EMAIL?: string;
    PUBLIC_COMPANY_TEL?: string;

    // Web support bridge
    DISCORD_BOT_TOKEN?: string;
    DISCORD_SUPPORT_CHANNEL_ID?: string;
    DISCORD_GUILD_ID?: string;
    DISCORD_STAFF_METADATA_CHANNEL_ID?: string;
    DISCORD_SUPPORT_INVITE?: string;
    // Public-facing guild identifiers used by the /contact invite card.
    // Distinct from the bridge-side bindings so the public card can be
    // wired without exposing support-bridge state.
    PUBLIC_DISCORD_GUILD_ID?: string;
    PUBLIC_DISCORD_INVITE?: string;
    SUPPORT_SESSION_SECRET?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
    SUPPORT_TURNSTILE_DEV_SKIP?: string;
    RESEND_API_KEY?: string;
    SUPPORT_FROM_EMAIL?: string;

    // Stage 2 moderation gate
    SUPPORT_MOD_ROLE_ID?: string;
    SUPPORT_APPROVE_EMOJI?: string;
    SUPPORT_MODERATION_MODE?: string;

    // Email-on-final-answer marker. Staff reacts to a Discord message
    // with this emoji to flag it as the conclusive reply that should
    // notify the customer via email. Without this reaction, no email
    // is sent — every message still surfaces in the live web widget.
    // Default: 📧 when unset.
    SUPPORT_EMAIL_EMOJI?: string;

    // Stage 4 AI first-responder
    ANTHROPIC_API_KEY?: string;
    SUPPORT_AI_DRAFTS_ENABLED?: string;
    SUPPORT_AI_MODEL?: string;

    // Stage 6 ticket index — Upstash Redis REST credentials. Oxygen
    // does not expose Cloudflare KV bindings, so we hit Upstash over
    // HTTPS instead. When unset, list operations degrade to a Discord
    // forum scan (slow, fine at <100 tickets total). Required before
    // scaling beyond a few hundred tickets.
    UPSTASH_REDIS_REST_URL?: string;
    UPSTASH_REDIS_REST_TOKEN?: string;

    // Bearer token for /api/support/cleanup. The daily GitHub Actions
    // cron (.github/workflows/support-cleanup.yml) sends this in the
    // Authorization header. Without it the endpoint returns 503 — set
    // it to enable automatic stale-ticket sweeping.
    SUPPORT_CLEANUP_SECRET?: string;
    DISCORD_FEEDBACK_CHANNEL_ID?: string;

    // Newsletter / release-notes auto-dispatch
    // - SHOPIFY_ADMIN_API_TOKEN: custom-app Admin API token. Required
    //   scopes: read_customers, write_customers, read_content,
    //   write_content (metafields). Server-only — never exposed.
    // - SHOPIFY_ADMIN_API_VERSION: defaults to 2026-01 when unset.
    // - SHOPIFY_WEBHOOK_SECRET: shared secret configured on the
    //   articles/update webhook in Shopify admin. Verifies inbound
    //   X-Shopify-Hmac-Sha256 header.
    // - NEWSLETTER_DISPATCH_SECRET: bearer token for manual dispatch
    //   trigger (CLI/curl) AND HMAC key for per-recipient unsubscribe
    //   tokens. Rotate together — old unsubscribe links die on rotate.
    // - NEWSLETTER_FROM_EMAIL: sender address, e.g. news@opendrone.be.
    //   Domain must be verified in Resend (SPF/DKIM/DMARC).
    // - NEWSLETTER_BLOG_HANDLE: defaults to `releases`. Articles in
    //   any other blog never trigger an email.
    // - NEWSLETTER_DISPATCH_KV: dedup ledger so a redelivered webhook
    //   doesn't double-send during the window before the metafield
    //   write lands. Optional but recommended.
    //
    // Webhook URL to register in Shopify admin:
    //   POST https://opendrone.be/api/newsletter/dispatch
    //   topic: articles/update  (Stan also create a one-shot
    //   articles/create subscription if desired)
    //   format: JSON
    //   secret: same value as SHOPIFY_WEBHOOK_SECRET
    SHOPIFY_ADMIN_API_TOKEN?: string;
    SHOPIFY_ADMIN_API_VERSION?: string;
    SHOPIFY_WEBHOOK_SECRET?: string;
    NEWSLETTER_DISPATCH_SECRET?: string;
    NEWSLETTER_FROM_EMAIL?: string;
    NEWSLETTER_BLOG_HANDLE?: string;
    NEWSLETTER_DISPATCH_KV?: KVNamespace;
  }
}
