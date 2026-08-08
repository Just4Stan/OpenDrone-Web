/**
 * The smallest inline markup that keeps a paragraph editable as ONE string.
 *
 * Most body copy on this site contains a link or an emphasised word. Splitting
 * those paragraphs into three editable fragments so the markup can live in JSX
 * would be the worst of both worlds: the studio would show meaningless
 * half-sentences, and Stan could not rewrite a sentence that happens to contain
 * a link without an agent rebuilding the JSX.
 *
 * So the markup goes in the string:
 *
 *   [production page](/production)     internal link, client-side navigation
 *   [Discord](https://discord.gg/x)    external link, opens in a new tab
 *   *is mostly*                        emphasis
 *   **Stocking:**                      strong
 *
 * Deliberately NOT markdown. No headings, lists, images, code or HTML: those
 * are structure, and structure is the chapter model's job, not a string's. A
 * full markdown renderer here would let a copy edit change the page's shape,
 * which is exactly the failure mode a studio has to avoid.
 */
export type RichNode =
  | {t: 'text'; v: string}
  | {t: 'em'; v: string}
  | {t: 'strong'; v: string}
  | {t: 'link'; v: string; href: string; external: boolean};

/**
 * Only http(s) and site-relative hrefs. Values come from a repo file rather
 * than from a visitor, so this is not an XSS boundary, but `javascript:` in a
 * copy file would still be a live hazard and there is no reason to allow it.
 */
function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^https?:\/\//i.test(h)) return h;
  if (h.startsWith('/') && !h.startsWith('//')) return h;
  if (h.startsWith('#')) return h;
  return null;
}

// Bold is matched BEFORE emphasis, or `**x**` would parse as an empty `*` run
// followed by stray asterisks.
const TOKEN = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

export function parseRich(input: string): RichNode[] {
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
  TOKEN.lastIndex = 0;
  return !TOKEN.test(input);
}
