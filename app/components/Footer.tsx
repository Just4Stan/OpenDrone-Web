import {Suspense} from 'react';
import {Await} from 'react-router';
import {NavLink} from '~/components/nav';
import type {HeaderQuery} from 'storefrontapi.generated';
import type {CompanyIdentity} from '~/lib/company';
import type {NewsletterAccount} from '~/components/PageLayout';
import {CompanyFooterBlock} from '~/components/CompanyFooterBlock';
import {NewsletterSignup} from '~/components/NewsletterSignup';
import {FooterRevCell} from '~/components/LatestCommit';

/**
 * Fixed annotation-label vocabulary for the chrome (isolated here for a single
 * Stan review pass). Only 'REV' is a new label — the nav/column headings below
 * are existing copy, rendered verbatim. Every layout must read fine with these
 * dropped (the REV cell falls back to `a1b2c3f · 2026-07-06`).
 */
export const DOC_ANNOTATIONS = {
  rev: 'REV',
} as const;

interface FooterProps {
  header: HeaderQuery;
  publicStoreDomain: string;
  company: CompanyIdentity;
  turnstileSiteKey?: string | null;
  newsletterAccount?: Promise<NewsletterAccount>;
}

const SHOP_LINKS: Array<{to: string; label: string}> = [
  {to: '/collections/all', label: 'All Products'},
  {to: '/newsletter', label: 'Newsletter'},
  {to: '/search', label: 'Search'},
];

const OPEN_SOURCE_LINKS: Array<{href: string; label: string}> = [
  {href: 'https://github.com/incutec-hw', label: 'GitHub'},
  {href: 'https://github.com/incutec-hw/OpenFC', label: 'OpenFC'},
  {href: 'https://github.com/incutec-hw/OpenESC_20X20', label: 'OpenESC'},
];

const COMPANY_LINKS: Array<{to: string; label: string}> = [
  {to: '/incutec', label: 'Who’s Incutec'},
  {to: '/open-source', label: 'How we open source'},
  {to: '/firmware-partners', label: 'Firmware partners'},
  {to: '/roadmap', label: 'Roadmap'},
  {to: '/production', label: 'Production'},
  {to: '/wholesale', label: 'Wholesale'},
  {to: '/legal', label: 'Legal / Imprint'},
  {to: '/support', label: 'Contact'},
  {to: '/security', label: 'Security'},
];

const LEGAL_LINKS: Array<{to: string; label: string}> = [
  {to: '/algemene-voorwaarden', label: 'Terms & Conditions'},
  {to: '/privacy', label: 'Privacy'},
  {to: '/cookies', label: 'Cookies'},
  {to: '/herroepingsrecht', label: 'Right of withdrawal'},
  {to: '/shipping', label: 'Shipping'},
  {to: '/warranty', label: 'Warranty'},
  {to: '/export-compliance', label: 'Export compliance'},
  {to: '/cookie-settings', label: 'Cookie settings'},
];

function ColumnHeading({
  children,
  stacked = false,
}: {
  children: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <h4
      className={`doc-annot footer-cell-heading${
        stacked ? ' footer-cell-heading--stacked' : ''
      }`}
    >
      {children}
    </h4>
  );
}

function FooterNavLink({to, children}: {to: string; children: React.ReactNode}) {
  return (
    <NavLink
      end
      prefetch="viewport"
      to={to}
      className={({isActive}) =>
        `text-xs transition-colors flex items-center min-h-[44px] md:min-h-0 ${
          isActive
            ? 'text-[var(--color-text)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export function Footer({
  company,
  turnstileSiteKey,
  newsletterAccount,
}: FooterProps) {
  return (
    <footer className="mt-auto border-t border-[var(--color-border)]">
      <div className="site-footer-inner">
        {/* Newsletter — separated by a hairline + whitespace, not a card box.
            The form carries its own hierarchy. Subscription-aware: the deferred
            account state swaps the form for a "you're subscribed" panel (or
            prefills the email for a signed-in non-subscriber). Falls back to the
            plain form for guests / while the deferred state resolves. */}
        <div className="mb-8 pb-8 border-b border-[var(--color-border)]">
          {newsletterAccount ? (
            <Suspense
              fallback={
                <NewsletterSignup
                  variant="footer"
                  turnstileSiteKey={turnstileSiteKey ?? null}
                />
              }
            >
              <Await resolve={newsletterAccount} errorElement={null}>
                {(account) => (
                  <NewsletterSignup
                    variant="footer"
                    turnstileSiteKey={turnstileSiteKey ?? null}
                    account={account ?? null}
                  />
                )}
              </Await>
            </Suspense>
          ) : (
            <NewsletterSignup
              variant="footer"
              turnstileSiteKey={turnstileSiteKey ?? null}
            />
          )}
        </div>
        {/* KiCad title block — a ruled multi-cell grid (1px-gap technique). The
            company identity is the drawing's owner box; the nav columns are
            bordered cells; the copyright sits in the license box; the REV cell
            reports the flagship repo's HEAD. Mobile: cells stack, the gaps
            collapse to horizontal rules. */}
        <div className="footer-titleblock ruled-table">
          {/* Company identity — the owner box */}
          <div className="footer-cell footer-cell--company">
            {/* gold-tag: main's light-mode fix — gives the gold wordmark a
                near-black chip in light mode (no-op in dark). */}
            <h3 className="gold-tag doc-label footer-cell-heading footer-brand-heading">
              OpenDrone
            </h3>
            <p className="footer-brand-note">
              OpenDrone is a product brand of
            </p>
            <CompanyFooterBlock company={company} />
          </div>

          {/* Shop */}
          <div className="footer-cell">
            <ColumnHeading>Shop</ColumnHeading>
            <nav className="footer-cell-nav">
              {SHOP_LINKS.map((link) => (
                <FooterNavLink key={link.to} to={link.to}>
                  {link.label}
                </FooterNavLink>
              ))}
            </nav>
          </div>

          {/* Open Source + Company */}
          <div className="footer-cell">
            <ColumnHeading>Open Source</ColumnHeading>
            <nav className="footer-cell-nav">
              {OPEN_SOURCE_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-nav-link text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors flex items-center min-h-[44px] md:min-h-0"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <ColumnHeading stacked>Company</ColumnHeading>
            <nav className="footer-cell-nav">
              {COMPANY_LINKS.map((link) => (
                <FooterNavLink key={link.to} to={link.to}>
                  {link.label}
                </FooterNavLink>
              ))}
            </nav>
          </div>

          {/* Legal */}
          <div className="footer-cell">
            <ColumnHeading>Legal</ColumnHeading>
            <nav className="footer-cell-nav">
              {LEGAL_LINKS.map((link) => (
                <FooterNavLink key={link.to} to={link.to}>
                  {link.label}
                </FooterNavLink>
              ))}
            </nav>
          </div>

          {/* License box — copyright line verbatim + the GitHub mark */}
          <div className="footer-cell footer-cell--license">
            <p className="footer-license doc-cell">
              &copy; {new Date().getFullYear()} {company.name}. Hardware:
              CERN-OHL-S. Firmware: GPL/MIT. Open Source Hardware.
            </p>
            <a
              href="https://github.com/incutec-hw"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              aria-label="GitHub"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
          </div>

          {/* REV box — the drawing's revision cell */}
          <div className="footer-cell footer-cell--rev">
            <FooterRevCell label={DOC_ANNOTATIONS.rev} />
          </div>
        </div>
      </div>
    </footer>
  );
}
