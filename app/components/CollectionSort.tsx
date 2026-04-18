import {useSearchParams} from 'react-router';
import type {ProductCollectionSortKeys} from '@shopify/hydrogen/storefront-api-types';

export type SortKey = ProductCollectionSortKeys;

export type SortOption = {
  value: string;
  label: string;
  sortKey: SortKey;
  reverse?: boolean;
};

export const SORT_OPTIONS: SortOption[] = [
  {value: 'featured', label: 'Featured', sortKey: 'MANUAL'},
  {value: 'price-asc', label: 'Price — low to high', sortKey: 'PRICE'},
  {value: 'price-desc', label: 'Price — high to low', sortKey: 'PRICE', reverse: true},
  {value: 'newest', label: 'Newest', sortKey: 'CREATED', reverse: true},
  {value: 'bestselling', label: 'Best selling', sortKey: 'BEST_SELLING'},
  {value: 'title', label: 'Alphabetical', sortKey: 'TITLE'},
];

export function resolveSort(value: string | null): SortOption {
  return SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];
}

export function CollectionSort() {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get('sort') ?? 'featured';
  return (
    <label className="collection-sort">
      <span className="collection-sort-label">Sort</span>
      <select
        value={active}
        onChange={(e) => {
          const next = new URLSearchParams(searchParams);
          const v = e.target.value;
          if (v === 'featured') next.delete('sort');
          else next.set('sort', v);
          ['cursor', 'direction'].forEach((k) => next.delete(k));
          setSearchParams(next, {preventScrollReset: true});
        }}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
