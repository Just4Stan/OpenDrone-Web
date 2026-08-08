import {Link} from 'react-router';

export function EmptyState({
  title,
  description,
  ctaLabel,
  ctaTo,
  secondary,
}: {
  // ReactNode, not string: callers pass <Txt id="…"> so the studio can edit
  // the words in place. Plain strings still work.
  title: React.ReactNode;
  description?: React.ReactNode;
  ctaLabel?: React.ReactNode;
  ctaTo?: string;
  secondary?: React.ReactNode;
}) {
  return (
    <div className="empty-state" role="status">
      <div className="empty-state-icon" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2 className="empty-state-title">{title}</h2>
      {description && <p className="empty-state-body">{description}</p>}
      <div className="empty-state-actions">
        {ctaLabel && ctaTo && (
          <Link to={ctaTo} className="hero-cta-primary" prefetch="viewport">
            {ctaLabel}
          </Link>
        )}
        {secondary}
      </div>
    </div>
  );
}
