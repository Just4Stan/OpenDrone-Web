/**
 * Render the per-recipient newsletter email.
 *
 * One HTML + one text version per subscriber. The unsubscribe URL is
 * personalized — it carries a signed token bound to the customer id +
 * email — so a leaked token can only unsubscribe one address.
 *
 * Structure mirrors the design handoff:
 *   header (small wordmark + RELEASE date)
 *   hero image (optional)
 *   meta line (date · version chip)
 *   h1 title
 *   excerpt + body intro paragraphs (excerpt only — full body lives on
 *     the site so we don't bloat the email)
 *   bullet list of changes (ADD/FIX/REMOVE chips) extracted from the
 *     article tags `change:ADD:<text>` etc., or skipped if absent
 *   CTA button "Read full release notes →"
 *   footer (identity, address+KBO+VAT, provenance, one-click unsub block)
 *
 * HTML is intentionally simple table layout — Outlook-safe, inline CSS,
 * no JS. Light + dark client modes via `@media (prefers-color-scheme)`.
 */

import {escapeHtml as esc} from './escape';

export type RenderInput = {
  article: {
    title: string;
    handle: string;
    excerpt: string | null;
    contentHtml: string | null;
    publishedAt: string | null;
    image: {url: string; altText: string | null} | null;
    /** All article tags — used to derive version + change list. */
    tags: string[];
  };
  blogHandle: string;
  siteOrigin: string; // e.g. https://opendrone.be
  recipient: {
    email: string;
    firstName: string | null;
    /** ISO timestamp of when this recipient subscribed. */
    subscribedAt: string | null;
  };
  unsubscribeUrl: string;
  company: {
    name: string;
    address: string | null;
    kbo: string | null;
    vat: string | null;
  };
};

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
  preheader: string;
};

const MAX_PREHEADER = 100;

const VERSION_PATTERN = /^v[\w.-]+$/i;
const CHANGE_TAG_PATTERN = /^change:(add|fix|remove):(.+)$/i;

type Change = {kind: 'ADD' | 'FIX' | 'REMOVE'; text: string};

export function renderNewsletter(input: RenderInput): RenderedEmail {
  const articleUrl = `${input.siteOrigin}/releases/${input.article.handle}`;
  const browserUrl = articleUrl;
  const preheader = buildPreheader(input.article, MAX_PREHEADER);
  const subject = input.article.title;
  const version = pickVersion(input.article.tags);
  const changes = pickChanges(input.article.tags);
  const date = input.article.publishedAt
    ? formatDate(input.article.publishedAt)
    : '';

  return {
    subject,
    preheader,
    text: renderText({
      ...input,
      articleUrl,
      browserUrl,
      preheader,
      version,
      changes,
      date,
    }),
    html: renderHtml({
      ...input,
      articleUrl,
      browserUrl,
      preheader,
      version,
      changes,
      date,
    }),
  };
}

function pickVersion(tags: string[]): string | null {
  for (const t of tags) if (VERSION_PATTERN.test(t)) return t;
  return null;
}

