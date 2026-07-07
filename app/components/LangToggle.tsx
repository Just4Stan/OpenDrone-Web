import {useLocation} from 'react-router';
import {SegmentedControl, type SegmentDef} from '~/components/SegmentedControl';
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

const LABELS: Record<Locale, string> = {nl: 'NL', fr: 'FR', en: 'EN'};
const ORDER: readonly Locale[] = ['nl', 'fr', 'en'];

/* Placement variants, self-contained so the primitive stays generic and this
   component no longer depends on the (now-orphaned) app.css .lang-toggle rules:
   the header copy still hides on phones (it would overflow a 320px legal row —
   the drawer renders the full-size toggle instead), the drawer copy keeps its
   spacing. */
const LANG_STYLE = `
@media (max-width:768px){.segmented.header-lang-toggle{display:none;}}
.segmented.mobile-menu-lang{margin-top:0.5rem;align-self:flex-start;}
`;

/**
 * NL/FR/EN language toggle for legal/regulatory pages. Renders nothing on
 * non-legal routes — the rest of the site is English-only.
 *
 * A SegmentedControl flick switch: the sled rests over the active locale. Each
 * segment is a navigation Link that swaps the locale segment of the URL and
 * refreshes the preference cookie so SSR picks the right language next time.
 */
export function LangToggle({className}: {className?: string} = {}) {
  const location = useLocation();
  if (!isLegalPath(location.pathname)) return null;

  const currentLocale = localeFromPathname(location.pathname);
  const active: Locale = currentLocale ?? 'en';

  const ensurePrefix = (target: Locale) =>
    currentLocale
      ? swapLocale(location.pathname, target)
      : '/' + target + stripLocale(location.pathname);

  const segments: ReadonlyArray<SegmentDef<Locale>> = ORDER.map((loc) => ({
    value: loc,
    label: LABELS[loc],
    ariaLabel: LABELS[loc],
    href: ensurePrefix(loc) + location.search,
    onSelect: () => writeLangCookie(loc),
  }));

  return (
    <>
      <SegmentedControl<Locale>
        value={active}
        segments={segments}
        ariaLabel="Language"
        className={className}
      />
      <style>{LANG_STYLE}</style>
    </>
  );
}
