import {Link, useLoaderData, type HeadersFunction} from 'react-router';
import type {Route} from './+types/contact';
import {SUPPORT_CUSTOMER_PREFILL_QUERY} from '~/graphql/customer-account/SupportPrefillQuery';
import {buildSeoMeta} from '~/lib/seo';
import {fetchGuildPreview, type GuildPreview} from '~/lib/support/discord';
import {
  countOpenForCustomer,
  listByCustomer,
  type TicketIndexEntry,
} from '~/lib/support/ticket-index';
import {readSupportCookie, verifyTicket} from '~/lib/support/session';

export const meta: Route.MetaFunction = () => {
  return buildSeoMeta({
    title: 'Contact',
    description:
      'Reach the OpenDrone team via Discord, a support ticket, or direct phone/email.',
  });
};

// Cap loader cache at 60 s so the Discord widget stats don't tail every
// page render. Public — the marketing copy doesn't vary by user, only
// the open-ticket banner does (which lives in a logged-in state we
// gate client-side via the cookie/index already, so caching is fine).
export const headers: HeadersFunction = () => ({
  'Cache-Control': 'public, max-age=60, s-maxage=60',
});

export async function loader({request, context}: Route.LoaderArgs) {
  const env = context.env;

  // Customer auth — optional. Determines whether we can show the
  // open-ticket banner that dissuades duplicate tickets.
  let customerId: string | null = null;
  try {
    const {data} = await context.customerAccount.query(
      SUPPORT_CUSTOMER_PREFILL_QUERY,
    );
    customerId = data?.customer?.id ?? null;
  } catch {
    /* anon */
  }

  // Active-ticket lookup. Two sources:
  //   1. The cookie-bound ticket (the one currently in the live widget).
  //      Always renders the banner if present, regardless of KV.
  //   2. KV index for the customer — picks up any open ticket on a
  //      different device/cookie.
  const cookie = readSupportCookie(request);
  const cookieTicket = await verifyTicket(env, cookie);

  let openTicket: {pid: string; subject: string; lastActivityAt: number} | null =
    null;
  if (cookieTicket?.pid) {
    openTicket = {
      pid: cookieTicket.pid,
      subject: '',
      lastActivityAt: cookieTicket.createdAt,
    };
  }
  if (customerId && !openTicket) {
    const openCount = await countOpenForCustomer(env, customerId);
    if (openCount > 0) {
      const list: TicketIndexEntry[] = await listByCustomer(env, customerId, {
        status: 'open',
        limit: 1,
      });
      if (list[0]) {
        openTicket = {
          pid: list[0].pid,
          subject: list[0].subject,
          lastActivityAt: list[0].lastActivityAt,
        };
      }
    }
  }

  // Public guild ID takes precedence; falls back to the bridge-side
  // binding. The official Discord widget iframe needs only the guild
  // ID — it fetches its own server name + member list. We still pull
  // the preview so the fallback (when widget is disabled in Server
  // Settings) can render with stats from the bot-token API call.
  const guildId = env.PUBLIC_DISCORD_GUILD_ID ?? env.DISCORD_GUILD_ID ?? null;
  const guildPreview = await fetchGuildPreview(env, guildId ?? undefined).catch(
    () => null,
  );

  return {
    contactEmail: env.PUBLIC_COMPANY_EMAIL ?? 'contact@opendrone.be',
    contactTel: env.PUBLIC_COMPANY_TEL ?? null,
    discordInvite:
      env.PUBLIC_DISCORD_INVITE ??
      env.DISCORD_SUPPORT_INVITE ??
      'https://discord.gg/ABajnacUsS',
    discordGuildId: guildId,
    guildPreview,
    openTicket,
  };
}

const COPY = {
  eyebrow: 'FILE 09 · CONTACT',
  title: 'Talk to ',
  titleEm: 'builders',
  titleSuffix: ', not a help desk.',
  lede: 'OpenDrone is run by a small team. Most questions get answered fastest in our Discord — that’s where the engineers live. If Discord isn’t your thing, open a ticket and we’ll thread it back to the same crew.',
  bannerText: 'You have an active support ticket',
  bannerLastReply: 'continue where you left off',
  bannerCta: 'Continue thread →',
  discordEyebrow: '↗ PRIMARY · LIVE NOW',
  discordTitle: 'Join the OpenDrone Discord',
  discordLede:
    'Direct line to the people building the boards. Show your bench, post your logs, get answers in minutes.',
  discordCta: 'Go to server →',
  onlineLabel: 'online',
  membersLabel: 'members',
  estLabel: 'Est.',
  ticketEyebrow: '→ SECONDARY',
  ticketTitle: 'No Discord? Open a ticket.',
  ticketLede:
    'Goes to the same Discord crew via a private thread. Sign in so we can link it to your order.',
  ticketCta: 'Open a ticket',
  directEyebrow: '⌖ DIRECT',
  phoneLabel: 'Phone',
  emailLabel: 'Email',
  securityLabel: 'Security',
  securityValue: 'Responsible disclosure ↗',
  hoursLabel: 'Hours · CET',
  hoursValue: 'Mon–Fri · 09:00–18:00',
} as const;

