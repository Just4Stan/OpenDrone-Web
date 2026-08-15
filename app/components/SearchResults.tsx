/**
 * Pages and articles matching the catalog page's search term. Only the
 * section headings are copy (`content/copy/collections-all.json`); result
 * titles are Shopify data. Products are not listed here: the term filters
 * the catalog grid itself.
 */
import {Link} from 'react-router';
import {urlWithTrackingParams, type RegularSearchReturn} from '~/lib/search';
import {Txt} from '~/components/Txt';

type SearchItems = RegularSearchReturn['result']['items'];
type PartialSearchResult<ItemType extends keyof SearchItems> = Pick<
  SearchItems,
  ItemType
> &
  Pick<RegularSearchReturn, 'term'>;

type SearchResultsProps = RegularSearchReturn & {
  children: (args: SearchItems & {term: string}) => React.ReactNode;
};

export function SearchResults({
  term,
  result,
  children,
}: Omit<SearchResultsProps, 'error' | 'type'>) {
  if (!result?.total) {
    return null;
  }

  return children({...result.items, term});
}

SearchResults.Articles = SearchResultsArticles;
SearchResults.Pages = SearchResultsPages;

function SearchResultsArticles({
  term,
  articles,
}: PartialSearchResult<'articles'>) {
  if (!articles?.nodes.length) {
    return null;
  }

  return (
    <section className="search-section">
      <Txt id="collections-all.section_articles" as="h2" />
      <div className="search-results-list">
        {articles?.nodes?.map((article) => {
          const articleUrl = urlWithTrackingParams({
            baseUrl: `/blogs/${article.blog.handle}/${article.handle}`,
            trackingParams: article.trackingParameters,
            term,
          });

          return (
            <div className="search-results-item" key={article.id}>
              <Link prefetch="viewport" to={articleUrl}>
                {article.title}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SearchResultsPages({term, pages}: PartialSearchResult<'pages'>) {
  if (!pages?.nodes.length) {
    return null;
  }

  return (
    <section className="search-section">
      <Txt id="collections-all.section_pages" as="h2" />
      <div className="search-results-list">
        {pages?.nodes?.map((page) => {
          const pageUrl = urlWithTrackingParams({
            baseUrl: `/pages/${page.handle}`,
            trackingParams: page.trackingParameters,
            term,
          });

          return (
            <div className="search-results-item" key={page.id}>
              <Link prefetch="viewport" to={pageUrl}>
                {page.title}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
