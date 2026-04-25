import type {Route} from './+types/[releases.rss]';

const RELEASES_BLOG_FALLBACK = 'releases';
const FEED_LIMIT = 50;

/**
 * RSS 2.0 feed of release-note articles.
 *
 * Pulled by feed readers and surfaced from /releases via the
 * <link rel="alternate"> auto-discovery tag in the route's meta.
 *
 * Cache-Control: 10 min on the edge — we publish at most a few times
 * per month, so a stale-by-10-min feed is fine and saves a round-trip
 * to the Storefront API on every poller hit.
 */
export async function loader({context, request}: Route.LoaderArgs) {
  const blogHandle =
    context.env.NEWSLETTER_BLOG_HANDLE || RELEASES_BLOG_FALLBACK;
  const origin = new URL(request.url).origin;

  let articles: Array<{
    handle: string;
    title: string;
    publishedAt: string;
    excerpt: string | null;
    contentHtml: string | null;
  }> = [];
  try {
    const {blog} = await context.storefront.query(RELEASES_FEED_QUERY, {
      variables: {blogHandle, first: FEED_LIMIT},
    });
    articles = (blog?.articles?.nodes ?? []).map((n: any) => ({
      handle: n.handle,
      title: n.title,
      publishedAt: n.publishedAt,
      excerpt: n.excerpt ?? null,
      contentHtml: n.contentHtml ?? null,
    }));
  } catch {
    // Empty blog or transient API failure — render an empty but valid feed.
    articles = [];
  }

  const xml = renderFeed({origin, articles});

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    },
  });
}

function renderFeed({
  origin,
  articles,
}: {
  origin: string;
  articles: Array<{
    handle: string;
    title: string;
    publishedAt: string;
    excerpt: string | null;
    contentHtml: string | null;
  }>;
}): string {
  const lastBuild = articles[0]?.publishedAt
    ? new Date(articles[0].publishedAt).toUTCString()
    : new Date().toUTCString();
  const items = articles
    .map((a) => {
      const link = `${origin}/releases/${a.handle}`;
      const pubDate = new Date(a.publishedAt).toUTCString();
      const description = a.excerpt
        ? esc(a.excerpt)
        : a.contentHtml
          ? esc(stripHtml(a.contentHtml).slice(0, 320))
          : '';
      return `    <item>
      <title>${esc(a.title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>OpenDrone — Release notes</title>
    <link>${esc(origin)}/releases</link>
    <atom:link href="${esc(origin)}/releases.rss" rel="self" type="application/rss+xml" />
    <description>Hardware releases, firmware drops, and milestone updates from OpenDrone.</description>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const RELEASES_FEED_QUERY = `#graphql
  query ReleasesFeed($blogHandle: String!, $first: Int!) {
    blog(handle: $blogHandle) {
      articles(first: $first, sortKey: PUBLISHED_AT, reverse: true) {
        nodes {
          handle
          title
          publishedAt
          excerpt
          contentHtml
        }
      }
    }
  }
` as const;
