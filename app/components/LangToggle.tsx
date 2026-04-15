import {Link, useLocation} from 'react-router';
import {
  LANG_COOKIE,
  localeFromPathname,
  swapLocale,
  type Locale,
} from '~/lib/i18n';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function writeLangCookie(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.cookie = `${LANG_COOKIE}=${locale}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * Global NL/EN language toggle. On legal pages it navigates to the
 * equivalent URL in the other locale (`/en/warranty` ↔ `/nl/warranty`).
 * On pages without a locale prefix (home, products, …) it still writes
 * the preference cookie so the next legal page visit lands in the right
 * language.
 *
 * The cookie is also refreshed on navigation so SSR always picks up the
 * latest choice.
 */
export function LangToggle({className}: {className?: string} = {}) {
  const location = useLocation();
  const currentLocale = localeFromPathname(location.pathname);
  const active: Locale = currentLocale ?? 'en';

  const nlHref = currentLocale
    ? swapLocale(location.pathname, 'nl') + location.search
    : location.pathname + location.search;
  const enHref = currentLocale
    ? swapLocale(location.pathname, 'en') + location.search
    : location.pathname + location.search;

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
