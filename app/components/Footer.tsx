import {NavLink} from 'react-router';
import type {HeaderQuery} from 'storefrontapi.generated';
import type {CompanyIdentity} from '~/lib/company';
import {CompanyFooterBlock} from '~/components/CompanyFooterBlock';
import {NewsletterSignup} from '~/components/NewsletterSignup';

interface FooterProps {
  header: HeaderQuery;
  publicStoreDomain: string;
  company: CompanyIdentity;
  turnstileSiteKey?: string | null;
}

const SHOP_LINKS: Array<{to: string; label: string}> = [
  {to: '/collections/all', label: 'Catalog'},
  {to: '/search', label: 'Search'},
];

const OPEN_SOURCE_LINKS: Array<{href: string; label: string}> = [
  {href: 'https://github.com/Just4Stan', label: 'GitHub'},
  {href: 'https://github.com/Just4Stan/OpenFC', label: 'OpenFC'},
  {href: 'https://github.com/Just4Stan/Open-4in1-AM32-ESC', label: 'OpenESC'},
];

const COMPANY_LINKS: Array<{to: string; label: string}> = [
  {to: '/open-source', label: 'How we open source'},
  {to: '/firmware-partners', label: 'Firmware partners'},
  {to: '/legal', label: 'Legal / Imprint'},
  {to: '/contact', label: 'Contact'},
  {to: '/security', label: 'Security'},
];

const LEGAL_LINKS: Array<{to: string; label: string}> = [
  {to: '/algemene-voorwaarden', label: 'Algemene Voorwaarden'},
  {to: '/privacy', label: 'Privacy'},
  {to: '/cookies', label: 'Cookies'},
  {to: '/herroepingsrecht', label: 'Herroepingsrecht'},
  {to: '/shipping', label: 'Shipping'},
  {to: '/warranty', label: 'Warranty'},
  {to: '/export-compliance', label: 'Export Compliance'},
  {to: '/cookie-settings', label: 'Cookie settings'},
];

function ColumnHeading({children}: {children: React.ReactNode}) {
  return (
    <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3">
      {children}
    </h4>
  );
}

function FooterNavLink({to, children}: {to: string; children: React.ReactNode}) {
  return (
    <NavLink
      end
      prefetch="intent"
      to={to}
      className={({isActive}) =>
        `text-xs transition-colors ${
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

export function Footer({company, turnstileSiteKey}: FooterProps) {
  return (
    <footer className="mt-auto border-t border-[var(--color-border)]">
      <div className="site-footer-inner">
        {/* Newsletter card — visually separated with bg-card + border so
            it reads as its own surface, not as a stretch of empty footer.
            Padding tightened to drop the previous block of dead vertical
            space the bare hr/border layout left behind. */}
        <div className="mb-8 rounded-sm border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 md:p-6">
          <NewsletterSignup
            variant="footer"
            turnstileSiteKey={turnstileSiteKey ?? null}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company identity */}
          <div className="md:col-span-1">
            <h3 className="font-display text-sm font-bold tracking-[0.08em] uppercase text-[var(--color-gold)] mb-3">
              OpenDrone
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)] mb-3 leading-relaxed">
              OpenDrone is a product brand of
            </p>
            <CompanyFooterBlock company={company} />
          </div>

          {/* Shop */}
          <div>
            <ColumnHeading>Shop</ColumnHeading>
            <nav className="flex flex-col gap-1.5">
              {SHOP_LINKS.map((link) => (
                <FooterNavLink key={link.to} to={link.to}>
                  {link.label}
                </FooterNavLink>
              ))}
            </nav>
          </div>

          {/* Open Source + Company */}
          <div>
            <ColumnHeading>Open Source</ColumnHeading>
            <nav className="flex flex-col gap-1.5 mb-6">
              {OPEN_SOURCE_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <ColumnHeading>Company</ColumnHeading>
            <nav className="flex flex-col gap-1.5">
              {COMPANY_LINKS.map((link) => (
                <FooterNavLink key={link.to} to={link.to}>
                  {link.label}
                </FooterNavLink>
              ))}
            </nav>
          </div>

          {/* Legal */}
          <div>
            <ColumnHeading>Legal</ColumnHeading>
            <nav className="flex flex-col gap-1.5">
              {LEGAL_LINKS.map((link) => (
                <FooterNavLink key={link.to} to={link.to}>
                  {link.label}
                </FooterNavLink>
              ))}
            </nav>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-5 border-t border-[var(--color-border)] flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-[10px] text-[var(--color-text-muted)] font-mono tracking-wide">
            &copy; {new Date().getFullYear()} {company.name}. Hardware:
            CERN-OHL-S. Firmware: GPL/MIT. Open Source Hardware.
          </p>
          <a
            href="https://github.com/Just4Stan"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            aria-label="GitHub"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
