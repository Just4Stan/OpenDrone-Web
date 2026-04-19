/**
 * Cloudflare Turnstile server-side verification. Widget posts the token,
 * the Worker verifies it before creating a Discord thread. When
 * TURNSTILE_SECRET_KEY is unset (dev or staging without the secret) the
 * verifier no-ops and returns true so local development isn't blocked.
 */

type Env = {TURNSTILE_SECRET_KEY?: string};

export async function verifyTurnstile(
  env: Env,
  token: string | undefined | null,
  remoteIp?: string | null,
): Promise<{ok: boolean; reason?: string}> {
  if (!env.TURNSTILE_SECRET_KEY) {
    // In development / staging without a secret key we let the request
    // through so the intake form can still be exercised. In production
    // a missing secret is a config error — fail CLOSED rather than
    // silently disable bot protection on every ticket.
    const inProd =
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');
    if (inProd) {
      console.error('[turnstile] SECRET_KEY unset in production — failing closed');
      return {ok: false, reason: 'turnstile-misconfigured'};
    }
    return {ok: true, reason: 'turnstile-disabled'};
  }
  if (!token) return {ok: false, reason: 'missing-token'};
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET_KEY);
  form.append('response', token);
  if (remoteIp) form.append('remoteip', remoteIp);
  try {
    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {method: 'POST', body: form, signal: AbortSignal.timeout(4000)},
    );
    const data = (await res.json()) as {success: boolean; 'error-codes'?: string[]};
    return {
      ok: !!data.success,
      reason: data.success
        ? 'ok'
        : (data['error-codes']?.join(',') ?? 'verify-failed'),
    };
  } catch (err) {
    console.warn('[turnstile] verify error', err);
    return {ok: false, reason: 'verify-exception'};
  }
}
