import {useEffect, useId, useRef, useState} from 'react';
import {Link, useLoaderData, useNavigate} from 'react-router';
import type {Route} from './+types/support';
import {SUPPORT_CUSTOMER_PREFILL_QUERY} from '~/graphql/customer-account/SupportPrefillQuery';
import {readSupportCookie, verifyTicket} from '~/lib/support/session';
import {
  countOpenForCustomer,
  getMeta,
  listByCustomer,
  type TicketIndexEntry,
} from '~/lib/support/ticket-index';
import {fetchGuildPreview, type GuildPreview} from '~/lib/support/discord';
import {SupportThread} from '~/components/SupportThread';
import {FeedbackModal} from '~/components/FeedbackModal';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Support',
    description:
      'Reach the OpenDrone team via Discord or open a support ticket — replies are routed back to the same crew.',
  });

type OpenTicketBanner = {
  pid: string;
  lastActivityAt: number;
  resumeHref: string;
};

type CommonSidebar = {
  discordInvite: string;
  discordGuildId: string | null;
  guildPreview: GuildPreview | null;
  contactTel: string | null;
  openTicketBanner: OpenTicketBanner | null;
};

type LoaderData =
  | ({phase: 'signed-out'} & CommonSidebar)
  | ({
      phase: 'intake';
      turnstileSiteKey: string | null;
      prefill: {name: string; email: string; customerId: string};
    } & CommonSidebar)
  | {
      phase: 'active';
      ticket: {
        pid: string;
        subject: string;
        status: 'open' | 'awaiting' | 'progress' | 'resolved';
        customerName: string;
        product?: string;
        firmware?: string;
        openedAt: number;
      };
    };

export async function loader({request, context}: Route.LoaderArgs) {
  const env = context.env;

  // `?new=1` is the explicit "open another ticket" entry point when the
  // user already has an active ticket. Skip the cookie-active redirect so
  // the intake form is reachable; the new ticket will replace the cookie
  // focus on submission. The previous ticket continues to live in the
  // Discord thread + Upstash index and remains visible in /account/support.
  const url = new URL(request.url);
  const forceNew = url.searchParams.get('new') === '1';

  // Cookie-bound active ticket takes precedence — that's the live thread.
  const cookie = readSupportCookie(request);
  const verifiedCookie = await verifyTicket(env, cookie);
  const cookieTicket = forceNew ? null : verifiedCookie;
  if (cookieTicket) {
    const meta = await getMeta(env, cookieTicket.tid);
    return {
      phase: 'active' as const,
      ticket: {
        pid: cookieTicket.pid ?? '',
        subject: meta?.subject ?? 'Support ticket',
        status: (meta?.status === 'closed'
          ? 'resolved'
          : 'open') as LoaderData extends {phase: 'active'; ticket: {status: infer S}}
          ? S
          : never,
        customerName: cookieTicket.name,
        product: meta?.product,
        firmware: meta?.firmware,
        openedAt: meta?.openedAt ?? cookieTicket.createdAt,
      },
    } satisfies LoaderData;
  }

  let prefill: {name: string; email: string; customerId: string} | null = null;
  try {
    const {data} = await context.customerAccount.query(
      SUPPORT_CUSTOMER_PREFILL_QUERY,
    );
    const c = data?.customer;
    const emailAddr = c?.emailAddress?.emailAddress;
    if (c?.id && emailAddr) {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
      prefill = {
        name: name || emailAddr.split('@')[0],
        email: emailAddr,
        customerId: c.id,
      };
    }
  } catch {
    /* anon */
  }

  const discordInvite =
    env.PUBLIC_DISCORD_INVITE ??
    env.DISCORD_SUPPORT_INVITE ??
    'https://discord.gg/ABajnacUsS';
  const discordGuildId =
    env.PUBLIC_DISCORD_GUILD_ID ?? env.DISCORD_GUILD_ID ?? null;
  const guildPreview = await fetchGuildPreview(
    env,
    discordGuildId ?? undefined,
  ).catch(() => null);
  const contactTel = env.PUBLIC_COMPANY_TEL ?? null;

  // Surface an "active ticket" banner when the user can still resume one
  // but isn't being routed into ActiveView. Two cases:
  //  1. `?new=1` — user explicitly opted to open a separate ticket; their
  //     previous cookie-bound ticket is still alive. Warn them.
  //  2. Logged-in customer with no cookie (e.g. signed in on a new device)
  //     but with open tickets in the Upstash index — point them to
  //     /account/support to resume.
  let openTicketBanner: OpenTicketBanner | null = null;
  if (forceNew && verifiedCookie?.pid) {
    openTicketBanner = {
      pid: verifiedCookie.pid,
      lastActivityAt: verifiedCookie.createdAt,
      resumeHref: '/support',
    };
  } else if (prefill?.customerId) {
    const openCount = await countOpenForCustomer(env, prefill.customerId);
    if (openCount > 0) {
      const list: TicketIndexEntry[] = await listByCustomer(
        env,
        prefill.customerId,
        {status: 'open', limit: 1},
      );
      if (list[0]) {
        openTicketBanner = {
          pid: list[0].pid,
          lastActivityAt: list[0].lastActivityAt,
          resumeHref: '/account/support',
        };
      }
    }
  }

  const sidebar: CommonSidebar = {
    discordInvite,
    discordGuildId,
    guildPreview,
    contactTel,
    openTicketBanner,
  };

  if (!prefill) {
    return {phase: 'signed-out' as const, ...sidebar} satisfies LoaderData;
  }
  return {
    phase: 'intake' as const,
    ...sidebar,
    turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? null,
    prefill,
  } satisfies LoaderData;
}

