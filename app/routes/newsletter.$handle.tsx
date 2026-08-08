import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/newsletter.$handle';
import {Image} from '@shopify/hydrogen';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {buildSeoMeta} from '~/lib/seo';
import {VersionChip, pickVersionTag} from '~/components/release-notes/VersionChip';
import {PrevNextNav} from '~/components/release-notes/PrevNextNav';
import {FILTER_TAGS, type FilterTag} from '~/components/release-notes/TagFilter';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';

const BLOG_HANDLE_FALLBACK = 'news';

export const meta: Route.MetaFunction = ({data}) =>
  buildSeoMeta({
    title:
      data?.article?.seo?.title ||
      data?.article?.title ||
      copyText('newsletter.post_meta_title_fallback') ||
      'Post',
    description:
      data?.article?.seo?.description || data?.article?.excerpt || undefined,
    image: data?.article?.image?.url,
    type: 'article',
  });

function pickFilterTag(tags: readonly string[]): FilterTag | null {
  for (const t of tags) {
    const lower = t.toLowerCase();
    if ((FILTER_TAGS as readonly string[]).includes(lower)) {
      return lower as FilterTag;
    }
  }
  return null;
}

export async function loader({context, request, params}: Route.LoaderArgs) {
  const blogHandle = context.env.NEWSLETTER_BLOG_HANDLE || BLOG_HANDLE_FALLBACK;
  const articleHandle = params.handle;
  if (!articleHandle) throw new Response('Not found', {status: 404});

  // One round-trip: this article + the surrounding archive for prev/next.
  const {blog} = await context.storefront.query(POST_DETAIL_QUERY, {
    variables: {blogHandle, articleHandle, siblingCount: 100},
    cache: context.storefront.CacheLong(),
  });

  if (!blog?.articleByHandle) {
    throw new Response(null, {status: 404});
  }

  redirectIfHandleIsLocalized(request, {
    handle: articleHandle,
    data: blog.articleByHandle,
  });

  const article = blog.articleByHandle;
  const siblings: Array<{handle: string; title: string; publishedAt: string}> =
    (blog.articles?.nodes ?? []).map((n: any) => ({
      handle: n.handle,
      title: n.title,
      publishedAt: n.publishedAt,
    }));

  const idx = siblings.findIndex((s) => s.handle === article.handle);
  // siblings ordered DESC by publishedAt — newer first, so "next" (more
  // recent) sits at idx-1, "previous" (older) at idx+1.
  const next = idx > 0 ? siblings[idx - 1] : null;
  const previous = idx >= 0 && idx + 1 < siblings.length ? siblings[idx + 1] : null;

  return {article, blogHandle, previous, next};
}

export default function NewsletterPost() {
  const {article, previous, next} = useLoaderData<typeof loader>();
  const {title, image, contentHtml, publishedAt, tags, excerpt} = article;
  const date = (() => {
    try {
      return new Date(publishedAt).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  })();
  const version = pickVersionTag(tags ?? []);
  const tag = pickFilterTag(tags ?? []);

  return (
    <article className="page-shell">
      <div className="rn-post-page">
        <div className="rn-post-crumb">
          <Link prefetch="viewport" to="/newsletter">
            <Txt id="newsletter.post_crumb" />
          </Link>
          <span className="rn-sep">/</span>
          <span>{article.handle}</span>
        </div>

        <div className="rn-post-meta">
          <time dateTime={publishedAt}>{date}</time>
          {version ? (
            <>
              <span className="rn-dot">·</span>
              <VersionChip version={version} />
            </>
          ) : null}
          {tag ? (
            <>
              <span className="rn-dot">·</span>
              <span className={`rn-tag is-${tag}`}>{tag}</span>
            </>
          ) : null}
        </div>

        <h1 className="rn-post-title">{title}</h1>
        {excerpt ? <p className="rn-post-deck">{excerpt}</p> : null}

        {image ? (
          <div className="rn-post-hero">
            <Image
              data={image}
              sizes="(min-width: 768px) 920px, 100vw"
              loading="eager"
              alt={image.altText || title}
            />
          </div>
        ) : null}

        <div
          dangerouslySetInnerHTML={{__html: contentHtml}}
          className="rn-post-body"
        />

        <PrevNextNav previous={previous} next={next} />
      </div>
    </article>
  );
}

const POST_DETAIL_QUERY = `#graphql
  query NewsletterPostDetail(
    $articleHandle: String!
    $blogHandle: String!
    $siblingCount: Int!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(language: $language, country: $country) {
    blog(handle: $blogHandle) {
      handle
      articleByHandle(handle: $articleHandle) {
        handle
        title
        contentHtml
        excerpt
        publishedAt
        tags
        image {
          id
          altText
          url
          width
          height
        }
        seo {
          description
          title
        }
      }
      articles(first: $siblingCount, sortKey: PUBLISHED_AT, reverse: true) {
        nodes {
          handle
          title
          publishedAt
        }
      }
    }
  }
` as const;