export default function ContactRoute() {
  const {
    contactEmail,
    contactTel,
    discordInvite,
    discordGuildId,
    guildPreview,
    openTicket,
  } = useLoaderData<typeof loader>();
  const t = COPY;

  return (
    <article className="od-page-frame contact-page-frame">
      <header className="od-page-head">
        <p className="od-eyebrow">{t.eyebrow}</p>
        <h1>
          {t.title}
          <em>{t.titleEm}</em>
          {t.titleSuffix}
        </h1>
        <p>{t.lede}</p>
      </header>

      {openTicket ? (
        <div className="contact-banner-active" role="status" aria-live="polite">
          <div className="od-banner-meta">
            <span className="od-status is-open" aria-hidden="true">
              Open
            </span>
            <span className="od-banner-text">
              {t.bannerText} <strong>#{openTicket.pid}</strong>
            </span>
            <span className="od-banner-id">— {t.bannerLastReply}</span>
          </div>
          <Link to="/account/support" className="od-btn od-btn-primary">
            {t.bannerCta}
          </Link>
        </div>
      ) : null}

      <div className="contact-main-grid">
        <DiscordWidget
          guildId={discordGuildId}
          discordInvite={discordInvite}
          guildPreview={guildPreview}
          copy={t}
        />
        <div className="contact-side-stack">
          {!openTicket ? (
            <TicketPointerTile copy={t} />
          ) : (
            <TicketContinueTile pid={openTicket.pid} copy={t} />
          )}
          <DirectContactTile
            contactTel={contactTel}
            contactEmail={contactEmail}
            copy={t}
          />
        </div>
      </div>
    </article>
  );
}

type Copy = typeof COPY;

// Renders Discord's official server-widget iframe when a guild ID is
// available. Falls back to the custom card when no guild ID is wired
// (so the page never breaks on misconfigured envs). The widget itself
// will display "Widget Disabled" inside the iframe when the server
// admin hasn't enabled it under Server Settings → Widget — that's a
// Discord-side setup step the customer-facing page can't fix.
function DiscordWidget({
  guildId,
  discordInvite,
  guildPreview,
  copy,
}: {
  guildId: string | null;
  discordInvite: string;
  guildPreview: GuildPreview | null;
  copy: Copy;
}) {
  // Prefer the bot-API-backed invite card whenever we have a preview —
  // Discord's `/widget` iframe needs Server Settings → Widget enabled to
  // render counts, and silently shows "0 Members Online" forever when
  // it isn't (or while it's still loading on a cold edge). The card uses
  // approximate_member_count/approximate_presence_count from the
  // authenticated /guilds endpoint and is styled to match the page.
  if (guildPreview) {
    return (
      <DiscordInviteCard
        discordInvite={discordInvite}
        guildPreview={guildPreview}
        copy={copy}
      />
    );
  }
  // No preview (no bot token, or fetch failed) but we still have a guild
  // ID — use the embeddable widget as a last-resort fallback.
  if (guildId) {
    return (
      <section
        className="contact-discord-widget"
        aria-label="Join the OpenDrone Discord"
      >
        <iframe
          title="OpenDrone on Discord"
          src={`https://discord.com/widget?id=${guildId}&theme=dark`}
          width="100%"
          height="500"
          loading="lazy"
          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
        />
      </section>
    );
  }
  return (
    <DiscordInviteCard
      discordInvite={discordInvite}
      guildPreview={null}
      copy={copy}
    />
  );
}

