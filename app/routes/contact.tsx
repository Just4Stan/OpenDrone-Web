import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/contact';
import {SupportWidget} from '~/components/SupportWidget';
import {SUPPORT_CUSTOMER_PREFILL_QUERY} from '~/graphql/customer-account/SupportPrefillQuery';
import {legalLabels, resolveLegalLoader} from '~/lib/i18n';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = ({data}) => {
  const locale = data?.locale ?? 'en';
  const labels = legalLabels('contact', locale);
  return buildSeoMeta({
    title: labels.title,
    description: labels.description,
    locale: locale === 'nl' ? 'nl_BE' : 'en_US',
    alternateLocales: [locale === 'nl' ? 'en_US' : 'nl_BE'],
    canonical: data?.canonicalUrl,
    hreflang: data?.hreflang,
  });
};

export async function loader({request, context}: Route.LoaderArgs) {
  const legal = await resolveLegalLoader(request, 'contact', 'contact');

  // If the visitor is signed into Shopify customer accounts, prefill the
  // ticket form with their name + email and tag the Discord post with
  // their customer id. We swallow auth errors so anonymous visitors get
  // an empty form, not a 401.
  let prefill: {name: string; email: string; customerId: string} | null = null;
  try {
    const {data} = await context.customerAccount.query(
      SUPPORT_CUSTOMER_PREFILL_QUERY,
    );
    const c = data?.customer;
    if (c) {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
      const email = c.emailAddress?.emailAddress ?? '';
      if (email) {
        prefill = {name, email, customerId: c.id};
      }
    }
  } catch {
    // Not logged in, or scope missing — fine, fall through to anon flow.
  }

  return {
    ...legal,
    contactEmail: context.env.PUBLIC_COMPANY_EMAIL ?? 'contact@opendrone.be',
    contactTel: context.env.PUBLIC_COMPANY_TEL ?? null,
    turnstileSiteKey: context.env.TURNSTILE_SITE_KEY ?? null,
    discordInvite:
      context.env.DISCORD_SUPPORT_INVITE ?? 'https://discord.gg/ABajnacUsS',
    supportEnabled: Boolean(
      context.env.DISCORD_BOT_TOKEN && context.env.DISCORD_SUPPORT_CHANNEL_ID,
    ),
    prefill,
  };
}

const COPY = {
  en: {
    eyebrow: 'Contact',
    title: 'Talk to us',
    lede: 'Built in the open — and supported in the open. Discord is the fastest path; engineers and builders hang out there every day. No Discord? Open a ticket. For order issues or anything that needs a human, call or email.',
    discordEyebrow: 'Community · primary path',
    discordTitle: 'Join the Discord',
    discordLede:
      'Firmware help, build logs, debugging, release notes — it all happens here first. You usually get a real answer in minutes.',
    discordCta: 'Open Discord',
    ticketEyebrow: 'No Discord?',
    ticketTitle: 'Open a support ticket here',
    ticketLede:
      'Same team, just slower. Your ticket lands in our Discord as a private thread; replies come straight back to this chat in seconds.',
    directEyebrow: 'Escalations · order issues',
    directTitle: 'Talk to us directly',
    directLede:
      'For order issues, business questions, or anything that needs a phone call. We respond within two business days.',
    callLabel: 'Call',
    emailLabel: 'Email',
    securityEyebrow: 'Security disclosure',
    securityTitle: 'Found a vulnerability?',
    securityLede:
      'Coordinated disclosure has its own channel — please don’t use the support inbox.',
    securityCta: 'See /security',
    referenceEyebrow: 'On record',
    offlineNote:
      'The web-chat bridge isn’t configured on this environment yet. Use Discord, email, or phone for now.',
  },
  nl: {
    eyebrow: 'Contact',
    title: 'Neem contact op',
    lede: 'We bouwen in de open — en helpen in de open. Discord is de snelste weg; ingenieurs en bouwers hangen er elke dag rond. Geen Discord? Open een ticket. Voor bestellingen of iets dat een mens nodig heeft, bel of mail.',
    discordEyebrow: 'Community · primaire weg',
    discordTitle: 'Kom op Discord',
    discordLede:
      'Firmware-hulp, build logs, debugging, release notes — alles gebeurt hier eerst. Meestal krijg je binnen enkele minuten een echt antwoord.',
    discordCta: 'Open Discord',
    ticketEyebrow: 'Geen Discord?',
    ticketTitle: 'Open hier een support ticket',
    ticketLede:
      'Zelfde team, iets trager. Je ticket komt bij ons binnen als een privé thread op Discord; antwoorden komen meteen terug naar deze chat.',
    directEyebrow: 'Escalaties · bestellingen',
    directTitle: 'Ons rechtstreeks bereiken',
    directLede:
      'Voor bestellingen, zakelijke vragen, of iets dat een telefoongesprek vereist. We reageren binnen twee werkdagen.',
    callLabel: 'Bel',
    emailLabel: 'E-mail',
    securityEyebrow: 'Veiligheidsmelding',
    securityTitle: 'Een kwetsbaarheid gevonden?',
    securityLede:
      'Gecoördineerde melding heeft een eigen kanaal — gebruik de support-inbox niet.',
    securityCta: 'Naar /security',
    referenceEyebrow: 'Wettelijk',
    offlineNote:
      'De web-chat-brug is nog niet geconfigureerd op deze omgeving. Gebruik voorlopig Discord, e-mail of telefoon.',
  },
} as const;

