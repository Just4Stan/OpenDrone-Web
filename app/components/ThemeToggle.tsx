import {useEffect, useState} from 'react';
import {
  applyTheme,
  getActiveTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from '~/lib/theme';

/**
 * Light/dark switch. Renders the icon for the theme it will switch TO.
 *
 * The button starts in a deterministic state ('dark') so SSR and the first
 * client render agree; a mount effect then syncs it to whatever the inline
 * head script already applied (stored choice or OS preference). Until mount
 * we render aria-hidden, neutral chrome — the page is already themed
 * correctly by the head script, this only catches the toggle's own state up.
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

  function toggle() {
    // Read the live theme from the DOM rather than React state — state can
    // lag the DOM by a render, which would mis-toggle on rapid clicks.
    const next: Theme = getActiveTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  }

  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      className={`theme-toggle${className ? ' ' + className : ''}`}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      suppressHydrationWarning
    >
      {/* Show the moon while in light mode (tap → dark), sun while in dark
          mode (tap → light). aria-hidden until mounted so SSR markup is
          stable; the head script has already themed the page regardless. */}
      {mounted && theme === 'light' ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
    </button>
  );
}