function DiscordInviteCard({
  discordInvite,
  guildPreview,
  copy,
}: {
  discordInvite: string;
  guildPreview: GuildPreview | null;
  copy: Copy;
}) {
  // Fallback path: Discord API failed or token/guild ID unset. Render a
  // simpler banner with just the invite link so the page never breaks
  // on a Discord outage.
  if (!guildPreview) {
    return (
      <section className="discord-invite-card discord-invite-fallback" aria-label="Discord">
        <div className="discord-invite-banner" aria-hidden="true" />
        <div className="discord-invite-body">
          <div className="discord-invite-icon" aria-hidden="true">
            <span>OD</span>
          </div>
          <h2 className="discord-invite-name">{copy.discordTitle}</h2>
          <p className="discord-invite-desc-fallback">{copy.discordLede}</p>
          <a
            href={discordInvite}
            className="discord-invite-cta"
            target="_blank"
            rel="noopener noreferrer"
          >
            {copy.discordCta}
          </a>
        </div>
      </section>
    );
  }

  const initials = guildPreview.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <section className="discord-invite-card" aria-label={`${guildPreview.name} on Discord`}>
      <div className="discord-invite-banner" aria-hidden="true" />
      <div className="discord-invite-body">
        <div className="discord-invite-icon" aria-hidden="true">
          {guildPreview.iconUrl ? (
            <img src={guildPreview.iconUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <span>{initials || 'OD'}</span>
          )}
        </div>
        <h2 className="discord-invite-name">{guildPreview.name}</h2>
        <div className="discord-invite-stats">
          <span>
            <span className="discord-invite-dot discord-invite-dot-online" aria-hidden="true" />
            <strong>{guildPreview.presenceCount.toLocaleString()}</strong>{' '}
            {copy.onlineLabel}
          </span>
          <span>
            <span className="discord-invite-dot discord-invite-dot-idle" aria-hidden="true" />
            <strong>{guildPreview.memberCount.toLocaleString()}</strong>{' '}
            {copy.membersLabel}
          </span>
        </div>
        <p className="discord-invite-est">{copy.estLabel} Apr 2026</p>
        {guildPreview.description ? (
          <p className="discord-invite-desc">{guildPreview.description}</p>
        ) : (
          <p className="discord-invite-desc">{copy.discordLede}</p>
        )}
        <a
          href={discordInvite}
          className="discord-invite-cta"
          target="_blank"
          rel="noopener noreferrer"
        >
          {copy.discordCta.replace(/\s*→\s*$/, '')}
        </a>
      </div>
    </section>
  );
}

function TicketPointerTile({copy}: {copy: Copy}) {
  return (
    <div className="od-tile contact-tile-ticket">
      <p className="od-tile-eyebrow">{copy.ticketEyebrow}</p>
      <h2>{copy.ticketTitle}</h2>
      <p>{copy.ticketLede}</p>
      <Link to="/support" className="od-btn od-btn-secondary">
        {copy.ticketCta}
      </Link>
    </div>
  );
}

function TicketContinueTile({pid, copy}: {pid: string; copy: Copy}) {
  return (
    <div className="od-tile od-tile-gold contact-tile-ticket">
      <p
        className="od-tile-eyebrow"
        style={{color: 'var(--od-pcb-gold-2)'}}
      >
        → YOUR OPEN TICKET
      </p>
      <h2>#{pid}</h2>
      <p>{copy.bannerText}.</p>
      <Link to="/account/support" className="od-btn od-btn-primary">
        {copy.bannerCta}
      </Link>
    </div>
  );
}

function DirectContactTile({
  contactTel,
  contactEmail,
  copy,
}: {
  contactTel: string | null;
  contactEmail: string;
  copy: Copy;
}) {
  return (
    <div className="od-tile contact-tile-direct">
      <p className="od-tile-eyebrow">{copy.directEyebrow}</p>
      {contactTel ? (
        <div className="contact-direct-row">
          <span className="od-k">{copy.phoneLabel}</span>
          <a
            href={`tel:${contactTel.replace(/[^+\d]/g, '')}`}
            className="od-v"
          >
            {contactTel}
          </a>
        </div>
      ) : null}
      <div className="contact-direct-row">
        <span className="od-k">{copy.emailLabel}</span>
        <a href={`mailto:${contactEmail}`} className="od-v">
          {contactEmail}
        </a>
      </div>
      <div className="contact-direct-row">
        <span className="od-k">{copy.securityLabel}</span>
        <Link to="/security" className="od-v">
          {copy.securityValue}
        </Link>
      </div>
      <div className="contact-direct-row">
        <span className="od-k">{copy.hoursLabel}</span>
        <span className="od-v">{copy.hoursValue}</span>
      </div>
    </div>
  );
}
