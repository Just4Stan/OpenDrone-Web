import {Suspense} from 'react';
import {Await, NavLink} from 'react-router';
import type {FooterQuery, HeaderQuery} from 'storefrontapi.generated';

interface FooterProps {
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  publicStoreDomain: string;
}

export function Footer({
  footer: footerPromise,
  header,
  publicStoreDomain,
}: FooterProps) {
  return (
    <footer className="mt-auto border-t border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <h3 className="font-display text-sm font-bold tracking-[0.08em] uppercase text-[var(--color-gold)] mb-2">
              OpenDrone
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Open source drone electronics.<br />
              Designed in Belgium.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3">
              Shop
            </h4>
            <Suspense>
              <Await resolve={footerPromise}>
                {(footer) =>
                  footer?.menu && header.shop.primaryDomain?.url ? (
                    <FooterMenu
                      menu={footer.menu}
                      primaryDomainUrl={header.shop.primaryDomain.url}
                      publicStoreDomain={publicStoreDomain}
                    />
                  ) : null
                }
              </Await>
            </Suspense>
          </div>

          {/* Open Source */}
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3">
              Open Source
            </h4>
            <nav className="flex flex-col gap-1.5">
              <a
                href="https://github.com/Just4Stan"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://github.com/Just4Stan/OpenFC"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                OpenFC
              </a>
              <a
                href="https://github.com/Just4Stan/Open-4in1-AM32-ESC"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                OpenESC
              </a>
            </nav>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3">
              Legal
            </h4>
            <div className="flex flex-col gap-1.5 font-mono text-xs text-[var(--color-text-muted)]">
              <p>OpenDrone</p>
              <p>Belgium</p>
              <p>KBO/BCE: [pending]</p>
              <p>BTW/TVA: [pending]</p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-5 border-t border-[var(--color-border)] flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-[10px] text-[var(--color-text-muted)] font-mono tracking-wide">
            &copy; {new Date().getFullYear()} OpenDrone. Hardware: CERN-OHL-S. Firmware: GPL/MIT.
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

function FooterMenu({
  menu,
  primaryDomainUrl,
  publicStoreDomain,
}: {
  menu: FooterQuery['menu'];
  primaryDomainUrl: FooterProps['header']['shop']['primaryDomain']['url'];
  publicStoreDomain: string;
}) {
  return (
    <nav className="flex flex-col gap-1.5" role="navigation">
      {(menu || FALLBACK_FOOTER_MENU).items.map((item) => {
        if (!item.url) return null;
        const url =
          item.url.includes('myshopify.com') ||
          item.url.includes(publicStoreDomain) ||
          item.url.includes(primaryDomainUrl)
            ? new URL(item.url).pathname
            : item.url;
        const isExternal = !url.startsWith('/');
        return isExternal ? (
          <a
            href={url}
            key={item.id}
            rel="noopener noreferrer"
            target="_blank"
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            {item.title}
          </a>
        ) : (
          <NavLink
            end
            key={item.id}
            prefetch="intent"
            to={url}
            className={({isActive}) =>
              `text-xs transition-colors ${
                isActive
                  ? 'text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`
            }
          >
            {item.title}
          </NavLink>
        );
      })}
    </nav>
  );
}

const FALLBACK_FOOTER_MENU = {
  id: 'gid://shopify/Menu/199655620664',
  items: [
    {
      id: 'gid://shopify/MenuItem/461633060920',
      resourceId: 'gid://shopify/ShopPolicy/23358046264',
      tags: [],
      title: 'Privacy Policy',
      type: 'SHOP_POLICY',
      url: '/policies/privacy-policy',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461633093688',
      resourceId: 'gid://shopify/ShopPolicy/23358013496',
      tags: [],
      title: 'Refund Policy',
      type: 'SHOP_POLICY',
      url: '/policies/refund-policy',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461633126456',
      resourceId: 'gid://shopify/ShopPolicy/23358111800',
      tags: [],
      title: 'Shipping Policy',
      type: 'SHOP_POLICY',
      url: '/policies/shipping-policy',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461633159224',
      resourceId: 'gid://shopify/ShopPolicy/23358079032',
      tags: [],
      title: 'Terms of Service',
      type: 'SHOP_POLICY',
      url: '/policies/terms-of-service',
      items: [],
    },
  ],
};
