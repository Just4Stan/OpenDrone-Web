import {useCallback, useEffect, useId, useRef, useState} from 'react';

/**
 * Web-support widget. Non-Discord users fill the intake form -> Worker
 * creates a Discord forum thread -> staff reply in the thread -> this
 * widget polls /api/support/poll every few seconds and shows the reply.
 *
 * Stateless on the server side: ticket identity lives in a signed
 * HttpOnly cookie, so closing/reopening the tab picks up the same
 * conversation until the cookie expires.
 */

const POLL_INTERVAL_ACTIVE = 4000; // ms, active ticket
const POLL_INTERVAL_BACKGROUND = 15000; // ms, tab hidden

// Mirror server-side caps (app/lib/support/uploads.ts) — keep these in
// sync. Client-side check is just for nicer UX; server still validates.
const MAX_FILES = 5;
const MAX_PER_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

type PollMessage = {
  id: string;
  author: string;
  isStaff: boolean;
  content: string;
  createdAt: string;
  attachments: Array<{url: string; filename: string}>;
};

type LocalMessage = {
  id: string;
  author: string;
  isStaff: boolean;
  content: string;
  createdAt: string;
  attachments?: Array<{url: string; filename: string}>;
  pending?: boolean;
};

type StatusResponse =
  | {ok: true; active: false}
  | {
      ok: true;
      active: true;
      name: string;
      email: string;
      createdAt: number;
    };

type StartResponse =
  | {ok: true; ticketId: string}
  | {ok: false; message: string; field?: string; code?: string};

type PollResponse =
  | {ok: true; messages: PollMessage[]; closed: boolean}
  | {ok: false; message: string; code?: string};

type SendResponse =
  | {
      ok: true;
      id: string;
      attachments: Array<{url: string; filename: string}>;
    }
  | {ok: false; message: string};

interface SupportWidgetProps {
  turnstileSiteKey?: string | null;
  discordInvite?: string;
  /**
   * When the widget is embedded inside a host card that already provides a
   * heading + lede, skip the widget's own intro block to avoid the double
   * "Open a support ticket" treatment. Defaults to false (standalone use).
   */
  embedded?: boolean;
  /**
   * Pre-fill name + email when the visitor is signed into a Shopify
   * customer account. customerId is forwarded to the server so staff can
   * link the ticket to an order in Discord. Anonymous visitors get null.
   */
  prefill?: {name: string; email: string; customerId: string} | null;
}

