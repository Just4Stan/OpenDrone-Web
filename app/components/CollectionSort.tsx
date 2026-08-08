import {useNavigation, useSearchParams} from 'react-router';
import type {ProductCollectionSortKeys} from '@shopify/hydrogen/storefront-api-types';
import {copyText, editAttrs} from '~/lib/copy';

export type SortKey = ProductCollectionSortKeys;

export type SortOption = {
  value: string;
  /** Copy id for the option's visible label; `label` is the fallback. */
  copyId: string;
  label: string;
  sortKey: SortKey;
  reverse?: boolean;
};

// Only /collections/:handle renders this control, so its words live in that
// page's copy file rather than in a component-scoped one.
export const SORT_OPTIONS: SortOption[] = [
  {value: 'featured', copyId: 'collections-handle.sort_featured', label: 'Featured', sortKey: 'MANUAL'},
  {value: 'price-asc', copyId: 'collections-handle.sort_price_asc', label: 'Price: low to high', sortKey: 'PRICE'},
  {value: 'price-desc', copyId: 'collections-handle.sort_price_desc', label: 'Price: high to low', sortKey: 'PRICE', reverse: true},
  {value: 'newest', copyId: 'collections-handle.sort_newest', label: 'Newest', sortKey: 'CREATED', reverse: true},
  {value: 'bestselling', copyId: 'collections-handle.sort_bestselling', label: 'Best selling', sortKey: 'BEST_SELLING'},
  {value: 'title', copyId: 'collections-handle.sort_title', label: 'Alphabetical', sortKey: 'TITLE'},
];

export function resolveSort(value: string | null): SortOption {
  return SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];
}

export function CollectionSort() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const active = searchParams.get('sort') ?? 'featured';
  // Dim + disable while the re-sorted collection is loading so the click
  // visibly registers instead of looking inert.
  const busy = navigation.state !== 'idle';
  return (
    <label className="collection-sort" data-pending={busy || undefined}>
      <span
        className="collection-sort-label"
        {...editAttrs('collections-handle.sort_label')}
      >
        {copyText('collections-handle.sort_label') ?? 'Sort'}
      </span>
      <select
        value={active}
        aria-busy={busy || undefined}
        disabled={busy}
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
          // A <select> may only contain text in its options, so these read the
          // string directly instead of rendering <Txt>'s element.
          <option key={o.value} value={o.value} {...editAttrs(o.copyId)}>
            {copyText(o.copyId) ?? o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
