import {useCallback, useEffect, useId, useRef, useState} from 'react';
import {useFetcher} from 'react-router';

// Engineering Essentials — dual-purpose: product-release announcements and
// engineering content digest. Posts to app/routes/newsletter.tsx which
// writes the subscriber into Shopify's customer list with marketing consent.
//
// Bot protection: honeypot field + Cloudflare Turnstile. The Turnstile
// widget + script are lazy-loaded only after the visitor focuses the email
// input — the form lives in every page footer, so loading the script
// unconditionally would tax the main site bundle for visitors who never
// intend to subscribe.

type NewsletterActionData = {
  ok: boolean;
  message: string;
  alreadySubscribed?: boolean;
};

interface NewsletterSignupProps {
  variant?: 'compact' | 'wide' | 'footer';
  className?: string;
  /** Cloudflare Turnstile public site key — widget is skipped when null. */
  turnstileSiteKey?: string | null;
}

type TurnstileRenderOpts = {
  sitekey: string;
  theme?: 'dark' | 'light' | 'auto';
  size?: 'normal' | 'compact' | 'flexible' | 'invisible';
  callback?: (token: string) => void;
};

type Turnstile = {
  render: (el: HTMLElement, opts: TurnstileRenderOpts) => string | undefined;
  reset: (id?: string) => void;
};

export function NewsletterSignup({
  variant = 'compact',
  className = '',
  turnstileSiteKey = null,
}: NewsletterSignupProps) {
  const fetcher = useFetcher<NewsletterActionData>();
  const formRef = useRef<HTMLFormElement>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const emailId = useId();
  const consentId = useId();
  const statusId = useId();
  const [clientError, setClientError] = useState<string | null>(null);
  const [interacted, setInteracted] = useState(false);

  const isSubmitting = fetcher.state !== 'idle';
  const result = fetcher.data;
  const serverMessage = result?.message ?? null;
  const isSuccess = result?.ok === true;
  const isError = result?.ok === false;

  useEffect(() => {
    if (isSuccess) {
      formRef.current?.reset();
      setClientError(null);
      const cf = (window as unknown as {turnstile?: Turnstile}).turnstile;
      if (cf && turnstileWidgetId.current) cf.reset(turnstileWidgetId.current);
    }
  }, [isSuccess]);

  // Lazy-load the Turnstile script the first time the visitor actually
  // interacts with the form. Keeps the script off the critical path for
  // the 99% of page views that never submit a newsletter form.
  useEffect(() => {
    if (!interacted || !turnstileSiteKey) return;
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
  }, [interacted, turnstileSiteKey]);

  const markInteracted = useCallback(() => {
    if (!interacted) setInteracted(true);
  }, [interacted]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const email = (
      form.elements.namedItem('email') as HTMLInputElement | null
    )?.value.trim();
    const consent =
      (form.elements.namedItem('consent') as HTMLInputElement | null)
        ?.checked ?? false;

    if (!email) {
      event.preventDefault();
      setClientError('Enter your email address.');
      return;
    }
    if (!consent) {
      event.preventDefault();
      setClientError('Please confirm you want to receive updates.');
      return;
    }
    setClientError(null);
  }

  const isWide = variant === 'wide';
  const isFooter = variant === 'footer';
  const message = clientError ?? serverMessage;
  const messageTone = clientError
    ? 'error'
    : isSuccess
      ? 'success'
      : isError
        ? 'error'
        : null;

  return (
    <section
      aria-labelledby={`${emailId}-heading`}
      className={[
        'newsletter-signup',
        isWide
          ? 'border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 md:p-10 rounded-sm'
          : '',
        isFooter
          ? 'grid grid-cols-1 md:grid-cols-[1fr_minmax(0,28rem)] gap-6 md:gap-10 md:items-start'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-gold)] mb-2">
          Engineering Essentials
        </p>
        <h3
          id={`${emailId}-heading`}
          className={
            isWide
              ? 'font-display text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text)] mb-2'
              : 'font-display text-sm font-bold tracking-[0.04em] uppercase text-[var(--color-text)] mb-2'
          }
        >
          Product releases. Build notes.
        </h3>
        <p
          className={
            isWide
              ? 'text-sm text-[var(--color-text-muted)] mb-6 max-w-prose leading-relaxed'
              : 'text-[11px] text-[var(--color-text-muted)] mb-3 leading-relaxed'
          }
        >
          Only when there&rsquo;s something to ship. No marketing fluff.
          Unsubscribe anytime.
        </p>
      </div>

      <fetcher.Form
        ref={formRef}
        method="post"
        action="/newsletter"
        onSubmit={handleSubmit}
        className={
          isWide
            ? 'flex flex-col gap-3 md:max-w-xl'
            : 'flex flex-col gap-2'
        }
        noValidate
      >
        {/* Honeypot — hidden from humans, visible to bots */}
        <label className="sr-only" aria-hidden="true">
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>

        <div
          className={
            isWide || isFooter
              ? 'flex flex-col sm:flex-row gap-2'
              : 'flex flex-col gap-2'
          }
        >
          <label htmlFor={emailId} className="sr-only">
            Email address
          </label>
          <input
            id={emailId}
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@domain.com"
            disabled={isSubmitting}
            onFocus={markInteracted}
            onChange={markInteracted}
            aria-describedby={message ? statusId : undefined}
            aria-invalid={messageTone === 'error' || undefined}
            className={[
              'flex-1 bg-[var(--color-bg)] border border-[var(--color-border)]',
              'text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
              'font-mono text-sm px-3 py-2.5 rounded-sm',
              'focus:outline-none focus:border-[var(--color-gold)]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            ].join(' ')}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className={[
              'font-mono text-xs uppercase tracking-[0.14em] font-bold',
              'bg-[var(--color-gold)] text-[var(--color-bg)]',
              'px-5 py-2.5 rounded-sm',
              'transition-colors hover:bg-[var(--color-gold-hover)]',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              isWide || isFooter ? 'sm:shrink-0' : '',
            ].join(' ')}
          >
            {isSubmitting ? 'Subscribing…' : 'Subscribe'}
          </button>
        </div>

        <label
          htmlFor={consentId}
          className="flex items-start gap-2 text-[11px] text-[var(--color-text-muted)] leading-snug cursor-pointer select-none"
        >
          <input
            id={consentId}
            type="checkbox"
            name="consent"
            required
            disabled={isSubmitting}
            onChange={markInteracted}
            className="mt-0.5 accent-[var(--color-gold)] cursor-pointer"
          />
          <span>
            I agree to receive updates from OpenDrone.{' '}
            <a
              href="/privacy"
              className="underline underline-offset-2 hover:text-[var(--color-text)]"
            >
              Privacy
            </a>
            .
          </span>
        </label>

        {turnstileSiteKey && interacted ? (
          <div
            ref={turnstileContainerRef}
            className="mt-1"
            data-testid="newsletter-turnstile"
          />
        ) : null}

        {message ? (
          <p
            id={statusId}
            role={messageTone === 'error' ? 'alert' : 'status'}
            className={[
              'font-mono text-[11px] mt-1',
              messageTone === 'success'
                ? 'text-[var(--color-accent-light)]'
                : messageTone === 'error'
                  ? 'text-red-400'
                  : 'text-[var(--color-text-muted)]',
            ].join(' ')}
          >
            {message}
          </p>
        ) : null}
      </fetcher.Form>
    </section>
  );
}
