/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/oxygen-workers-types" />
/// <reference types="@shopify/hydrogen/react-router-types" />

// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';

// Extend the Oxygen-provided Env interface with project env vars so
// context.env.* is strongly typed in routes.
declare global {
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

    // Stage 4 AI first-responder
    ANTHROPIC_API_KEY?: string;
    SUPPORT_AI_DRAFTS_ENABLED?: string;
    SUPPORT_AI_MODEL?: string;
  }
}
