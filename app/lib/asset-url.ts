/**
 * Absolute URL for a file under `public/`, served from the asset CDN.
 *
 * On Oxygen the build sets Vite's `base` to the deployment's
 * cdn.shopify.com path and mirrors `public/` there. A `/boards/x.webp`
 * request on the SITE origin instead goes through Oxygen's image pipeline,
 * which re-encodes every bitmap as PNG (a 106 KB lossless WebP came back as
 * a 366 KB PNG, measured 2026-08-15), so bitmaps must be addressed on the
 * CDN. In dev `BASE_URL` is "/" and this is the same path.
 */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
export function assetUrl(path: string): string {
  return path.startsWith('/') ? `${BASE}${path}` : `${BASE}/${path}`;
}
