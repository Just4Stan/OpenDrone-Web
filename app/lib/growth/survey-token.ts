/**
 * Short-lived signed tokens gating the notify micro-survey.
 *
 * The survey endpoint (/api/survey) has no Turnstile of its own — it is
 * only reachable with a token minted by the newsletter action after a
 * fully verified notify signup (consent + Turnstile + rate limits all
 * passed there). The token binds the answers to the signed-up email so
 * the endpoint can't be used to attach survey opinions to arbitrary
 * addresses.
 *
 * Same HMAC recipe as app/lib/support/resume-token.ts but a *separate
 * audience string* is mixed into the signed payload, so a leaked survey
 * token can never be replayed against the support-resume flow (or vice
 * versa) even though both schemes share SESSION_SECRET.
 *
 * Deliberately tiny: payload is `email|exp` (unix seconds), TTL 15
 * minutes — long enough to answer two questions on the success panel,
 * short enough that a leaked token is stale by the time it travels.
 * Token format: `b64url(email).exp.b64url(hmac)`.
 */

const enc = new TextEncoder();
const SURVEY_AUD = 'notify-survey-v1';
const DEFAULT_TTL_SECONDS = 15 * 60;

type Env = {SESSION_SECRET?: string};

function b64urlEncode(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(s: string): Uint8Array | null {
  try {
    const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : '';
    const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmac(key: string, payload: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(payload));
  return b64urlEncode(sig);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Mint a survey token for a just-signed-up email. Returns null (rather
 * than throwing) when SESSION_SECRET is unset — the caller simply omits
 * the token and the client never shows the survey. Degrade-soft: a
 * misconfigured secret must not break the signup response.
 */
export async function signSurveyToken(
  env: Env,
  email: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<string | null> {
  if (!env.SESSION_SECRET) {
    console.warn('[growth/survey-token] SESSION_SECRET unset — no token');
    return null;
  }
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = await hmac(env.SESSION_SECRET, `${SURVEY_AUD}|${email}|${exp}`);
  return `${b64urlEncode(enc.encode(email))}.${exp}.${sig}`;
}

/**
 * Verify a survey token. Returns the bound email, or null on any
 * failure (malformed, bad signature, expired, secret unset).
 */
export async function verifySurveyToken(
  env: Env,
  token: string | null | undefined,
): Promise<{email: string} | null> {
  if (!token || !env.SESSION_SECRET) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [emailB64, expRaw, sig] = parts;
  const emailBytes = b64urlDecode(emailB64);
  if (!emailBytes) return null;
  const email = new TextDecoder().decode(emailBytes);
  const exp = Number(expRaw);
  if (!email || !Number.isInteger(exp)) return null;
  const expected = await hmac(
    env.SESSION_SECRET,
    `${SURVEY_AUD}|${email}|${exp}`,
  );
  if (!constantTimeEqual(expected, sig)) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  return {email};
}
