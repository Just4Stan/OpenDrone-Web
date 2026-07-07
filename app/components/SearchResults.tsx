import {Link} from 'react-router';
import {Image, Money, Pagination} from '@shopify/hydrogen';
import {urlWithTrackingParams, type RegularSearchReturn} from '~/lib/search';
import {useComingSoon} from '~/lib/coming-soon';
import {isComingSoon, PRODUCT_CONTENT} from '~/lib/product-content';

/** Document number for a search register row — "OD-02" from PRODUCT_CONTENT's
 *  fileNumber, or "—" when the product has no editorial file. Registry fact,
 *  never authored prose. */
function searchDocNo(handle: string): string {
  const n = PRODUCT_CONTENT[handle]?.fileNumber;
  return n && n !== '—' ? `OD-${n}` : '—';
}

/** Family label for a search register row — a PRODUCT_CONTENT fact. */
function searchFamily(handle: string): string | null {
  return PRODUCT_CONTENT[handle]?.family ?? null;
}

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
SearchResults.Products = SearchResultsProducts;
SearchResults.Empty = SearchResultsEmpty;

function SearchResultsArticles({
  term,
  articles,
}: PartialSearchResult<'articles'>) {
  if (!articles?.nodes.length) {
    return null;
  }

  return (
    <section className="search-section">
      <div className="on-rule">
        <h2 className="on-rule-label doc-label">Articles</h2>
      </div>
      <div className="search-results-list">
        {articles?.nodes?.map((article) => {
          const articleUrl = urlWithTrackingParams({
            baseUrl: `/blogs/${article.blog.handle}/${article.handle}`,
            trackingParams: article.trackingParameters,
            term,
          });

          return (
            <div
              className="search-row edge-light edge-light-wash"
              key={article.id}
            >
              <Link className="search-row-link" prefetch="viewport" to={articleUrl}>
                <span className="search-row-thumb hatch" aria-hidden="true" />
                <span className="search-row-title">{article.title}</span>
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
      <div className="on-rule">
        <h2 className="on-rule-label doc-label">Pages</h2>
      </div>
      <div className="search-results-list">
        {pages?.nodes?.map((page) => {
          const pageUrl = urlWithTrackingParams({
            baseUrl: `/pages/${page.handle}`,
            trackingParams: page.trackingParameters,
            term,
          });

          return (
            <div
              className="search-row edge-light edge-light-wash"
              key={page.id}
            >
              <Link className="search-row-link" prefetch="viewport" to={pageUrl}>
                <span className="search-row-thumb hatch" aria-hidden="true" />
                <span className="search-row-title">{page.title}</span>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SearchResultsProducts({
  term,
  products,
}: PartialSearchResult<'products'>) {
  // Coming-soon products list but never show a price.
  const globalComingSoon = useComingSoon();
  if (!products?.nodes.length) {
    return null;
  }

  return (
    <section className="search-section">
      <div className="on-rule">
        <h2 className="on-rule-label doc-label">Products</h2>
      </div>
      <Pagination connection={products}>
        {({nodes, isLoading, NextLink, PreviousLink}) => {
          const ItemsMarkup = nodes.map((product) => {
            const productUrl = urlWithTrackingParams({
              baseUrl: `/products/${product.handle}`,
              trackingParams: product.trackingParameters,
              term,
            });

            const soon = isComingSoon(product.handle, globalComingSoon);
            const price = soon
              ? undefined
              : product?.selectedOrFirstAvailableVariant?.price;
            const image = product?.selectedOrFirstAvailableVariant?.image;
            const docNo = searchDocNo(product.handle);
            const family = searchFamily(product.handle);

            return (
              <div
                className="search-row is-product edge-light edge-light-wash"
                key={product.id}
              >
                <Link
                  className="search-row-link"
                  prefetch="viewport"
                  to={productUrl}
                >
                  <span className="search-row-doc doc-annot">{docNo}</span>
                  <span
                    className={`search-row-thumb${image ? ' dot-grid' : ' hatch'}`}
                  >
                    {image && (
                      <Image data={image} alt={product.title} width={64} />
                    )}
                  </span>
                  <span className="search-row-title">{product.title}</span>
                  {family && (
                    <span className="search-row-family doc-annot">{family}</span>
                  )}
                  <span className="search-row-price doc-cell">
                    {price && <Money data={price} />}
                  </span>
                </Link>
              </div>
            );
          });

          return (
            <div>
              <div className="search-pagination">
                <PreviousLink>
                  {isLoading ? 'Loading...' : <span>↑ Load previous</span>}
                </PreviousLink>
              </div>
              <div className="search-results-list">
                {ItemsMarkup}
              </div>
              <div className="search-pagination">
                <NextLink>
                  {isLoading ? 'Loading...' : <span>Load more ↓</span>}
                </NextLink>
              </div>
            </div>
          );
        }}
      </Pagination>
    </section>
  );
}

function SearchResultsEmpty() {
  return (
    <div className="empty-state">
      <p>No results yet. Try a product name, part number, or article keyword.</p>
    </div>
  );
}
