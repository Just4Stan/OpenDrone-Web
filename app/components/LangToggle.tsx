import {Link, useLocation} from 'react-router';
import {
  LANG_COOKIE,
  isLegalPath,
  localeFromPathname,
  swapLocale,
  stripLocale,
  type Locale,
} from '~/lib/i18n';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function writeLangCookie(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.cookie = `${LANG_COOKIE}=${locale}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * NL/EN language toggle for legal/regulatory pages. Renders nothing on
 * non-legal routes — the rest of the site is English-only.
 *
 * On a legal page it swaps `/en/slug` ↔ `/nl/slug` and refreshes the
 * preference cookie so SSR picks the right language next time.
 */
export function LangToggle({className}: {className?: string} = {}) {
  const location = useLocation();
  if (!isLegalPath(location.pathname)) return null;

  const currentLocale = localeFromPathname(location.pathname);
  const active: Locale = currentLocale ?? 'en';

  // For unprefixed legal URLs (/privacy, etc.), target the locale-prefixed
  // form so clicks actually change the rendered language.
  const ensurePrefix = (target: Locale) =>
    currentLocale
      ? swapLocale(location.pathname, target)
      : '/' + target + stripLocale(location.pathname);

  const nlHref = ensurePrefix('nl') + location.search;
  const enHref = ensurePrefix('en') + location.search;

  return (
    <div
      className={`lang-toggle${className ? ` ${className}` : ''}`}
      role="group"
      aria-label="Language"
    >
      <Link
        to={nlHref}
        preventScrollReset
        prefetch="intent"
        aria-pressed={active === 'nl'}
        onClick={() => writeLangCookie('nl')}
        data-active={active === 'nl' ? 'true' : undefined}
      >
        NL
      </Link>
      <Link
        to={enHref}
        preventScrollReset
        prefetch="intent"
        aria-pressed={active === 'en'}
        onClick={() => writeLangCookie('en')}
        data-active={active === 'en' ? 'true' : undefined}
      >
        EN
      </Link>
    </div>
  );
}