function pickChanges(tags: string[]): Change[] {
  const out: Change[] = [];
  for (const t of tags) {
    const m = t.match(CHANGE_TAG_PATTERN);
    if (m) {
      const kind = m[1].toUpperCase() as Change['kind'];
      out.push({kind, text: m[2].trim()});
    }
  }
  return out;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function buildPreheader(article: RenderInput['article'], max: number): string {
  if (article.excerpt?.trim()) return article.excerpt.trim().slice(0, max);
  const para = article.contentHtml?.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const text = (para ? para[1] : '').replace(/<[^>]+>/g, '').trim();
  return text.slice(0, max);
}

function firstParagraph(html: string | null): string {
  if (!html) return '';
  const m = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
}

type ExpandedInput = RenderInput & {
  articleUrl: string;
  browserUrl: string;
  preheader: string;
  version: string | null;
  changes: Change[];
  date: string;
};

function renderText(input: ExpandedInput): string {
  const summary =
    input.article.excerpt?.trim() || firstParagraph(input.article.contentHtml);
  const lines: string[] = [
    input.recipient.firstName ? `Hi ${input.recipient.firstName},` : 'Hi,',
    '',
    input.article.title,
    [input.date, input.version].filter(Boolean).join(' · '),
    '',
    summary,
    '',
  ];
  if (input.changes.length) {
    for (const c of input.changes) lines.push(`  ${c.kind}  ${c.text}`);
    lines.push('');
  }
  lines.push(`Read it: ${input.articleUrl}`);
  lines.push('');
  lines.push('— OpenDrone');
  lines.push('');
  lines.push('---');
  lines.push(input.company.name);
  if (input.company.address) lines.push(input.company.address);
  const legal = [
    input.company.kbo ? `KBO ${input.company.kbo}` : null,
    input.company.vat ? `VAT ${input.company.vat}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  if (legal) lines.push(legal);
  lines.push('');
  if (input.recipient.subscribedAt) {
    lines.push(
      `You received this because you subscribed at ${input.siteOrigin.replace(/^https?:\/\//, '')} on ${input.recipient.subscribedAt.slice(0, 10)}.`,
    );
  } else {
    lines.push(
      `You received this because you subscribed at ${input.siteOrigin.replace(/^https?:\/\//, '')}.`,
    );
  }
  lines.push('');
  lines.push(`Unsubscribe in one click: ${input.unsubscribeUrl}`);
  return lines.join('\n');
}

function renderHtml(input: ExpandedInput): string {
  const {
    article,
    articleUrl,
    browserUrl,
    recipient,
    unsubscribeUrl,
    company,
    siteOrigin,
    preheader,
    version,
    changes,
    date,
  } = input;
  const summary =
    article.excerpt?.trim() || firstParagraph(article.contentHtml);
  const versionChip = version
    ? `<span style="display:inline-block;margin-left:8px;padding:2px 7px;border:1px solid #c9a227;border-radius:2px;background:rgba(201,162,39,0.08);color:#8a6d1e;font-size:10px;font-family:ui-monospace,Menlo,Consolas,monospace">${esc(version)}</span>`
    : '';
  const heroImg = article.image?.url
    ? `
        <tr>
          <td style="padding:0;background:#f5f3ec">
            <img src="${esc(article.image.url)}" alt="${esc(article.image.altText ?? '')}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0" />
          </td>
        </tr>`
    : '';
  const changesBlock = changes.length
    ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 22px;border-top:1px solid #e0ddd2">
${changes
  .map(
    (c) => `              <tr>
                <td width="70" style="padding:8px 10px 8px 0;border-bottom:1px solid #e0ddd2;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${kindColor(c.kind)};vertical-align:top">${c.kind}</td>
                <td style="padding:8px 0;border-bottom:1px solid #e0ddd2;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.7;color:#2a2c28;vertical-align:top">${esc(c.text)}</td>
              </tr>`,
  )
  .join('\n')}
            </table>`
    : '';
  const subscribedAt = recipient.subscribedAt
    ? recipient.subscribedAt.slice(0, 10)
    : null;
  const provenance = subscribedAt
    ? `You received this because you subscribed at ${esc(siteOrigin.replace(/^https?:\/\//, ''))} on ${esc(subscribedAt)}.`
    : `You received this because you subscribed at ${esc(siteOrigin.replace(/^https?:\/\//, ''))}.`;
  const legalLine = [
    company.kbo ? `KBO ${esc(company.kbo)}` : null,
    company.vat ? `BTW ${esc(company.vat)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${esc(article.title)}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .od-bg { background: #0a0d0a !important; }
      .od-card { background: #0f110f !important; border-color: #2a2e26 !important; }
      .od-text { color: #e8e6dc !important; }
      .od-muted { color: #8a8c80 !important; }
      .od-rule { border-color: #2a2e26 !important; }
      .od-h1 { color: #f5f3ec !important; }
      .od-hero { background: #141614 !important; border-color: #2a2e26 !important; }
      .od-footer-bg { background: #0a0d0a !important; border-color: #2a2e26 !important; }
      .od-unsub { background: #141614 !important; border-color: #2a2e26 !important; }
      .od-unsub-text { color: #d8d6cc !important; }
      .od-unsub-link { color: #e6b933 !important; }
    }
  </style>
</head>
<body class="od-bg" style="margin:0;padding:0;background:#f0eee9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all">${esc(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="od-bg" style="background:#f0eee9">
    <tr>
      <td align="center" style="padding:24px 12px">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="od-card" style="max-width:600px;background:#ffffff;border:1px solid #e0ddd2;border-radius:4px">
          <!-- Header: wordmark + release date -->
          <tr>
            <td class="od-rule" style="padding:16px 24px;border-bottom:1px solid #e0ddd2">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="od-text" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:700;font-size:14px;letter-spacing:0.02em;color:#111">OPEN<span style="color:#c9a227">·</span>DRONE</td>
                  <td align="right" class="od-muted" style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#888">${esc(date.replace(/-/g, '.'))}</td>
                </tr>
              </table>
            </td>
          </tr>
          ${heroImg}
          <!-- Body -->
          <tr>
            <td style="padding:28px 28px 4px">
              <p class="od-muted" style="margin:0 0 10px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#888">
                ${esc(date)}${versionChip}
              </p>
              <h1 class="od-h1" style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:600;font-size:26px;line-height:1.15;letter-spacing:-0.01em;color:#111">${esc(article.title)}</h1>
              ${
                summary
                  ? `<p class="od-text" style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#2a2c28">${esc(summary)}</p>`
                  : ''
              }
              ${changesBlock}
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:0 28px 28px">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td bgcolor="#c9a227" style="background:#c9a227;border-radius:3px">
                    <a href="${esc(articleUrl)}" style="display:inline-block;padding:14px 22px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#1b1400;text-decoration:none">Read full release notes →</a>
                  </td>
                  <td style="padding-left:14px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px"><a href="${esc(browserUrl)}" class="od-muted" style="color:#777;text-decoration:none">View in browser</a></td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="od-footer-bg" style="padding:20px 28px 24px;border-top:1px solid #e0ddd2;background:#faf9f4;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.7;color:#6a6c64">
              <div class="od-text" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:600;font-size:12px;color:#111;margin-bottom:6px">${esc(company.name)} — ${esc(siteOrigin.replace(/^https?:\/\//, ''))}</div>
              <div>${provenance}</div>
              ${
                company.address || legalLine
                  ? `<div style="margin:8px 0;font-size:10.5px;line-height:1.6">${esc(company.address ?? '')}${company.address && legalLine ? '<br/>' : ''}${legalLine}</div>`
                  : ''
              }
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="od-unsub" style="margin-top:12px;background:#ffffff;border:1px solid #d8d6cc;border-radius:3px">
                <tr>
                  <td style="padding:10px 12px">
                    <span class="od-unsub-text" style="font-size:11px;color:#2a2c28">Don&rsquo;t want these anymore? </span>
                    <a href="${esc(unsubscribeUrl)}" class="od-unsub-link" style="color:#8a6d1e;font-weight:600;text-decoration:underline;font-size:11px">Unsubscribe in one click</a>
                  </td>
                </tr>
              </table>
              <div class="od-muted" style="margin-top:12px;font-size:10px;color:#999">Sent via Resend · token-bound, no login required</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function kindColor(kind: Change['kind']): string {
  if (kind === 'ADD') return '#4d7a3a';
  if (kind === 'FIX') return '#8a6d1e';
  return '#b87333';
}
