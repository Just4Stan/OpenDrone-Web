import {Image} from '@shopify/hydrogen';
import {useEffect, useRef, useState} from 'react';
import type {ComponentProps} from 'react';

/**
 * Hydrogen <Image> with a quiet cover while the file streams in. SSR-safe:
 * the image renders visible by default; only after hydration, if the file
 * hasn't arrived yet, a pulsing cover fades over it and lifts on load. No
 * hydration mismatch, no invisible images without JS.
 */
export function SmoothImage(props: ComponentProps<typeof Image>) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'loaded'>('idle');

  useEffect(() => {
    const img = wrapRef.current?.querySelector('img');
    if (!img) return;
    if (img.complete) return; // already cached — never flash the cover
    setPhase('loading');
    const done = () => setPhase('loaded');
    img.addEventListener('load', done);
    img.addEventListener('error', done);
    return () => {
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`smooth-media${phase === 'loading' ? ' is-loading' : ''}`}
    >
      <Image {...props} />
    </div>
  );
}
