import {useEffect, useState} from 'react';
import type {Route} from './+types/cookie-settings';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Cookie settings',
    description:
      'Overzicht en beheer van cookies op de OpenDrone webshop. Alleen strikt noodzakelijke cookies.',
    robots: 'noindex',
  });

type CookieRow = {name: string; value: string};

function readCookies(): CookieRow[] {
  if (typeof document === 'undefined') return [];
  return document.cookie
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const eq = c.indexOf('=');
      return {
        name: eq >= 0 ? c.slice(0, eq) : c,
        value: eq >= 0 ? c.slice(eq + 1) : '',
      };
    });
}

const KNOWN = [
  {
    name: 'cart',
    purpose:
      'Koppelt uw winkelwagen aan uw browser sessie. Strikt noodzakelijk.',
  },
  {
    name: 'cart_sig',
    purpose: 'Beveiligingshandtekening voor de winkelwagen cookie.',
  },
  {
    name: '_secure_session_id',
    purpose: 'Sessie beveiliging bij Shopify checkout. Strikt noodzakelijk.',
  },
  {
    name: 'localization',
    purpose: 'Onthoudt gekozen taal/regio voor de storefront.',
  },
];

export default function CookieSettingsRoute() {
  const [cookies, setCookies] = useState<CookieRow[]>([]);

  useEffect(() => {
    setCookies(readCookies());
  }, []);

  function clearAll() {
    if (typeof document === 'undefined') return;
    for (const c of cookies) {
      // best-effort session wipe (not path/domain aware for httpOnly)
      document.cookie = `${c.name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // ignore
    }
    setCookies(readCookies());
  }

  return (
    <div className="cookie-settings page-shell">
      <header className="page-header">
        <p className="page-eyebrow">Legal</p>
        <h1 className="page-title">Cookie settings</h1>
        <p className="page-description">
          De OpenDrone webshop gebruikt <strong>geen marketing cookies</strong>{' '}
          en vraagt geen toestemming — alleen strikt noodzakelijke cookies
          worden geplaatst voor winkelwagen en checkout. Analytics loopt via
          Plausible, dat cookieless is. Zie ook het{' '}
          <a href="/cookies">cookiebeleid</a>.
        </p>
      </header>

      <div className="rich-content">
        <h2>Strikt noodzakelijke cookies</h2>
        <table className="cookie-settings-table">
          <thead>
            <tr>
              <th>Naam</th>
              <th>Doel</th>
            </tr>
          </thead>
          <tbody>
            {KNOWN.map((k) => (
              <tr key={k.name}>
                <td>
                  <code>{k.name}</code>
                </td>
                <td>{k.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Cookies die momenteel in uw browser staan</h2>
        {cookies.length === 0 ? (
          <p>Geen cookies zichtbaar voor dit domein vanaf de client.</p>
        ) : (
          <table className="cookie-settings-table">
            <thead>
              <tr>
                <th>Naam</th>
                <th>Waarde (afgekapt)</th>
              </tr>
            </thead>
            <tbody>
              {cookies.map((c) => (
                <tr key={c.name}>
                  <td>
                    <code>{c.name}</code>
                  </td>
                  <td>
                    <code>{c.value.slice(0, 48)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p>
          <button
            type="button"
            onClick={clearAll}
            className="account-button"
          >
            Alle sessie cookies wissen
          </button>
        </p>
        <p style={{color: 'var(--color-text-muted)', fontSize: '0.75rem'}}>
          HttpOnly cookies kunnen niet vanuit de client gewist worden. Gebruik
          uw browser privacy-instellingen voor een volledige reset.
        </p>
      </div>
    </div>
  );
}
