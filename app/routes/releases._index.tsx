import {useLoaderData} from 'react-router';
import type {Route} from './+types/releases._index';
import {buildSeoMeta} from '~/lib/seo';
import {NewsletterSignup} from '~/components/NewsletterSignup';
import {ReleaseRow, type ReleaseRowArticle} from '~/components/release-notes/ReleaseRow';
import {
  TagFilter,
  FILTER_TAGS,
  type FilterTag,
} from '~/components/release-notes/TagFilter';

const RELEASES_BLOG_FALLBACK = 'releases';

export const meta: Route.MetaFunction = ({data}) => {
  const base = buildSeoMeta({
    title: 'Release notes',
    description:
      'Hardware releases, firmware drops, and milestone updates from OpenDrone.',
  });
  return [
    ...base,
    // RSS auto-discovery — feed reader detects this in <head>.
    {
      tagName: 'link',
      rel: 'alternate',
      type: 'application/rss+xml',
      title: 'OpenDrone — Release notes',
      href: '/releases.rss',
    },
  ];
};

export async function loader({context, request}: Route.LoaderArgs) {
  const blogHandle =
    context.env.NEWSLETTER_BLOG_HANDLE || RELEASES_BLOG_FALLBACK;

  const url = new URL(request.url);
  const tagParam = url.searchParams.get('tag')?.toLowerCase() ?? null;
  const activeTag: FilterTag | null =
    tagParam && (FILTER_TAGS as readonly string[]).includes(tagParam)
      ? (tagParam as FilterTag)
      : null;

  const {blog} = await context.storefront.query(RELEASES_LIST_QUERY, {
    variables: {blogHandle, first: 100},
  });

  const all: ReleaseRowArticle[] = (blog?.articles?.nodes ?? []).map(
    (n: any) => ({
      id: n.id,
      handle: n.handle,
      title: n.title,
      publishedAt: n.publishedAt,
      excerpt: n.excerpt ?? null,
      tags: (n.tags ?? []).filter(Boolean),
      image: n.image ?? null,
    }),
  );

  // Filter out articles with the no-newsletter tag if Stan ever wants
  // to keep one out of the public archive — same convention as the
  // dispatcher uses to skip auto-send.
  const visible = all.filter((a) => !a.tags.includes('no-archive'));

  const counts: Record<string, number> = {};
  for (const a of visible) {
    for (const t of a.tags) {
      const lower = t.toLowerCase();
      if ((FILTER_TAGS as readonly string[]).includes(lower)) {
        counts[lower] = (counts[lower] ?? 0) + 1;
      }
    }
  }

  const filtered = activeTag
    ? visible.filter((a) =>
        a.tags.some((t) => t.toLowerCase() === activeTag),
      )
    : visible;

  // Group by year, descending. Articles in `filtered` are already in
  // reverse-chronological order via the GraphQL sortKey.
  const grouped = new Map<string, ReleaseRowArticle[]>();
  for (const a of filtered) {
    const year = a.publishedAt.slice(0, 4);
    if (!grouped.has(year)) grouped.set(year, []);
    grouped.get(year)!.push(a);
  }

  return {
    blog: blog ?? null,
    blogHandle,
    activeTag,
    counts,
    total: visible.length,
    groups: Array.from(grouped.entries()),
  };
}

export default function ReleasesIndex() {
  const {blog, activeTag, counts, total, groups} =
    useLoaderData<typeof loader>();

  return (
    <div className="page-shell">
      <header className="rn-archive-head">
        <div>
          <p className="rn-eyebrow">
            <span>Blog · Releases</span>
            <a href="/releases.rss" className="rn-rss" rel="alternate">
              ⌁ RSS · /releases.rss
            </a>
          </p>
          <h1>
            Release <em>notes</em>.
          </h1>
          <p className="rn-sub">
            Product releases, build notes, firmware tuning. Posted only when
            there&apos;s something to ship — no schedule, no marketing.
          </p>
        </div>
        <a className="rn-sub-cta-link" href="#subscribe">
          Subscribe
        </a>
      </header>

      {total > 0 ? (
        <TagFilter active={activeTag} counts={counts} total={total} />
      ) : null}

      {groups.length > 0 ? (
        <div>
          {groups.map(([year, articles]) => (
            <section key={year}>
              <div className="rn-year">
                <span className="rn-year-n">{year}</span>
                <span className="rn-year-rule" aria-hidden />
                <span className="rn-year-count">
                  {articles.length} release{articles.length === 1 ? '' : 's'}
                </span>
              </div>
              <ol className="rn-list">
                {articles.map((a) => (
                  <ReleaseRow key={a.id} article={a} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <div className="rn-empty">
          <div className="rn-empty-icon" aria-hidden>
            ·
          </div>
          <h3>{activeTag ? `Nothing tagged ${activeTag} yet.` : 'No releases yet.'}</h3>
          <p>
            {activeTag
              ? 'Try another tag, or'
              : 'First drop coming soon. Subscribe below to hear about it before it’s public.'}
          </p>
          {activeTag ? (
            <a className="rn-sub-cta-link" href="?">
              Show all
            </a>
          ) : null}
        </div>
      )}

      {/* Anchor target for the page-header subscribe CTA */}
      <div id="subscribe" style={{marginTop: 56}}>
        <NewsletterSignup variant="wide" />
      </div>
    </div>
  );
}

const RELEASES_LIST_QUERY = `#graphql
  query ReleasesList(
    $language: LanguageCode
    $blogHandle: String!
    $first: Int!
  ) @inContext(language: $language) {
    blog(handle: $blogHandle) {
      title
      handle
      articles(
        first: $first
        sortKey: PUBLISHED_AT
        reverse: true
      ) {
        nodes {
          id
          handle
          title
          publishedAt
          excerpt
          tags
          image {
            id
            altText
            url
            width
            height
          }
        }
      }
    }
  }
` as const;
