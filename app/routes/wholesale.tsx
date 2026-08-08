import type {Route} from './+types/wholesale';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';
import {MarginArt, ShopfrontArt, ShelfArt, EnvelopeArt} from '~/components/MarginArt';
import {getCompanyIdentity} from '~/lib/company';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';

/**
 * Copy lives in `content/copy/wholesale.json`. The address itself does not:
 * it comes from the company identity in the environment, so the sentences
 * that quote it are split around the value rather than hard-coding it into
 * an editable string that would then go stale.
 */
export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: copyText('wholesale.meta_title') ?? 'Wholesale',
    description: copyText('wholesale.meta_description') ?? '',
  });

export async function loader({context}: Route.LoaderArgs) {
  const company = getCompanyIdentity(
    context.env as unknown as Record<string, string | undefined>,
  );
  return {company};
}

/** The four stocking points. Order and the bold lead-in are structure. */
const STOCK_ITEMS = [1, 2, 3, 4];

export default function WholesaleRoute({loaderData}: Route.ComponentProps) {
  const {company} = loaderData;
  const mailto = `mailto:${company.email}?subject=${encodeURIComponent(
    'Wholesale inquiry',
  )}`;

  return (
    <div className="editorial-page">
      <header className="editorial-hero">
        <Txt id="wholesale.eyebrow" as="p" className="editorial-eyebrow" />
        <Txt id="wholesale.title" as="h1" className="editorial-title" />
        <Txt id="wholesale.lead" as="p" className="editorial-lead" />
      </header>

      <section className="editorial-section">
        <Txt
          id="wholesale.s1_title"
          as="h2"
          className="editorial-section-title"
        />
        <MarginArt><ShopfrontArt /></MarginArt>
        <Txt id="wholesale.s1_body" as="p" />
      </section>

      <section className="editorial-section">
        <Txt
          id="wholesale.s2_title"
          as="h2"
          className="editorial-section-title"
        />
        <MarginArt><ShelfArt /></MarginArt>
        <ul className="editorial-list">
          {STOCK_ITEMS.map((n) => (
            <li key={n}>
              <strong>
                <Txt id={`wholesale.s2_item${n}_label`} />
              </strong>
              <Txt id={`wholesale.s2_item${n}_body`} />
            </li>
          ))}
        </ul>
      </section>

      <section className="editorial-section">
        <Txt
          id="wholesale.s3_title"
          as="h2"
          className="editorial-section-title"
        />
        <MarginArt><EnvelopeArt /></MarginArt>
        <Txt id="wholesale.s3_body" as="p" />
        <p>
          <Txt id="wholesale.s3_email_before" />{' '}
          <a href={mailto}>{company.email}</a>{' '}
          <Txt id="wholesale.s3_email_after" />
        </p>
      </section>

      <section className="editorial-cta">
        <a href={mailto} className="editorial-cta-primary">
          <Txt id="wholesale.cta_primary_before" /> {company.email}{' '}
          <Txt id="wholesale.cta_primary_after" />
        </a>
        <Link prefetch="viewport" to="/support" className="editorial-cta-secondary">
          <Txt id="wholesale.cta_secondary" />
        </Link>
      </section>
    </div>
  );
}
