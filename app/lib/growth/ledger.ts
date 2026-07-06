/**
 * Growth ledger — the durable record behind per-channel conversion and
 * AOV numbers. Thin layer over the Upstash REST helpers in
 * app/lib/support/upstash.ts (imported, not duplicated); this module is
 * the SINGLE OWNER of the growth key shapes. Lanes B (email) and C
 * (notify survey) extend this file — add key shapes to the docs block
 * below, don't invent keys elsewhere. (No pre-order/reserve records:
 * pre-orders were dropped entirely, 2026-07-06.)
 *
 * docs: key shapes
 * ----------------------------------------------------------------------
 * ord:<order_id>   JSON `AttributedOrder` (below). One per Shopify
 *                  orders/paid (or orders/create) webhook delivery;
 *                  order_id is Shopify's numeric order id, so redelivered
 *                  webhooks overwrite idempotently rather than duplicate.
 *                  No TTL. Attribution arrives as hidden `_utm_*`
 *                  note_attributes and is stored un-prefixed. Basic-plan
 *                  payloads redact buyer name/email/address — the email
 *                  join comes from sig:<email>, not the order payload.
 *                  RtbF: DEL — the order itself lives in Shopify; this
 *                  record is only the attribution join.
 *
 * sig:<email>      Signup/profile record — JSON `SignupRecord` (below),
 *                  written by recordSignup (Lane B). Merge-don't-clobber:
 *                  writes are read-modify-write so fields set by other
 *                  lanes (survey euPremium/interviewOptIn, Lane C)
 *                  survive a re-signup. consentAt/locale/channel are
 *                  first-touch (set once); `products` accumulates every
 *                  notify-<handle> interest. Known race: two concurrent
 *                  signups for the same address can drop one product
 *                  entry — acceptable (per-email rate limit is 3/day).
 *                  No TTL. RtbF = DEL sig:<email> here AND delete the
 *                  Resend marketing contact (DELETE /contacts/{email},
 *                  see app/lib/growth/resend.ts).
 *
 *                  Survey fields (Lane C): euPremium / interviewOptIn
 *                  are opinions tied to the email, written by
 *                  recordSurveyAnswers via /api/survey. GDPR: covered by
 *                  the same RtbF DEL as the rest of the record; no
 *                  separate consent needed — the survey is optional,
 *                  skippable, and only offered after the signup consent
 *                  was given (the endpoint is gated on a token minted by
 *                  the consented signup). No IP is stored with answers.
 *
 * att:idx          Append-only export index: a Redis list (LPUSH, newest
 *                  first, LTRIM-capped at 5000) of ledger keys written,
 *                  e.g. "ord:6234098751". Export/reconciliation scripts
 *                  walk this instead of SCANning the keyspace.
 *
 * GDPR: never store IPs or user agents here. Attribution values are the
 * visitor's own session-scoped UTM tags, allowlisted + capped at 64
 * chars upstream (app/routes/cart.tsx). Retention: flag any new key
 * shape for the privacy-policy processor table (legal task 18-jul).
 * ----------------------------------------------------------------------
 *
 * All functions are null-safe when Upstash is unconfigured: no-op +
 * console.warn, matching the repo's degrade-soft pattern.
 */

import {
  getTicketStore,
  listPush,
  type UpstashEnv,
} from '~/lib/support/upstash';

export type OrderLineItem = {
  sku: string;
  qty: number;
  title?: string;
};

/** First-touch attribution as it arrived on the order's custom attributes. */
export type OrderAttribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  landing?: string;
};

export type AttributedOrder = {
  /** Shopify numeric order id, stringified. */
  id: string;
  /** Order total in major units (e.g. euros). */
  total: number;
  /** ISO 4217, e.g. 'EUR'. */
  currency: string;
  items: OrderLineItem[];
  attribution: OrderAttribution;
  /** Shopify order created_at (ISO 8601). */
  createdAt: string;
  /** Webhook arrival, unix seconds. */
  receivedAt: number;
};

/**
 * Micro-survey answer to "would you pay more for EU-assembled?" —
 * 'no' or the percentage premium the subscriber says they'd accept.
 * NOT a purchase commitment of any kind (no pre-orders, decision
 * 2026-07-06); pure research signal.
 */
export type EuPremiumAnswer = 'no' | '10' | '20' | '30';

export const EU_PREMIUM_ANSWERS: readonly EuPremiumAnswer[] = [
  'no',
  '10',
  '20',
  '30',
];

/**
 * Newsletter/notify signup profile (`sig:<email>`). GDPR: email +
 * consent timestamp + the visitor's own locale/channel — no IP, no UA.
 */
export type SignupRecord = {
  email: string;
  /** First consent, ISO 8601. Set once — never overwritten on merge. */
  consentAt: string;
  /** notify-<handle> interests, accumulated (deduped) across signups. */
  products: string[];
  /** Site locale at first signup ('en' | 'nl' | 'fr'). First-touch. */
  locale?: string;
  /** First-touch channel (utm_source, else 'direct'). Set once. */
  channel?: string;
  /** Micro-survey answers (Lane C writes these; preserved on merge). */
  euPremium?: EuPremiumAnswer;
  interviewOptIn?: boolean;
  /** Last write, unix seconds. */
  updatedAt: number;
};

const INDEX_KEY = 'att:idx';
const INDEX_CAP = 5000;

