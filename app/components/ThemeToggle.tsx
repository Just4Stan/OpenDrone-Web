import {useEffect, useState, type MouseEvent as ReactMouseEvent} from 'react';
import {SegmentedControl} from '~/components/SegmentedControl';
import {
  applyTheme,
  getActiveTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from '~/lib/theme';
import {safeStartViewTransition} from '~/lib/view-transition';

const MOON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SUN = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

/**
 * Light/dark switch — a two-position flick switch (SegmentedControl): a moon
 * segment and a sun segment, the sled resting over the active theme. Clicking
 * or keyboarding to the other segment slides the sled with the detent spring
 * and swaps the theme via the circular View-Transition reveal.
 *
 * theme.ts mechanics are untouched: applyTheme persists the choice, the
 * mount effect syncs to whatever the inline head script resolved, and it
 * live-follows the OS preference until the visitor makes an explicit choice.
 *
 * The control starts in a deterministic state ('dark') so SSR and the first
 * client render agree; the mount effect then catches it up to the already-
 * applied theme (the page is themed correctly by the head script regardless).
 */
export function ThemeToggle({className}: {className?: string}) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(getActiveTheme());
    setMounted(true);

    // Follow the OS preference live — but only until the visitor makes an
    // explicit choice via the toggle (which writes localStorage). After that
    // their choice sticks regardless of OS changes.
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (e: MediaQueryListEvent) => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(THEME_STORAGE_KEY);
      } catch {
        // ignore
      }
      if (stored === 'light' || stored === 'dark') return;
      const next: Theme = e.matches ? 'light' : 'dark';
      applyTheme(next);
      setTheme(next);
      // applyTheme persists; an OS-driven change shouldn't count as an
      // explicit choice, so clear the key it just wrote.
      try {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } catch {
        // ignore
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  function change(next: Theme, e?: ReactMouseEvent) {
    // Read the live theme from the DOM rather than React state — state can lag
    // the DOM by a render, which would mis-toggle on rapid clicks.
    if (next === getActiveTheme()) return;
    const apply = () => {
      applyTheme(next);
      setTheme(next);
    };
    // Circular reveal from the click point via the View Transitions API. The
    // new theme wipes in as an expanding circle. Falls back to an instant swap
    // where unsupported, under reduced-motion, or — critically — while another
    // transition (e.g. a React Router navigation) is already in flight.
    // safeStartViewTransition guards all of that, always applies the theme, and
    // never throws/rejects.
    const root = document.documentElement;
    root.style.setProperty('--vt-x', `${e?.clientX ?? window.innerWidth - 40}px`);
    root.style.setProperty('--vt-y', `${e?.clientY ?? 40}px`);
    root.classList.add('theme-vt');
    const vt = safeStartViewTransition(apply);
    if (!vt) {
      root.classList.remove('theme-vt');
      return;
    }
    void Promise.resolve(vt.finished)
      .catch(() => {})
      .finally(() => root.classList.remove('theme-vt'));
  }

  // Before mount, hold the deterministic 'dark' state so SSR/first paint agree.
  const value: Theme = mounted ? theme : 'dark';

  return (
    <SegmentedControl<Theme>
      value={value}
      onChange={change}
      ariaLabel="Theme"
      compact
      className={className}
      segments={[
        {value: 'dark', label: MOON, ariaLabel: 'Switch to dark mode'},
        {value: 'light', label: SUN, ariaLabel: 'Switch to light mode'},
      ]}
    />
  );
}
