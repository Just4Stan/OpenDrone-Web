import {useSearchParams} from 'react-router';

/**
 * Category filter chips for the catalog browse page. Each chip sets `?type=`
 * to a Shopify productType VALUE while showing a friendlier plural LABEL, so
 * the value still matches the product's productType for grouping/filtering.
 */
export function CategoryChips({
  categories,
}: {
  categories: Array<{value: string; label: string}>;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get('type');

  if (categories.length === 0) return null;

  const setType = (value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value === null) next.delete('type');
    else next.set('type', value);
    ['cursor', 'direction'].forEach((k) => next.delete(k));
    setSearchParams(next, {preventScrollReset: true});
  };

  return (
    <nav className="category-chips" aria-label="Filter by category">
      <button
        type="button"
        className={`category-chip${active === null ? ' is-active' : ''}`}
        onClick={() => setType(null)}
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c.value}
          type="button"
          className={`category-chip${active === c.value ? ' is-active' : ''}`}
          onClick={() => setType(c.value)}
        >
          {c.label}
        </button>
      ))}
    </nav>
  );
}
