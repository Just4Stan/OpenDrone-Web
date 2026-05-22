# Security model

**Headers** (set in `app/entry.server.tsx`):

- `Content-Security-Policy` — Hydrogen-default + `cdn.shopify.com` + `challenges.cloudflare.com` (Turnstile) + `discord.com` (frame-src for the server widget). Nonce-based, no `'unsafe-inline'` outside the nonce.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HTTPS only)
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — camera, mic, geolocation, payment (except `self`), USB, serial, MIDI, etc. all denied
- `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-site`

`HTMLRewriter` forces `crossorigin="anonymous"` on every `<link rel="modulepreload">` and `<script type="module">` so Oxygen's asset CDN doesn't 503 during deployment-rollout windows.

**Rate limits.** Per-isolate sliding-window limiter (`app/lib/rate-limit.ts`) on every public POST: `/api/support/{start,send,poll,close,feedback,lookup,thread}`, `/newsletter`, `/api/newsletter/unsubscribe`, `/support/resume`. Best-effort — pair with Cloudflare-edge rate-limit rules for serious flood protection.

**Input caps.** `support.start` subject 256, product/firmware 80; `support.send` content 1800; `feedback.notes` 1500. Uploads: 5 files max, 8 MB/file, 24 MB total, MIME + extension allowlist.

**Cart.** `BuyerIdentityUpdate` allowlist forces `countryCode: 'BE'`.

**Board art.** `BoardArt` inlines a layered SVG via `dangerouslySetInnerHTML`. The source is a first-party static asset under `public/boards/`, generated at build time from the maintainer's own KiCad files and committed to the repo — never user input. The path is a hardcoded constant in `product-content.ts`, so there is no attacker-controlled URL or path-traversal vector, and the nonce-based CSP would block any inline script/handler regardless.

**Secrets.** `.env` is gitignored. `git log --all -p` clean of token-shaped strings (`shpat_*`, `shpss_*`, `sk_live`, `ghp_*`, `Bearer …`). Annual rotation on `SESSION_SECRET`, `SUPPORT_SESSION_SECRET`, Storefront tokens, Discord bot token, Turnstile secret.

**Vulnerability disclosure.** GitHub private vulnerability reporting enabled. Machine-readable contact at `/.well-known/security.txt`. Human-readable policy at `/security` + `app/content/legal/{en,nl,fr}/vulnerability-handling-policy.md`. Default embargo 90 days from first report.