export default function SupportRoute() {
  const data = useLoaderData<typeof loader>();
  if (data.phase === 'active') {
    return <ActiveView ticket={data.ticket} />;
  }
  return <ContactHub data={data} />;
}

const COPY = {
  eyebrow: 'FILE 09 · SUPPORT',
  title: 'Talk to ',
  titleEm: 'builders',
  titleSuffix: ', not a help desk.',
  lede:
    'OpenDrone is run by a small team. Most questions get answered fastest in our Discord — that’s where the engineers live. If Discord isn’t your thing, open a ticket and we’ll thread it back to the same crew.',
  discordEyebrow: '↗ PRIMARY · LIVE NOW',
  discordTitle: 'Join the OpenDrone Discord',
  discordLede:
    'Direct line to the people building the boards. Show your bench, post your logs, get feedback.',
  discordCta: 'Go to server →',
  onlineLabel: 'online',
  membersLabel: 'members',
  estLabel: 'Est.',
  directEyebrow: '⌖ DIRECT',
  phoneLabel: 'Phone',
  securityLabel: 'Security',
  securityValue: 'Responsible disclosure ↗',
  hoursLabel: 'Hours · CET',
  hoursValue: 'Mon–Fri · 09:00–18:00',
} as const;

type Copy = typeof COPY;

function ContactHub({
  data,
}: {
  data:
    | ({phase: 'signed-out'} & CommonSidebar)
    | ({
        phase: 'intake';
        turnstileSiteKey: string | null;
        prefill: {name: string; email: string; customerId: string};
      } & CommonSidebar);
}) {
  return (
    <article className="od-page-frame contact-page-frame">
      <header className="od-page-head">
        <p className="od-eyebrow">{COPY.eyebrow}</p>
        <h1>
          {COPY.title}
          <em>{COPY.titleEm}</em>
          {COPY.titleSuffix}
        </h1>
        <p>{COPY.lede}</p>
      </header>

      {data.openTicketBanner ? (
        <OpenTicketBannerView banner={data.openTicketBanner} />
      ) : null}

      <div className="contact-main-grid">
        <DiscordWidget
          guildId={data.discordGuildId}
          discordInvite={data.discordInvite}
          guildPreview={data.guildPreview}
          copy={COPY}
        />
        <div className="contact-side-stack">
          {data.phase === 'signed-out' ? (
            <SignInPromptTile />
          ) : (
            <IntakeForm
              turnstileSiteKey={data.turnstileSiteKey}
              prefill={data.prefill}
            />
          )}
          <DirectContactTile contactTel={data.contactTel} copy={COPY} />
        </div>
      </div>
    </article>
  );
}

