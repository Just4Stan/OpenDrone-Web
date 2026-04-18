import {useSearchParams} from 'react-router';

export function CategoryChips({types}: {types: string[]}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get('type');

  if (types.length === 0) return null;

  const setType = (value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value === null) next.delete('type');
    else next.set('type', value);
    ['cursor', 'direction'].forEach((k) => next.delete(k));
    setSearchParams(next, {preventScrollReset: true});
  };

  return (
    <nav className="category-chips" aria-label="Filter by product type">
      <button
        type="button"
        className={`category-chip${active === null ? ' is-active' : ''}`}
        onClick={() => setType(null)}
      >
        All
      </button>
      {types.map((t) => (
        <button
          key={t}
          type="button"
          className={`category-chip${active === t ? ' is-active' : ''}`}
          onClick={() => setType(t)}
        >
          {t}
        </button>
      ))}
    </nav>
  );
}
