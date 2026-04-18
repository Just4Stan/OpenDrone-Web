import {Link} from 'react-router';
import {LEGAL_UI_STRINGS, type Locale} from '~/lib/i18n';

/**
 * Shared layout for legal/compliance routes. Receives already-rendered
 * HTML for the active locale from the route loader. Page chrome (title,
 * eyebrow, back-link, "Last updated") localises via `locale`; the
 * legal body HTML is rendered as-is from the per-locale Markdown file.
 */
export function LegalPage({
  title,
  eyebrow = 'Legal',
  html,
  locale = 'en',
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
  const overviewHref = `/${locale}/legal`;
  const ui = LEGAL_UI_STRINGS[locale];
  return (
    <article className="legal-page page-shell">
      <div className="policy-back-link">
        <Link to={overviewHref}>{ui.backToOverview}</Link>
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
        <p className="legal-last-updated">
          {ui.lastUpdated}: {lastUpdated}
        </p>
      ) : null}
    </article>
  );
}