export function SupportWidget({
  turnstileSiteKey,
  discordInvite,
  embedded = false,
  prefill = null,
}: SupportWidgetProps) {
  const [phase, setPhase] = useState<'boot' | 'intake' | 'active' | 'closed'>(
    'boot',
  );
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [sendBusy, setSendBusy] = useState(false);
  const [userName, setUserName] = useState('');
  const [draft, setDraft] = useState('');
  const [staffIsTyping] = useState(false); // reserved for future typing indicator
  const [intakeFiles, setIntakeFiles] = useState<File[]>([]);
  const [composerFiles, setComposerFiles] = useState<File[]>([]);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [linkBanner, setLinkBanner] = useState<string | null>(null);

  const logRef = useRef<HTMLDivElement | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const intakeFormId = useId();

  const scrollToBottom = useCallback(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  // Surface a banner when the user just landed via /support/resume.
  // The route signals outcome via ?support=resumed | invalid-link | ticket-gone.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('support');
    if (!flag) return;
    if (flag === 'resumed') {
      setLinkBanner('Welcome back — your previous ticket is restored.');
    } else if (flag === 'invalid-link') {
      setLinkBanner(
        'That resume link is no longer valid. Open a new ticket below.',
      );
    } else if (flag === 'ticket-gone') {
      setLinkBanner(
        'That ticket has been closed and archived. Open a new one if you need more help.',
      );
    }
    // Strip the flag so reloads don't keep re-showing the banner.
    params.delete('support');
    const newSearch = params.toString();
    const newUrl =
      window.location.pathname +
      (newSearch ? `?${newSearch}` : '') +
      window.location.hash;
    window.history.replaceState({}, '', newUrl);
  }, []);

  // Resume check on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/support/status', {
          credentials: 'same-origin',
        });
        const json = (await res.json()) as StatusResponse;
        if (cancelled) return;
        if (json.ok && json.active) {
          setUserName(json.name);
          setPhase('active');
        } else {
          setPhase('intake');
        }
      } catch {
        if (!cancelled) setPhase('intake');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load Turnstile script once we're in the intake phase and a key is set.
  useEffect(() => {
    if (phase !== 'intake' || !turnstileSiteKey) return;
    const siteKey = turnstileSiteKey;
    const SCRIPT_ID = 'cf-turnstile-script';
    function render() {
      const cf = (window as unknown as {turnstile?: Turnstile}).turnstile;
      if (!cf || !turnstileContainerRef.current) return;
      if (turnstileWidgetId.current) return;
      const id = cf.render(turnstileContainerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        size: 'flexible',
      });
      turnstileWidgetId.current = id ?? null;
    }
    if ((window as unknown as {turnstile?: Turnstile}).turnstile) {
      render();
      return;
    }
    if (document.getElementById(SCRIPT_ID)) {
      const check = window.setInterval(() => {
        if ((window as unknown as {turnstile?: Turnstile}).turnstile) {
          window.clearInterval(check);
          render();
        }
      }, 120);
      return () => window.clearInterval(check);
    }
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [phase, turnstileSiteKey]);

  // Polling loop. The first tick after entering the active phase asks for
  // a full re-fetch (`?initial=1`) so a returning/refreshed user sees the
  // existing thread history. Subsequent ticks fall back to cursor-based
  // delta polling.
  useEffect(() => {
    if (phase !== 'active') return;
    let timer: number | undefined;
    let stopped = false;
    let firstTick = true;

    const tick = async () => {
      if (stopped) return;
      try {
        const url = firstTick ? '/api/support/poll?initial=1' : '/api/support/poll';
        firstTick = false;
        const res = await fetch(url, {
          credentials: 'same-origin',
        });
        if (res.status === 401) {
          setPhase('intake');
          return;
        }
        const json = (await res.json()) as PollResponse;
        if (json.ok && json.messages.length) {
          setMessages((prev) => mergeMessages(prev, json.messages));
        }
        if (json.ok && json.closed) {
          setPhase('closed');
          return;
        }
      } catch {
        // swallow — try again next tick
      }
      const interval =
        typeof document !== 'undefined' && document.hidden
          ? POLL_INTERVAL_BACKGROUND
          : POLL_INTERVAL_ACTIVE;
      timer = window.setTimeout(() => void tick(), interval);
    };
    void tick();

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === 'active') scrollToBottom();
  }, [messages, phase, scrollToBottom]);

  async function handleIntake(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (intakeBusy) return;
    setIntakeError(null);
    setIntakeBusy(true);
    const form = event.currentTarget;
    const fd = new FormData(form);
    // Replace whatever the <input type=file> contributed with our curated
    // list (the picker only adds, we let users remove individual chips).
    fd.delete('files');
    intakeFiles.forEach((f) => fd.append('files', f));
    try {
      const res = await fetch('/api/support/start', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      });
      const json = (await res.json()) as StartResponse;
      if (json.ok) {
        const name = prefill?.name || prefill?.email?.split('@')[0] || 'You';
        const message = String(fd.get('message') ?? '').trim();
        setUserName(name);
        setMessages([
          {
            id: `local-${Date.now()}`,
            author: name,
            isStaff: false,
            content: message,
            createdAt: new Date().toISOString(),
            attachments: intakeFiles.map((f) => ({
              url: '',
              filename: f.name,
            })),
          },
        ]);
        setIntakeFiles([]);
        setPhase('active');
      } else {
        // If the session expired between load and submit, bounce to login
        // rather than showing an inline error the user can't act on.
        if ('code' in json && json.code === 'signin-required') {
          const next = encodeURIComponent(window.location.pathname);
          window.location.href = `/account/login?return_to=${next}`;
          return;
        }
        setIntakeError(json.message);
        const cf = (window as unknown as {turnstile?: Turnstile}).turnstile;
        if (cf && turnstileWidgetId.current) cf.reset(turnstileWidgetId.current);
      }
    } catch (err) {
      console.error('[support] start failed', err);
      setIntakeError(
        'Could not reach the server. Check your connection and try again.',
      );
    } finally {
      setIntakeBusy(false);
    }
  }

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    const filesToSend = composerFiles;
    if ((!content && !filesToSend.length) || sendBusy) return;
    const pendingId = `local-${Date.now()}`;
    const optimistic: LocalMessage = {
      id: pendingId,
      author: userName || 'You',
      isStaff: false,
      content,
      createdAt: new Date().toISOString(),
      pending: true,
      attachments: filesToSend.map((f) => ({url: '', filename: f.name})),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    setComposerFiles([]);
    setSendBusy(true);
    try {
      const fd = new FormData();
      if (content) fd.append('content', content);
      filesToSend.forEach((f) => fd.append('files', f));
      const res = await fetch('/api/support/send', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      });
      if (res.status === 401) {
        setPhase('intake');
        return;
      }
      const json = (await res.json()) as SendResponse;
      if (!json.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {...m, pending: false, content: `${m.content}\n\n[failed: ${json.message}]`}
              : m,
          ),
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  ...m,
                  pending: false,
                  attachments: json.attachments.length
                    ? json.attachments
                    : m.attachments,
                }
              : m,
          ),
        );
      }
    } catch (err) {
      console.error('[support] send failed', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {...m, pending: false, content: `${m.content}\n\n[failed: network]`}
            : m,
        ),
      );
    } finally {
      setSendBusy(false);
    }
  }

  async function handleResumeLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resumeBusy) return;
    setResumeError(null);
    setResumeMessage(null);
    setResumeBusy(true);
    const form = event.currentTarget;
    const fd = new FormData(form);
    try {
      const res = await fetch('/api/support/lookup', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      });
      const json = (await res.json()) as
        | {ok: true}
        | {ok: false; message: string};
      if (!json.ok) {
        setResumeError(json.message);
      } else {
        setResumeMessage(
          'Check your inbox — if you have any tickets with us, a list of resume links is on its way.',
        );
        form.reset();
      }
    } catch (err) {
      console.error('[support] resume lookup failed', err);
      setResumeError('Could not reach the server. Try again in a moment.');
    } finally {
      setResumeBusy(false);
    }
  }

  async function handleClose() {
    try {
      await fetch('/api/support/close', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      /* ignore — we reset locally regardless */
    }
    setMessages([]);
    setUserName('');
    setIntakeFiles([]);
    setComposerFiles([]);
    setPhase('intake');
  }

  function appendFiles(
    target: 'intake' | 'composer',
    incoming: FileList | null,
  ): string | null {
    if (!incoming || !incoming.length) return null;
    const current = target === 'intake' ? intakeFiles : composerFiles;
    const setter = target === 'intake' ? setIntakeFiles : setComposerFiles;
    const next = [...current];
    for (const f of Array.from(incoming)) {
      if (next.length >= MAX_FILES) {
        return `Max ${MAX_FILES} files per message.`;
      }
      if (f.size > MAX_PER_FILE_BYTES) {
        return `${f.name}: over the 8 MB limit.`;
      }
      const total = next.reduce((s, x) => s + x.size, 0) + f.size;
      if (total > MAX_TOTAL_BYTES) {
        return 'Total attachment size over 24 MB.';
      }
      // De-dupe by name + size — picking the same file twice is a frequent UX trip.
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      next.push(f);
    }
    setter(next);
    return null;
  }

  function removeFile(target: 'intake' | 'composer', index: number) {
    if (target === 'intake') {
      setIntakeFiles((prev) => prev.filter((_, i) => i !== index));
    } else {
      setComposerFiles((prev) => prev.filter((_, i) => i !== index));
    }
  }

  return (
    <section
      aria-label="Support chat"
      className="support-widget"
      data-phase={phase}
    >
      {phase === 'boot' ? <WidgetBoot /> : null}

      {linkBanner ? (
        <div className="support-banner" role="status">
          <span>{linkBanner}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setLinkBanner(null)}
          >
            ×
          </button>
        </div>
      ) : null}

      {phase === 'intake' && !prefill ? (
        <div className="support-signin" role="status">
          {embedded ? null : (
            <header className="support-intro">
              <p className="support-eyebrow">Direct line</p>
              <h3 className="support-title">Sign in to open a ticket</h3>
            </header>
          )}
          <p className="support-signin-lede">
            Tickets are linked to your OpenDrone customer account so we can
            see your orders and pick up where we left off. Sign in to open a
            new ticket — takes a few seconds, no password needed.
          </p>
          <div className="support-signin-actions">
            <a
              className="support-submit"
              href={`/account/login?return_to=${
                typeof window !== 'undefined'
                  ? encodeURIComponent(window.location.pathname)
                  : '%2Fcontact'
              }`}
            >
              Sign in →
            </a>
            {discordInvite ? (
              <a
                className="support-signin-alt"
                href={discordInvite}
                target="_blank"
                rel="noreferrer noopener"
              >
                Prefer Discord? Join the server
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase === 'intake' && prefill ? (
        <form
          id={intakeFormId}
          className="support-intake"
          onSubmit={(e) => void handleIntake(e)}
          noValidate
        >
          {embedded ? null : (
            <header className="support-intro">
              <p className="support-eyebrow">Direct line</p>
              <h3 className="support-title">Open a support ticket</h3>
              <p className="support-lede">
                No Discord? Start here. Your ticket lands with us in Discord and
                replies come straight back to this chat.{' '}
                {discordInvite ? (
                  <>
                    Prefer Discord?{' '}
                    <a href={discordInvite} target="_blank" rel="noreferrer noopener">
                      Join the server
                    </a>
                    .
                  </>
                ) : null}
              </p>
            </header>
          )}

          <p className="support-prefill-note" role="status">
            Signed in as <strong>{prefill.email}</strong>. Your ticket will
            be linked to your customer account.
          </p>

          <label className="support-field">
            <span className="support-label">Subject</span>
            <input
              name="subject"
              maxLength={100}
              placeholder="What's the flight?"
              disabled={intakeBusy}
            />
          </label>
          <label className="support-field">
            <span className="support-label">Message</span>
            <textarea
              name="message"
              required
              rows={5}
              maxLength={4000}
              placeholder="Firmware version, what you saw, what you expected. Logs welcome."
              disabled={intakeBusy}
            />
          </label>

          <FilePicker
            target="intake"
            files={intakeFiles}
            disabled={intakeBusy}
            onAdd={(list) => {
              const err = appendFiles('intake', list);
              if (err) setIntakeError(err);
              else if (intakeError) setIntakeError(null);
            }}
            onRemove={(i) => removeFile('intake', i)}
          />

          {/* Honeypot */}
          <label className="sr-only" aria-hidden="true">
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>

          {turnstileSiteKey ? (
            <div className="support-turnstile" ref={turnstileContainerRef} />
          ) : null}

          {intakeError ? (
            <p className="support-error" role="alert">
              {intakeError}
            </p>
          ) : null}

          <button type="submit" disabled={intakeBusy} className="support-submit">
            {intakeBusy ? 'Opening ticket…' : 'Open ticket'}
          </button>

          <p className="support-privacy">
            Your message is sent to our team over Discord (US-hosted). We
            store your name, email and conversation to help you; see{' '}
            <a href="/privacy">Privacy</a>.
          </p>
        </form>
      ) : null}

      {phase === 'intake' ? (
        <div className="support-resume">
          {!resumeOpen ? (
            <button
              type="button"
              className="support-resume-toggle"
              onClick={() => setResumeOpen(true)}
            >
              Already opened a ticket? Resume by email →
            </button>
          ) : (
            <form
              className="support-resume-form"
              onSubmit={(e) => void handleResumeLookup(e)}
            >
              <p className="support-resume-lede">
                Enter the email you used. We&rsquo;ll send a list of resume
                links so you can pick up any ticket from any device.
              </p>
              <div className="support-resume-row">
                <label className="sr-only" htmlFor="support-resume-email">
                  Email
                </label>
                <input
                  id="support-resume-email"
                  type="email"
                  name="email"
                  required
                  placeholder="you@domain.com"
                  disabled={resumeBusy}
                />
                <label className="sr-only" aria-hidden="true">
                  Website
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </label>
                <button
                  type="submit"
                  className="support-submit"
                  disabled={resumeBusy}
                >
                  {resumeBusy ? 'Checking…' : 'Send links'}
                </button>
              </div>
              {resumeMessage ? (
                <p className="support-resume-success" role="status">
                  {resumeMessage}
                </p>
              ) : null}
              {resumeError ? (
                <p className="support-error" role="alert">
                  {resumeError}
                </p>
              ) : null}
            </form>
          )}
        </div>
      ) : null}

      {(phase === 'active' || phase === 'closed') ? (
        <div className="support-chat">
          <header className="support-chat-head">
            <div>
              <p className="support-eyebrow">
                {phase === 'closed' ? 'Ticket closed' : 'Live with support'}
              </p>
              <h3 className="support-title">
                {phase === 'closed'
                  ? 'Thanks — we\u2019ll follow up by email if needed'
                  : 'We\u2019ll get back to you here'}
              </h3>
            </div>
            <button
              type="button"
              className="support-close"
              onClick={() => void handleClose()}
              title={phase === 'closed' ? 'Start a new ticket' : 'End session'}
            >
              {phase === 'closed' ? 'New ticket' : 'End'}
            </button>
          </header>

          <div className="support-log" ref={logRef} aria-live="polite">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {staffIsTyping ? (
              <p className="support-typing">Support is typing…</p>
            ) : null}
            {phase === 'active' && messages.length === 1 ? (
              <p className="support-hint">
                Waiting on the first reply. We&rsquo;re a small team — usually
                within a few hours during CET business time.
              </p>
            ) : null}
          </div>

          {phase === 'active' ? (
            <form
              className="support-composer"
              onSubmit={(e) => void handleSend(e)}
            >
              <label className="sr-only" htmlFor={`${intakeFormId}-reply`}>
                Reply
              </label>
              <div className="support-composer-input">
                <textarea
                  id={`${intakeFormId}-reply`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Reply…"
                  rows={2}
                  maxLength={1800}
                  disabled={sendBusy}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                    }
                  }}
                />
                <FilePicker
                  target="composer"
                  files={composerFiles}
                  disabled={sendBusy}
                  compact
                  onAdd={(list) => appendFiles('composer', list)}
                  onRemove={(i) => removeFile('composer', i)}
                />
              </div>
              <button
                type="submit"
                className="support-submit"
                disabled={
                  sendBusy || (!draft.trim() && composerFiles.length === 0)
                }
              >
                {sendBusy ? 'Sending…' : 'Send'}
              </button>
            </form>
          ) : (
            <p className="support-closed-note">
              This ticket is closed. Start a new one if you need more help.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function MessageBubble({message}: {message: LocalMessage}) {
  return (
    <article
      className={[
        'support-msg',
        message.isStaff ? 'support-msg-staff' : 'support-msg-user',
        message.pending ? 'support-msg-pending' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="support-msg-head">
        <span className="support-msg-author">
          {message.isStaff ? `${message.author} · support` : message.author}
        </span>
        <time dateTime={message.createdAt}>
          {formatTime(message.createdAt)}
        </time>
      </header>
      {message.content ? (
        <p className="support-msg-body">{message.content}</p>
      ) : null}
      {message.attachments?.length ? (
        <ul className="support-msg-attachments">
          {message.attachments.map((a, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={`${a.filename}-${i}`}>
              {a.url ? (
                <a href={a.url} target="_blank" rel="noreferrer noopener">
                  {iconForFilename(a.filename)} {a.filename}
                </a>
              ) : (
                <span className="support-msg-attachment-pending">
                  {iconForFilename(a.filename)} {a.filename}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function iconForFilename(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return '🖼';
  if (['pdf'].includes(ext)) return '📄';
  if (['zip', 'tar', 'gz', '7z'].includes(ext)) return '📦';
  if (['log', 'txt', 'md', 'json', 'csv'].includes(ext)) return '📝';
  if (['mp4', 'webm', 'mov'].includes(ext)) return '🎞';
  return '📎';
}

function FilePicker({
  target,
  files,
  disabled,
  onAdd,
  onRemove,
  compact = false,
}: {
  target: 'intake' | 'composer';
  files: File[];
  disabled: boolean;
  onAdd: (list: FileList | null) => void;
  onRemove: (index: number) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div
      className={[
        'support-files',
        compact ? 'support-files-compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        disabled={disabled}
        onChange={(e) => {
          onAdd(e.target.files);
          // Allow re-selecting the same file after a remove.
          if (e.target) e.target.value = '';
        }}
      />
      <button
        type="button"
        className="support-files-btn"
        disabled={disabled || files.length >= MAX_FILES}
        onClick={() => inputRef.current?.click()}
        title={`Attach files (max ${MAX_FILES}, 8 MB each)`}
        aria-label={`Attach files (max ${MAX_FILES}, 8 MB each)`}
        data-target={target}
      >
        {compact ? '📎' : `📎 Attach files`}
      </button>
      {files.length ? (
        <ul className="support-files-list">
          {files.map((f, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={`${f.name}-${i}`} className="support-files-chip">
              <span className="support-files-chip-name" title={f.name}>
                {iconForFilename(f.name)} {f.name}
              </span>
              <span className="support-files-chip-size">
                {formatBytes(f.size)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => onRemove(i)}
                disabled={disabled}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function WidgetBoot() {
  return (
    <div className="support-boot" aria-busy="true">
      <p>Loading support chat…</p>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  } catch {
    return '';
  }
}

function mergeMessages(
  existing: LocalMessage[],
  incoming: PollMessage[],
): LocalMessage[] {
  if (!incoming.length) return existing;
  const seen = new Set(existing.map((m) => m.id));
  const additions: LocalMessage[] = [];
  for (const m of incoming) {
    if (seen.has(m.id)) continue;
    additions.push({
      id: m.id,
      author: m.author,
      isStaff: m.isStaff,
      content: m.content,
      createdAt: m.createdAt,
      attachments: m.attachments,
    });
  }
  if (!additions.length) return existing;
  const merged = [...existing, ...additions];
  merged.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  return merged;
}

// Minimal type for the Cloudflare Turnstile client API we use.
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
