/**
 * Verify Shopify Admin webhook HMAC.
 *
 * Shopify signs every webhook payload with the shared secret configured
 * on the webhook subscription, and sends the base64 SHA-256 HMAC in the
 * `X-Shopify-Hmac-Sha256` header. We compare in constant time on the
 * RAW request body — any reserialization (e.g. JSON.parse → stringify)
 * will break the signature.
 *
 * https://shopify.dev/docs/apps/build/webhooks/subscribe/https#verify
 */

const enc = new TextEncoder();

export async function verifyShopifyWebhook(
  secret: string,
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!secret || !signatureHeader) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const computed = bytesToBase64(new Uint8Array(sig));
  return constantTimeEqual(computed, signatureHeader.trim());
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
