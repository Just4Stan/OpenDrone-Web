/**
 * The smallest inline markup that keeps a paragraph editable as ONE string.
 *
 * Most body copy on this site contains a link or an emphasised word. Splitting
 * those paragraphs into three editable fragments so the markup can live in JSX
 * would be the worst of both worlds: the studio would show meaningless
 * half-sentences, and the editor could not rewrite a sentence that happens to contain
 * a link without an agent rebuilding the JSX.
 *
 * So the markup goes in the string:
 *
 *   [production page](/production)     internal link, client-side navigation
 *   [Discord](https://discord.gg/x)    external link, opens in a new tab
 *   [Discord](@discord)                a named target, resolved from code
 *   *is mostly*                        emphasis
 *   **Stocking:**                      strong
 *
 * Deliberately NOT markdown. No headings, lists, images, code or HTML: those
 * are structure, and structure is the chapter model's job, not a string's. A
 * full markdown renderer here would let a copy edit change the page's shape,
 * which is exactly the failure mode a studio has to avoid.
 */
import {DISCORD_INVITE_URL} from './company.ts';

export type RichNode =
  | {t: 'text'; v: string}
  | {t: 'em'; v: string}
  | {t: 'strong'; v: string}
  | {t: 'link'; v: string; href: string; external: boolean};

/**
 * Links that must not be typed out in copy.
 *
 * A URL written into a sentence is a second copy of a fact that already lives
 * in code, and the two drift silently. That is not hypothetical here: the
 * open-source page's Discord link was migrated as a literal and the invite it
 * contained was wrong, so the live site carried a dead link. Writing
 * `[Discord](@discord)` resolves through `company.ts` instead, so there is one
 * invite and changing it changes every page.
 *
 * Deliberately tiny. This is for identity that appears in prose across the
 * site, not a general variable system: the moment copy can interpolate
 * arbitrary values it stops being copy.
 */
const NAMED: Record<string, string> = {
  discord: DISCORD_INVITE_URL,
  github: 'https://github.com/OpenDrone-hw',
};

/**
 * Only http(s), site-relative hrefs, and named targets. Values come from a repo file rather
 * than from a visitor, so this is not an XSS boundary, but `javascript:` in a
 * copy file would still be a live hazard and there is no reason to allow it.
 */
function safeHref(href: string): string | null {
  const h = href.trim();
  if (h.startsWith('@')) return NAMED[h.slice(1)] ?? null;
  if (/^https?:\/\//i.test(h)) return h;
  // `/\evil.com` is NOT an internal path. WHATWG URL treats a backslash as a
  // separator in special schemes, so `/\`, `/\\` and `/\/` all resolve the same
  // way `//` does: new URL('/\\evil.com', 'https://opendrone.be/x') is
  // https://evil.com/. Checking only for a leading `//` classified it internal,
  // which rendered it through <Link> with no rel="noopener noreferrer".
  if (h === '/') return h;
  if (/^\/[^/\\]/.test(h)) return h;
  if (h.startsWith('#')) return h;
  return null;
}

// Bold is matched BEFORE emphasis, or `**x**` would parse as an empty `*` run
// followed by stray asterisks.
const TOKEN = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

/**
 * Above this length the string is treated as plain text.
 *
 * `\[([^\]]+)\]` rescans to end-of-string from every `[`, so a value full of
 * unmatched brackets is quadratic: 60 KB measured at 1.4s, 200 KB at roughly
 * 15s. Copy strings come from the repo so this is self-inflicted, but it burns
 * on EVERY server render inside the Oxygen worker, which has a CPU budget. No
 * real paragraph is anywhere near this.
 */
const MAX_RICH = 20_000;

export function parseRich(input: string): RichNode[] {
  if (input.length > MAX_RICH) return [{t: 'text', v: input}];
  const out: RichNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(input))) {
    if (m.index > last) out.push({t: 'text', v: input.slice(last, m.index)});

    if (m[1] !== undefined) {
      const href = safeHref(m[2]);
      // An unusable href degrades to plain text rather than vanishing, so a
      // typo shows up as visible words instead of a silently missing sentence.
      if (href) {
        out.push({
          t: 'link',
          v: m[1],
          href,
          external: /^https?:\/\//i.test(href),
        });
      } else {
        out.push({t: 'text', v: m[1]});
      }
    } else if (m[3] !== undefined) {
      out.push({t: 'strong', v: m[3]});
    } else if (m[4] !== undefined) {
      out.push({t: 'em', v: m[4]});
    }
    last = m.index + m[0].length;
  }

  if (last < input.length) out.push({t: 'text', v: input.slice(last)});
  return out;
}

/** True when a string carries no markup, so callers can skip the parse. */
export function isPlain(input: string): boolean {
  if (input.length > MAX_RICH) return true;
  TOKEN.lastIndex = 0;
  return !TOKEN.test(input);
}
