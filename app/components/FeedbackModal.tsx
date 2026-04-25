import {useEffect, useId, useRef, useState} from 'react';

/**
 * End-of-ticket survey modal. Three 1-5 ratings + optional notes.
 * Submit posts to /api/support/feedback then closes the ticket
 * (parent decides whether to call /api/support/close after the
 * feedback succeeds — `onSubmitted` is fired with the chosen scores
 * so analytics can hook in).
 */

type Scores = {speed: number; helpfulness: number; overall: number};

const QUESTIONS: Array<{
  id: keyof Scores;
  q: string;
  hint: string;
}> = [
  {id: 'speed', q: 'Response speed', hint: '1 = slow · 5 = fast'},
  {
    id: 'helpfulness',
    q: 'How helpful was the answer?',
    hint: '1 = not at all · 5 = nailed it',
  },
  {
    id: 'overall',
    q: 'Overall feeling about this ticket',
    hint: '1 = rough · 5 = great',
  },
];

export interface FeedbackModalProps {
  open: boolean;
  /** Called when the user dismisses without submitting (Esc, "End without feedback"). */
  onSkip: () => void;
  /** Called after a successful POST. */
  onSubmitted: (scores: Scores) => void;
}

export function FeedbackModal({open, onSkip, onSubmitted}: FeedbackModalProps) {
  const [scores, setScores] = useState<Scores>({
    speed: 0,
    helpfulness: 0,
    overall: 0,
  });
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const firstBtnRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Trap focus + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    setError(null);
    const prevActive =
      typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      }
      if (e.key === 'Tab' && overlayRef.current) {
        const focusables = overlayRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    // Lock body scroll while modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => firstBtnRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, [open, onSkip]);

  if (!open) return null;

  const ready = scores.speed > 0 && scores.helpfulness > 0 && scores.overall > 0;

  async function handleSubmit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('speed', String(scores.speed));
      fd.append('helpfulness', String(scores.helpfulness));
      fd.append('overall', String(scores.overall));
      if (notes.trim()) fd.append('notes', notes.trim());
      const res = await fetch('/api/support/feedback', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      });
      const json = (await res.json()) as
        | {ok: true}
        | {ok: false; message: string};
      if (!json.ok) {
        setError(json.message);
        return;
      }
      onSubmitted(scores);
    } catch (err) {
      console.error('[feedback] submit failed', err);
      setError('Could not submit feedback. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
    /* Backdrop click + Escape is the standard modal-dismissal pattern.
       Focus trap is established on overlayRef in the effect above. */
    <div
      ref={overlayRef}
      className="feedback-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSkip();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onSkip();
      }}
      tabIndex={-1}
    >
      <div className="feedback-modal">
        <div className="feedback-head">
          <p className="od-eyebrow">→ THANKS FOR USING SUPPORT</p>
          <h2 id={titleId}>How did we do?</h2>
          <p>Three quick taps. Helps us figure out what to fix next.</p>
        </div>

        {QUESTIONS.map(({id, q, hint}, qi) => (
          <div key={id} className="feedback-q">
            <div className="feedback-q-label">
              <span className="od-q">{q}</span>
              <span className="od-scale-hint">{hint}</span>
            </div>
            <div
              className="feedback-rating"
              role="radiogroup"
              aria-label={q}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  ref={qi === 0 && n === 1 ? firstBtnRef : undefined}
                  type="button"
                  className={`feedback-rating-dot ${
                    scores[id] >= n ? 'is-on' : ''
                  }`}
                  role="radio"
                  aria-checked={scores[id] === n}
                  aria-label={`${n} out of 5`}
                  onClick={() =>
                    setScores((prev) => ({...prev, [id]: n}))
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="od-field" style={{marginTop: 14, marginBottom: 0}}>
          <label htmlFor="fb-notes">
            Anything else? <span className="od-opt">— optional</span>
          </label>
          <textarea
            id="fb-notes"
            className="od-textarea"
            rows={3}
            maxLength={1500}
            placeholder="What we got right, what we missed…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
          />
        </div>

        {error ? (
          <p className="support-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="feedback-actions">
          <button
            type="button"
            className="od-btn od-btn-ghost"
            onClick={onSkip}
            disabled={busy}
          >
            End without feedback
          </button>
          <button
            type="button"
            className="od-btn od-btn-primary"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={!ready || busy}
          >
            {busy ? 'Submitting…' : 'Submit & close ticket →'}
          </button>
        </div>
      </div>
    </div>
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions */
  );
}
