import type {Route} from './+types/wholesale';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';
import {getCompanyIdentity} from '~/lib/company';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Wholesale · Dealers & distributors',
    description:
      'Stock the OpenDrone open-source hardware line: flight controllers, ESCs, receivers and frames, designed in Belgium. Dealer terms available on request.',
  });

export async function loader({context}: Route.LoaderArgs) {
  const company = getCompanyIdentity(
    context.env as unknown as Record<string, string | undefined>,
  );
  return {company};
}

export default function WholesaleRoute({loaderData}: Route.ComponentProps) {
  const {company} = loaderData;
  const mailto = `mailto:${company.email}?subject=${encodeURIComponent(
    'Wholesale inquiry',
  )}`;

  return (
    <div className="editorial-page">
      <header className="editorial-hero">
        <p className="editorial-eyebrow">Wholesale · B2B</p>
        {/* TODO(copy-stan): placeholder hero copy — rewrite in your voice. */}
        <h1 className="editorial-title">
          Put open hardware <em>on your shelf.</em>
        </h1>
        <p className="editorial-lead">
          We&apos;re building a dealer channel for the OpenDrone line. If you
          run an FPV shop in the EU and want boards whose designs your
          customers can actually read, this page is for you.
        </p>
      </header>

      <section className="editorial-section">
        <h2 className="editorial-section-title">01 · Who this is for</h2>
        {/* TODO(copy-stan): placeholder. */}
        <p>
          EU-based FPV retailers and distributors, first. You know your local
          scene better than a webshop in Leuven ever will; we&apos;d rather
          your customers get local stock, local advice and local returns than
          wait on a parcel from us.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">02 · What you&apos;d be stocking</h2>
        {/* TODO(copy-stan): placeholder — line-up facts from the catalog;
            keep claims to what the shop itself states. */}
        <ul className="editorial-list">
          <li>
            <strong>The line</strong>: flight controllers (OpenFC Lite), 4-in-1
            ESCs (OpenESC), ExpressLRS receivers (OpenRX) and carbon frames
            (OpenFrame). Designed in Belgium, sold with EU consumer law taken
            seriously.
          </li>
          <li>
            <strong>Open source, for real</strong>: every board&apos;s full
            design source is public under CERN-OHL-S v2. Your customers can
            audit what you sell them: that is the pitch.
          </li>
          <li>
            <strong>Standard firmware</strong>: Betaflight, AM32 and
            ExpressLRS, no vendor forks. Nothing for your support desk to
            special-case.
          </li>
          <li>
            <strong>Dealer terms</strong>: B2B pricing and terms exist and are
            shared on request, not on a public page.
          </li>
        </ul>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">03 · Talk to us</h2>
        {/* TODO(copy-stan): placeholder. */}
        <p>
          Tell us who you are, where you sell, and roughly what volume you
          think makes sense. A human answers: the same people who design the
          boards.
        </p>
        <p>
          Email <a href={mailto}>{company.email}</a> with
          &ldquo;Wholesale&rdquo; in the subject, or use the support chat and
          say you&apos;re a shop.
        </p>
      </section>

      <section className="editorial-cta">
        <a href={mailto} className="editorial-cta-primary">
          Email {company.email} →
        </a>
        <Link prefetch="viewport" to="/support" className="editorial-cta-secondary">
          Open support chat →
        </Link>
      </section>
    </div>
  );
}