/**
 * Record a newsletter/notify signup (`sig:<email>`), merging into any
 * existing record: unknown/extra fields (e.g. Lane C's survey answers)
 * are preserved, first-touch fields keep their original values, and the
 * optional product handle is appended to `products`. Appends the key to
 * `att:idx` only on first creation.
 *
 * Returns `{created}` — true when no record existed before (the caller
 * uses this to send the welcome email exactly once) — or null when
 * Upstash is unconfigured / the write failed (degrade-soft).
 */
export async function recordSignup(
  env: UpstashEnv,
  opts: {
    email: string;
    consentAt: string;
    product?: string | null;
    locale?: string;
    channel?: string | null;
  },
): Promise<{created: boolean} | null> {
  const store = getTicketStore(env);
  if (!store) {
    console.warn(
      '[growth/ledger] Upstash not configured — signup record dropped',
    );
    return null;
  }
  const key = `sig:${opts.email}`;
  try {
    let existing: SignupRecord | null = null;
    const raw = await store.get(key);
    if (raw) {
      try {
        existing = JSON.parse(raw) as SignupRecord;
      } catch {
        existing = null; // corrupt record — rebuild it
      }
    }
    const products = new Set(existing?.products ?? []);
    if (opts.product) products.add(opts.product);

    const record: SignupRecord = {
      // Spread first: preserves fields this module doesn't own (survey
      // answers and any future additions) — merge, don't clobber.
      ...existing,
      email: opts.email,
      consentAt: existing?.consentAt ?? opts.consentAt,
      products: Array.from(products),
      locale: existing?.locale ?? opts.locale,
      channel: existing?.channel ?? opts.channel ?? undefined,
      updatedAt: Math.floor(Date.now() / 1000),
    };
    await store.put(key, JSON.stringify(record));

    if (!existing) {
      const indexed = await listPush(env, INDEX_KEY, key, INDEX_CAP);
      if (!indexed) {
        console.warn('[growth/ledger] att:idx append failed for', key);
      }
    }
    return {created: !existing};
  } catch (err) {
    console.warn('[growth/ledger] recordSignup failed', err);
    return null;
  }
}

/**
 * Merge micro-survey answers into the `sig:<email>` record (Lane C).
 * Read-modify-write like recordSignup: fields owned by other writers
 * (consentAt, products, channel, …) are never clobbered. Answers can
 * arrive one at a time (each question POSTs on click), so a call with
 * only `euPremium` must not erase a previously stored `interviewOptIn`
 * and vice versa — undefined means "not answered in this call", not
 * "clear it".
 *
 * The record normally exists (the survey token is only minted after a
 * signup, which writes it), but if the ledger was unconfigured at
 * signup time or the write raced, a minimal record is created rather
 * than dropping the answer.
 *
 * Degrade-soft: no-op + warn when Upstash is unconfigured.
 */
export async function recordSurveyAnswers(
  env: UpstashEnv,
  opts: {
    email: string;
    euPremium?: EuPremiumAnswer;
    interviewOptIn?: boolean;
  },
): Promise<void> {
  const store = getTicketStore(env);
  if (!store) {
    console.warn(
      '[growth/ledger] Upstash not configured — survey answers dropped',
    );
    return;
  }
  const key = `sig:${opts.email}`;
  try {
    let existing: SignupRecord | null = null;
    const raw = await store.get(key);
    if (raw) {
      try {
        existing = JSON.parse(raw) as SignupRecord;
      } catch {
        existing = null; // corrupt record — rebuild it
      }
    }
    const record: SignupRecord = {
      // Spread first — merge, don't clobber (same pattern as recordSignup).
      ...existing,
      email: opts.email,
      // Survey tokens are only minted at signup time (consent just given),
      // so "now" is an honest fallback when no record predates us.
      consentAt: existing?.consentAt ?? new Date().toISOString(),
      products: existing?.products ?? [],
      ...(opts.euPremium !== undefined ? {euPremium: opts.euPremium} : {}),
      ...(opts.interviewOptIn !== undefined
        ? {interviewOptIn: opts.interviewOptIn}
        : {}),
      updatedAt: Math.floor(Date.now() / 1000),
    };
    await store.put(key, JSON.stringify(record));

    if (!existing) {
      const indexed = await listPush(env, INDEX_KEY, key, INDEX_CAP);
      if (!indexed) {
        console.warn('[growth/ledger] att:idx append failed for', key);
      }
    }
  } catch (err) {
    console.warn('[growth/ledger] recordSurveyAnswers failed', err);
  }
}

/** Persist an attributed order (`ord:<id>`) and append it to `att:idx`. */
export async function recordOrder(
  env: UpstashEnv,
  order: AttributedOrder,
): Promise<void> {
  const store = getTicketStore(env);
  if (!store) {
    console.warn(
      '[growth/ledger] Upstash not configured — order record dropped',
      order.id,
    );
    return;
  }
  const key = `ord:${order.id}`;
  await store.put(key, JSON.stringify(order));
  const indexed = await listPush(env, INDEX_KEY, key, INDEX_CAP);
  if (!indexed) {
    console.warn('[growth/ledger] att:idx append failed for', key);
  }
}

/** Read one attributed order back, or null (missing / unconfigured). */
export async function getOrder(
  env: UpstashEnv,
  orderId: string,
): Promise<AttributedOrder | null> {
  const store = getTicketStore(env);
  if (!store) return null;
  const raw = await store.get(`ord:${orderId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AttributedOrder;
  } catch {
    return null;
  }
}
