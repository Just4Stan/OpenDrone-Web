import {Link, useSearchParams} from 'react-router';

/**
 * Single-select filter row. Filter state lives in the URL (`?tag=...`)
 * so deep links work, the back button works, and SSR can render the
 * pre-filtered list without a flash. "All" clears the param.
 *
 * The set of tags is fixed; counts are passed in so the loader can
 * surface "Hardware (3)" without us having to re-aggregate client-side.
 */

export const FILTER_TAGS = [
  'hardware',
  'firmware',
  'software',
  'logistics',
  'milestone',
] as const;

export type FilterTag = (typeof FILTER_TAGS)[number];

const LABELS: Record<FilterTag, string> = {
  hardware: 'Hardware',
  firmware: 'Firmware',
  software: 'Software',
  logistics: 'Logistics',
  milestone: 'Milestone',
};

export function TagFilter({
  active,
  counts,
  total,
}: {
  active: FilterTag | null;
  counts: Record<string, number>;
  total: number;
}) {
  const [params] = useSearchParams();
  const buildHref = (tag: FilterTag | null) => {
    const next = new URLSearchParams(params);
    if (tag) next.set('tag', tag);
    else next.delete('tag');
    const qs = next.toString();
    return qs ? `?${qs}` : '';
  };

  return (
    <div className="rn-filters" role="group" aria-label="Filter releases by tag">
      <span className="rn-k">Filter</span>
      <Link
        to={buildHref(null)}
        className={'rn-filter' + (active === null ? ' is-on' : '')}
        prefetch="intent"
      >
        All <span className="rn-n">{total}</span>
      </Link>
      {FILTER_TAGS.map((tag) => (
        <Link
          key={tag}
          to={buildHref(tag)}
          className={'rn-filter' + (active === tag ? ' is-on' : '')}
          prefetch="intent"
        >
          {LABELS[tag]} <span className="rn-n">{counts[tag] ?? 0}</span>
        </Link>
      ))}
    </div>
  );
}
