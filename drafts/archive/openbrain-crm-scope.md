# OpenBrain CRM buildout - scope (Lane F, drafted 2026-07-06)

Companion to `drafts/growth-infra-brief.md` (Lane F) and the OpenBrain repo's
IMPLEMENTATION.md track C. This is the marketing/demand side; track C (support
ticket store) already exists flag-gated in `/Users/stan/OpenBrain`.

## Position

- The web repo's Upstash ledger (`app/lib/growth/ledger.ts`) is the interim
  system of record for signups (`sig:<email>`: consentAt, locale, channel,
  products[], euPremium, interviewOptIn) and attributed orders (`ord:<id>`).
- OpenBrain becomes the durable home once the EU box + DPA review land
  (IMPLEMENTATION.md hard prerequisites - unchanged by this lane).
- Research verdict (growth-stack-research.md §D): build contacts/consents/
  interactions tables in OpenBrain + a sqladmin/Starlette-Admin panel. No
  Twenty/Attio/EspoCRM. Respect the old M4 non-goals: no deal pipelines, no CDP.

## Schema (extends crm.* alongside existing customer/ticket/message)

- `crm.contact` - id, email UNIQUE (join key), shopify_customer_id NULL (link
  when known), locale, first_channel, created_at, erasure_requested_at.
  NOTE: unlike crm.customer (account-bound, ticket FK), contact is
  marketing-side and exists pre-account. Merge policy: when a contact later
  gets a Shopify account, link both records by email; do NOT unify tables.
- `crm.consent` - contact FK, kind ('newsletter' | 'notify:<handle>'),
  granted_at, source ('web-form'), revoked_at NULL. Mirrors Shopify
  acceptsMarketing + Resend unsubscribe state; this table is the audit trail.
- `crm.interaction` - contact FK, ts, kind ('signup' | 'survey' | 'order' |
  'email-blast' | 'interview'), payload JSONB (euPremium answer, order id +
  channel + total, broadcast id…). Append-only.
- RtbF: DEL cascade from contact + the web-side dual delete (Upstash sig DEL +
  Resend contact delete) - one runbook, three stores.

## Ingest

1. **Backfill import**: script reading the web ledger via Upstash REST
   (`att:idx` walk) → upsert contacts/consents/interactions. Idempotent on
   (email, ts, kind). Runs from the EU box; Upstash creds provided at run time.
2. **Ongoing**: web repo POSTs to OpenBrain (`X-OpenBrain-Key`, same trust
   boundary as tickets API) - new endpoint `POST /crm/events` accepting the
   ledger record shapes verbatim. Web keeps writing Upstash too until cutover;
   flag `GROWTH_SINK=upstash|openbrain|both` web-side.
3. **Shopify webhooks direct to OpenBrain** (old M4 scope: ORDERS_*, CUSTOMERS_*,
   GDPR topics) - phase 2, replaces the web-repo webhook as attribution sink.

## Admin panel

sqladmin (or Starlette-Admin) mounted on the existing FastAPI app, read/write
on contact/consent/interaction, read-only on ticket. Auth: same key gate as
cockpit initially; EU box only, never public.

## Order of work (after EU hosting exists)

1. Schema + models + tests (mirror crm_schema.sql opt-in pattern, `--crm-mkt` flag).
2. Backfill importer + dry-run against a ledger export.
3. `/crm/events` endpoint + web-side sink flag.
4. Admin panel.
5. Shopify webhook receivers + GDPR webhooks (then retire web-repo webhook).

Non-goals: email sending from OpenBrain (Resend stays web-side), pipelines,
scoring, anything the old M4 explicitly excluded.
