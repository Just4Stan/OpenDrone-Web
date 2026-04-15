import {Link} from 'react-router';
import type {Locale} from '~/lib/i18n';

/**
 * Shared layout for legal/compliance routes. Receives already-rendered
 * HTML for the active locale from the route loader. The NL/EN switch
 * lives in the global site header.
 */
export function LegalPage({
  title,
  eyebrow = 'Legal',
  html,
  locale,
  lastUpdated,
  children,
}: {
  title: string;
  eyebrow?: string;
  html?: string;
  locale?: Locale;
  lastUpdated?: string;
  children?: React.ReactNode;
}) {
  const overviewHref = locale ? `/${locale}/legal` : '/legal';
  return (
    <article className="legal-page page-shell">
      <div className="policy-back-link">
        <Link to={overviewHref}>← Back to legal overview</Link>
      </div>
      <header className="page-header">
        <p className="page-eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
      </header>

      {html ? (
        <div
          className="rich-content legal-body"
          dangerouslySetInnerHTML={{__html: html}}
        />
      ) : null}

      {children ? <div className="rich-content legal-body">{children}</div> : null}

      {lastUpdated ? (
        <p className="legal-last-updated">Last updated: {lastUpdated}</p>
      ) : null}
    </article>
  );
}
