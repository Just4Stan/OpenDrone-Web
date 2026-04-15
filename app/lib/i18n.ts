/**
 * Internationalisation helpers for legal pages.
 *
 * URL scheme
 * ----------
 * Legal pages are served at `/en/<slug>` and `/nl/<slug>`. Unprefixed
 * legacy URLs like `/warranty` redirect to the user's cached language.
 * Non-legal pages (home, products, cart, …) remain unprefixed and are
 * English-only for now.
 *
 * Caching
 * -------
 * Language preference is stored in the `opendrone_lang` cookie for one
 * year. The cookie is readable by both client and server so that the
 * server can render the correct language on the first request and the
 * toggle can update it client-side without a full round-trip.
 */

import {redirect} from 'react-router';
import {loadLegal, type LegalSlug} from '~/lib/legal';

export const LOCALES = ['en', 'nl'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LANG_COOKIE = 'opendrone_lang';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function isLocale(x: unknown): x is Locale {
  return x === 'en' || x === 'nl';
}

/**
 * Parse a Cookie header and return the cached locale, if any.
 */
export function readLocaleCookie(cookieHeader: string | null): Locale | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=(en|nl)(?:;|$)`),
  );
  if (match && isLocale(match[1])) return match[1];
  return null;
}

/**
 * Best-effort detection from the Accept-Language header. Only honours
 * Dutch — everything else falls back to the default locale (en).
 */
export function detectLocaleFromAccept(accept: string | null): Locale {
  if (!accept) return DEFAULT_LOCALE;
  // Very simple sniff: nl or nl-BE at the start of the preference list.
  if (/^\s*nl(-[a-z]{2})?\b/i.test(accept)) return 'nl';
  return DEFAULT_LOCALE;
}

/**
 * Resolve the effective locale for a request: cookie first, then
 * Accept-Language, then the default.
 */
export function getLocaleFromRequest(request: Request): Locale {
  const cookie = readLocaleCookie(request.headers.get('Cookie'));
  if (cookie) return cookie;
  return detectLocaleFromAccept(request.headers.get('Accept-Language'));
}

/**
 * Serialize the language cookie header value.
 */
export function langCookieHeader(locale: Locale): string {
  return `${LANG_COOKIE}=${locale}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * Extract the locale segment from a URL pathname. Returns `null` if the
 * path is not locale-prefixed.
 */
export function localeFromPathname(pathname: string): Locale | null {
  const first = pathname.split('/').filter(Boolean)[0];
  return isLocale(first) ? first : null;
}

/**
 * Replace or insert the locale segment in a pathname. Used by the
 * language toggle to build the "other language" URL for the current
 * page.
 */
export function swapLocale(pathname: string, target: Locale): string {
  const segments = pathname.split('/').filter(Boolean);
  if (isLocale(segments[0])) {
    segments[0] = target;
  } else {
    segments.unshift(target);
  }
  return '/' + segments.join('/');
}

/**
 * Standard loader helper used by every legal route. Determines the
 * effective locale, redirects unprefixed URLs to the canonical
 * locale-prefixed URL, loads the cleaned Markdown body, and returns
 * everything the component needs to render the page.
 *
 * Pass `slugPath` if the URL slug differs from the LegalSlug key
 * (e.g. cookies.tsx uses slug `cookie-policy` but serves at /cookies).
 */
export async function resolveLegalLoader(
  request: Request,
  legalSlug: LegalSlug,
  urlSlug: string,
): Promise<{html: string; locale: Locale}> {
  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const first = segments[0];

  if (isLocale(first)) {
    // Already locale-prefixed; render directly.
    const html = loadLegal(legalSlug, first);
    return {html, locale: first};
  }

  // Unprefixed legacy URL — redirect to the canonical locale URL and
  // refresh the cookie so subsequent visits stick.
  const locale = getLocaleFromRequest(request);
  const qs = url.search;
  throw redirect(`/${locale}/${urlSlug}${qs}`, {
    status: 302,
    headers: {'Set-Cookie': langCookieHeader(locale)},
  });
}