function OpenTicketBannerView({banner}: {banner: OpenTicketBanner}) {
  return (
    <div className="contact-banner-active" role="status" aria-live="polite">
      <div className="od-banner-meta">
        <span className="od-status is-open" aria-hidden="true">
          Open
        </span>
        <span className="od-banner-text">
          You have an active support ticket <strong>#{banner.pid}</strong>
        </span>
        <span className="od-banner-id">— continue where you left off</span>
      </div>
      <Link to={banner.resumeHref} className="od-btn od-btn-primary">
        Continue thread →
      </Link>
    </div>
  );
}

function SignInPromptTile() {
  const returnTo =
    typeof window !== 'undefined'
      ? encodeURIComponent('/support')
      : '%2Fsupport';
  return (
    <div className="od-tile od-tile-gold contact-tile-ticket">
      <p className="od-tile-eyebrow">→ TICKET · SIGN IN REQUIRED</p>
      <h2>Open a support ticket</h2>
      <p>
        We tie tickets to your account so we can pull your order, see what
        board rev you&rsquo;re on, and so you can resume the thread from any
        device.
      </p>
      <div className="support-signin-actions-row">
        <a
          href={`/account/login?return_to=${returnTo}`}
          className="od-btn od-btn-primary"
        >
          Sign in →
        </a>
        <a
          href={`/account/login?return_to=${returnTo}`}
          className="od-btn od-btn-secondary"
        >
          Create account
        </a>
      </div>
    </div>
  );
}

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
          height="620"
          loading="lazy"
          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
        />
      </section>
    );
  }
  return (
    <DiscordInviteCard
      discordInvite={discordInvite}
      guildPreview={guildPreview}
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
  if (!guildPreview) {
    return (
      <section
        className="discord-invite-card discord-invite-fallback"
        aria-label="Discord"
      >
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
    <section
      className="discord-invite-card"
      aria-label={`${guildPreview.name} on Discord`}
    >
      <div className="discord-invite-banner" aria-hidden="true" />
      <div className="discord-invite-body">
        <div className="discord-invite-icon" aria-hidden="true">
          {guildPreview.iconUrl ? (
            <img
              src={guildPreview.iconUrl}
              alt=""
              width={64}
              height={64}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span>{initials || 'OD'}</span>
          )}
        </div>
        <h2 className="discord-invite-name">{guildPreview.name}</h2>
        <div className="discord-invite-stats">
          <span>
            <span
              className="discord-invite-dot discord-invite-dot-online"
              aria-hidden="true"
            />
            <strong>{guildPreview.presenceCount.toLocaleString()}</strong>{' '}
            {copy.onlineLabel}
          </span>
          <span>
            <span
              className="discord-invite-dot discord-invite-dot-idle"
              aria-hidden="true"
            />
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

function DirectContactTile({
  contactTel,
  copy,
}: {
  contactTel: string | null;
  copy: Copy;
}) {
  // Email is intentionally omitted here — scrapers harvest mailto links
  // off every public page. The legal docs (privacy, terms, withdrawal,
  // warranty) still display the address where EU B2C disclosure requires
  // it; everything else funnels through the ticket form above.
  return (
    <div className="od-tile contact-tile-direct">
      <p className="od-tile-eyebrow">{copy.directEyebrow}</p>
      {contactTel && contactTel !== '[pending]' ? (
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

function IntakeForm({
  turnstileSiteKey,
  prefill,
}: {
  turnstileSiteKey: string | null;
  prefill: {name: string; email: string; customerId: string};
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const formId = useId();
  const navigate = useNavigate();

  // Turnstile script.
  useEffect(() => {
    if (!turnstileSiteKey) return;
    const SCRIPT_ID = 'cf-turnstile-script';
    function render() {
      const cf = (window as unknown as {turnstile?: Turnstile}).turnstile;
      if (!cf || !turnstileContainerRef.current) return;
      if (turnstileWidgetId.current) return;
      const id = cf.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey!,
        theme: 'dark',
        size: 'flexible',
      });
      turnstileWidgetId.current = id ?? null;
    }
    if ((window as unknown as {turnstile?: Turnstile}).turnstile) {
      render();
      return;
    }
    if (document.getElementById(SCRIPT_ID)) return;
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [turnstileSiteKey]);

  function appendFiles(incoming: FileList | null): string | null {
    if (!incoming?.length) return null;
    const next = [...files];
    for (const f of Array.from(incoming)) {
      if (next.length >= 5) return 'Max 5 files.';
      if (f.size > 8 * 1024 * 1024) return `${f.name}: over 8 MB.`;
      const total = next.reduce((s, x) => s + x.size, 0) + f.size;
      if (total > 24 * 1024 * 1024) return 'Total over 24 MB.';
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      next.push(f);
    }
    setFiles(next);
    return null;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.delete('files');
    files.forEach((f) => fd.append('files', f));
    try {
      const res = await fetch('/api/support/start', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      });
      const json = (await res.json()) as
        | {ok: true; pid?: string}
        | {ok: false; message: string; code?: string};
      if (json.ok) {
        // Loader on /support will see the new cookie and render the active state.
        void navigate('/support', {replace: true});
      } else {
        if ('code' in json && json.code === 'signin-required') {
          window.location.href = `/account/login?return_to=${encodeURIComponent('/support')}`;
          return;
        }
        setError(json.message);
        const cf = (window as unknown as {turnstile?: Turnstile}).turnstile;
        if (cf && turnstileWidgetId.current)
          cf.reset(turnstileWidgetId.current);
      }
    } catch (err) {
      console.error('[support] start failed', err);
      setError('Could not reach the server. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="od-tile contact-tile-ticket">
      <p className="od-tile-eyebrow">→ TICKET · ONE OPEN AT A TIME</p>
      <h2>Open a ticket</h2>
      <p>
        Signed in as <strong>{prefill.email}</strong>. We&rsquo;ll reply in
        the same window — usually within a few hours during CET business
        time.
      </p>
      <form
        id={formId}
        className="support-intake-form"
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        noValidate
      >
        <div className="od-field-row">
          <div className="od-field">
            <label htmlFor="sup-product">
              Product <span className="od-opt">— optional</span>
            </label>
            <select
              id="sup-product"
              name="product"
              className="od-select"
              defaultValue=""
              disabled={busy}
            >
              <option value="">— Pick one —</option>
              <option value="OpenESC">
                OpenESC (Electronic Speed Controller)
              </option>
              <option value="OpenFC">OpenFC (Flight Controller)</option>
              <option value="OpenRX">OpenRX (Receiver)</option>
              <option value="OpenMotor">OpenMotor</option>
              <option value="OpenFrame">OpenFrame</option>
              <option value="Other">Other / not sure</option>
            </select>
          </div>
          <div className="od-field">
            <label htmlFor="sup-fw">
              Firmware version <span className="od-opt">— if known</span>
            </label>
            <input
              id="sup-fw"
              name="firmware"
              type="text"
              className="od-input"
              maxLength={80}
              placeholder="e.g. BLHeli-32 v32.10"
              disabled={busy}
            />
          </div>
        </div>

        <div className="od-field">
          <label htmlFor="sup-subj">
            Subject{' '}
            <span className="od-req" aria-label="required">
              *
            </span>
          </label>
          <input
            id="sup-subj"
            name="subject"
            type="text"
            className="od-input"
            required
            minLength={4}
            maxLength={120}
            placeholder="A short title — what's the issue in 5 words?"
            disabled={busy}
          />
        </div>

        <div className="od-field">
          <label htmlFor="sup-msg">
            What&rsquo;s happening{' '}
            <span className="od-req" aria-label="required">
              *
            </span>
          </label>
          <textarea
            id="sup-msg"
            name="message"
            className="od-textarea"
            rows={6}
            required
            maxLength={4000}
            placeholder="Describe what you tried, what you saw, and what you expected. Logs and a short clip help a lot."
            disabled={busy}
          />
        </div>

        <div className="od-field">
          <label>
            Attachments{' '}
            <span className="od-opt">
              — images, logs, video up to 24 MB
            </span>
          </label>
          <div className="support-attach-strip" aria-label="Attached files">
            {files.map((f, i) => (
              <IntakeChip
                key={`${f.name}-${i}`}
                file={f}
                onRemove={() =>
                  setFiles((prev) => prev.filter((_, idx) => idx !== i))
                }
              />
            ))}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const err = appendFiles(e.target.files);
                if (err) setError(err);
                if (e.target) e.target.value = '';
              }}
            />
            <button
              type="button"
              className="od-btn od-btn-secondary od-btn-sm"
              disabled={busy || files.length >= 5}
              onClick={() => fileInputRef.current?.click()}
            >
              + Add file
            </button>
          </div>
        </div>

        {/* Honeypot */}
        <label className="sr-only" aria-hidden="true">
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>

        <div className="support-intake-form-actions">
          {turnstileSiteKey ? (
            <div ref={turnstileContainerRef} aria-label="Bot check" />
          ) : (
            <span className="od-turnstile" aria-hidden="true">
              <span className="od-turnstile-box" />
              Verifying you&rsquo;re human · Cloudflare Turnstile
            </span>
          )}
          <button
            type="submit"
            className="od-btn od-btn-primary"
            disabled={busy}
          >
            {busy ? 'Opening ticket…' : 'Open ticket →'}
          </button>
        </div>

        {error ? (
          <p className="support-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function IntakeChip({file, onRemove}: {file: File; onRemove: () => void}) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);
  return (
    <span className={`support-attach-chip${isImage ? ' is-image' : ''}`}>
      {isImage && thumb ? (
        <img
          className="od-thumb"
          src={thumb}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <span>📎 {file.name}</span>
      <span className="od-help" style={{fontSize: 10}}>
        {formatBytes(file.size)}
      </span>
      <button
        type="button"
        className="od-x"
        aria-label={`Remove ${file.name}`}
        onClick={onRemove}
      >
        ×
      </button>
    </span>
  );
}

function ActiveView({
  ticket,
}: {
  ticket: {
    pid: string;
    subject: string;
    status: 'open' | 'awaiting' | 'progress' | 'resolved';
    customerName: string;
  };
}) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const navigate = useNavigate();

  async function closeAndExit() {
    try {
      await fetch('/api/support/close', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      /* still navigate away — the cookie cleared if the call landed */
    }
    // Send the user to their account history — the closed thread now
    // appears under "Resolved" so the conversation isn't lost.
    void navigate('/account/support', {replace: true});
  }

  return (
    <div className="od-page-frame od-page-wide">
      <SupportThread
        mode="live"
        ticket={ticket}
        onEnd={() => setFeedbackOpen(true)}
      />
      <FeedbackModal
        open={feedbackOpen}
        onSkip={() => {
          setFeedbackOpen(false);
          void closeAndExit();
        }}
        onSubmitted={() => {
          setFeedbackOpen(false);
          void closeAndExit();
        }}
      />
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type Turnstile = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      theme?: 'dark' | 'light' | 'auto';
      size?: 'normal' | 'compact' | 'flexible';
      callback?: (token: string) => void;
    },
  ) => string | undefined;
  reset: (id?: string) => void;
};