export default function ContactRoute() {
  const {
    html,
    locale,
    contactEmail,
    contactTel,
    turnstileSiteKey,
    discordInvite,
    supportEnabled,
    prefill,
  } = useLoaderData<typeof loader>();
  const t = COPY[locale === 'nl' ? 'nl' : 'en'];

  return (
    <article className="contact-page page-shell">
      <header className="contact-hero">
        <p className="contact-hero-eyebrow">{t.eyebrow}</p>
        <h1 className="contact-hero-title">{t.title}</h1>
        <p className="contact-hero-lede">{t.lede}</p>
      </header>

      <section className="contact-tier contact-tier-discord">
        <div className="contact-tier-text">
          <p className="contact-tier-eyebrow">{t.discordEyebrow}</p>
          <h2 className="contact-tier-title">{t.discordTitle}</h2>
          <p className="contact-tier-lede">{t.discordLede}</p>
        </div>
        <div className="contact-tier-action">
          <a
            className="contact-tier-cta contact-tier-cta-primary"
            href={discordInvite}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t.discordCta} →
          </a>
        </div>
      </section>

      <section className="contact-tier contact-tier-ticket">
        <div className="contact-tier-text">
          <p className="contact-tier-eyebrow">{t.ticketEyebrow}</p>
          <h2 className="contact-tier-title">{t.ticketTitle}</h2>
          <p className="contact-tier-lede">{t.ticketLede}</p>
        </div>
        <div className="contact-tier-widget">
          {supportEnabled ? (
            <SupportWidget
              turnstileSiteKey={turnstileSiteKey}
              discordInvite={discordInvite}
              embedded
              prefill={prefill}
            />
          ) : (
            <p className="contact-offline-note">{t.offlineNote}</p>
          )}
        </div>
      </section>

      <section className="contact-tier-row">
        <div className="contact-tier-card">
          <p className="contact-tier-eyebrow">{t.directEyebrow}</p>
          <h3 className="contact-tier-card-title">{t.directTitle}</h3>
          <p className="contact-tier-lede">{t.directLede}</p>
          <ul className="contact-direct-list">
            {contactTel ? (
              <li>
                <span className="contact-direct-label">{t.callLabel}</span>
                <a href={`tel:${contactTel.replace(/[^+\d]/g, '')}`}>
                  {contactTel}
                </a>
              </li>
            ) : null}
            <li>
              <span className="contact-direct-label">{t.emailLabel}</span>
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            </li>
          </ul>
        </div>
        <div className="contact-tier-card contact-tier-card-security">
          <p className="contact-tier-eyebrow">{t.securityEyebrow}</p>
          <h3 className="contact-tier-card-title">{t.securityTitle}</h3>
          <p className="contact-tier-lede">{t.securityLede}</p>
          <Link className="contact-security-cta" to="/security">
            {t.securityCta} →
          </Link>
        </div>
      </section>

      {html ? (
        <aside className="contact-reference" aria-label={t.referenceEyebrow}>
          <p className="contact-reference-eyebrow">{t.referenceEyebrow}</p>
          <div
            className="contact-reference-body"
            dangerouslySetInnerHTML={{__html: html}}
          />
        </aside>
      ) : null}
    </article>
  );
}
