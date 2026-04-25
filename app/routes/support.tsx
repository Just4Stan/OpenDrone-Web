import {useEffect, useId, useRef, useState} from 'react';
import {useLoaderData, useNavigate} from 'react-router';
import type {Route} from './+types/support';
import {SUPPORT_CUSTOMER_PREFILL_QUERY} from '~/graphql/customer-account/SupportPrefillQuery';
import {readSupportCookie, verifyTicket} from '~/lib/support/session';
import {getMeta} from '~/lib/support/ticket-index';
import {SupportThread} from '~/components/SupportThread';
import {FeedbackModal} from '~/components/FeedbackModal';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Support',
    description: 'Open a support ticket — replies routed to our Discord crew.',
    robots: 'noindex,nofollow',
  });

type LoaderData =
  | {phase: 'signed-out'; discordInvite: string}
  | {
      phase: 'intake';
      discordInvite: string;
      turnstileSiteKey: string | null;
      prefill: {name: string; email: string; customerId: string};
    }
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

  // Cookie-bound active ticket takes precedence — that's the live thread.
  const cookie = readSupportCookie(request);
  const cookieTicket = await verifyTicket(env, cookie);
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
    env.DISCORD_SUPPORT_INVITE ?? 'https://discord.gg/ABajnacUsS';

  if (!prefill) {
    return {phase: 'signed-out' as const, discordInvite} satisfies LoaderData;
  }
  return {
    phase: 'intake' as const,
    discordInvite,
    turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? null,
    prefill,
  } satisfies LoaderData;
}

export default function SupportRoute() {
  const data = useLoaderData<typeof loader>();
  if (data.phase === 'signed-out') {
    return <SignedOutView discordInvite={data.discordInvite} />;
  }
  if (data.phase === 'intake') {
    return (
      <IntakeView
        discordInvite={data.discordInvite}
        turnstileSiteKey={data.turnstileSiteKey}
        prefill={data.prefill}
      />
    );
  }
  return <ActiveView ticket={data.ticket} />;
}

function SignedOutView({discordInvite}: {discordInvite: string}) {
  const returnTo =
    typeof window !== 'undefined' ? encodeURIComponent('/support') : '%2Fsupport';
  return (
    <article className="od-page-frame support-page-frame">
      <header className="od-page-head">
        <p className="od-eyebrow">FILE 09.A · SUPPORT</p>
        <h1>
          Sign in to open
          <br />a <em>support ticket</em>.
        </h1>
        <p>
          We tie tickets to your account so we can pull your order, see what
          board rev you&rsquo;re on, and so you can pick the thread back up
          from any device.
        </p>
      </header>

      <div className="support-signed-out">
        <div className="od-tile od-tile-gold support-signin">
          <p className="od-tile-eyebrow">→ SIGN IN REQUIRED</p>
          <h2>Continue with your OpenDrone account</h2>
          <p>
            One ticket, one thread. Resume from desktop or phone.
          </p>
          <ul className="support-signin-reasons">
            <li>We see exactly which SKU and firmware rev you have.</li>
            <li>You can attach order files without typing the order number.</li>
          </ul>
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
        <div className="od-tile">
          <p className="od-tile-eyebrow">↗ ALT PATH</p>
          <h3>Or come hang out on Discord</h3>
          <p>
            Discord doesn&rsquo;t need an account on our side — fastest path
            for general build questions, tuning, or show-and-tell.
          </p>
          <a
            href={discordInvite}
            target="_blank"
            rel="noreferrer noopener"
            className="od-btn od-btn-secondary"
          >
            Open Discord →
          </a>
        </div>
      </div>
    </article>
  );
}

function IntakeView({
  discordInvite,
  turnstileSiteKey,
  prefill,
}: {
  discordInvite: string;
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
        if (cf && turnstileWidgetId.current) cf.reset(turnstileWidgetId.current);
      }
    } catch (err) {
      console.error('[support] start failed', err);
      setError('Could not reach the server. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="od-page-frame od-page-narrow">
      <header className="od-page-head">
        <p className="od-eyebrow">FILE 09.A · OPEN A TICKET</p>
        <h1>
          Tell us what&rsquo;s <em>not behaving</em>.
        </h1>
        <p>
          One thread per issue. We&rsquo;ll reply in the same window — usually
          within a few hours during CET business time.
        </p>
      </header>

      <div className="support-intake-shell">
        <div className="od-tile">
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
                  <option value="OpenESC">OpenESC (Electronic Speed Controller)</option>
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
                What&rsquo;s happening <span className="od-req" aria-label="required">*</span>
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
                <span className="od-opt">— images, logs, video up to 24 MB</span>
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
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
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
        <p className="od-help" style={{marginTop: 12, textAlign: 'center'}}>
          One open ticket at a time — keeps things tidy on both sides.
        </p>
        <p className="od-help" style={{marginTop: 8, textAlign: 'center'}}>
          Prefer Discord?{' '}
          <a href={discordInvite} target="_blank" rel="noreferrer noopener">
            Open the server →
          </a>
        </p>
        <p className="od-help" style={{marginTop: 8, textAlign: 'center'}}>
          Signed in as <strong>{prefill.email}</strong>.
        </p>
      </div>
    </article>
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
      {isImage && thumb ? <img className="od-thumb" src={thumb} alt="" /> : null}
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

