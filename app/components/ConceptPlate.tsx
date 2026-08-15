import {Link} from 'react-router';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';
import {DISCORD_INVITE_URL} from '~/lib/company';
import type {ProductStatus as RoadmapStatus} from '~/lib/roadmap-data';

/**
 * Stand-in for the product page while a product is `planned` or
 * `in-progress`. Nothing about such a product is settled (shape, spec,
 * price, timing), so it gets no hero, specs, teardown or buy module: only
 * the name, the status chip and the door to Discord where the design
 * happens. Alpha and beyond render the full page (Stan, 2026-08-15).
 */
export function ConceptPlate({
  title,
  status,
}: {
  title: string;
  status: RoadmapStatus;
}) {
  return (
    <div className="product-page concept-plate">
      <section className="concept-plate-inner">
        <p className="product-hero-eyebrow">
          <Txt id="product-chrome.concept_eyebrow" as="span" />
          <Link
            prefetch="viewport"
            to="/roadmap"
            className="product-status-chip"
            data-status={status}
            title={copyText(`roadmap.status_${status}_legend`)}
          >
            <span className="kanban-dot" aria-hidden="true" />
            {copyText(`roadmap.status_${status}_label`)}
          </Link>
        </p>
        <h1 className="product-hero-headline">{title}</h1>
        <Txt
          id="product-chrome.concept_body"
          as="p"
          className="concept-plate-body"
        />
        <div className="concept-plate-actions">
          <a
            className="product-buy-idea-repo"
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {copyText('product-chrome.concept_discord_cta')}
          </a>
          <Link className="product-buy-idea-repo" to="/roadmap">
            {copyText('product-chrome.concept_roadmap_cta')}
          </Link>
        </div>
      </section>
    </div>
  );
}
