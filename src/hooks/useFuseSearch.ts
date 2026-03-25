// ============================================================
// Smart Search Hook — بحث ذكي بـ Fuse.js
// ============================================================

import { useMemo } from 'react';
import Fuse, { type IFuseOptions } from 'fuse.js';

/**
 * Generic fuzzy-search hook.
 *
 * @param items     - The full list of items to search through
 * @param keys      - Which fields to search in  (e.g. ['name', 'brand', 'supplier'])
 * @param query     - The search string
 * @param options   - Additional Fuse.js options
 *
 * @returns  Filtered items matching the query, or all items if query is empty
 *
 * @example
 *   const results = useFuseSearch(products, ['name', 'brand', 'barcode'], debouncedSearch);
 */
export function useFuseSearch<T>(
  items: T[],
  keys: string[],
  query: string,
  options?: Partial<IFuseOptions<T>>,
): T[] {
  const fuse = useMemo(() => {
    return new Fuse(items, {
      keys,
      threshold: 0.35,       // typo tolerance — 0 = exact, 1 = anything
      distance: 100,
      includeScore: true,
      minMatchCharLength: 2,
      ...options,
    });
  }, [items, keys, options]);

  return useMemo(() => {
    if (!query || query.trim().length < 2) return items;
    return fuse.search(query).map(r => r.item);
  }, [fuse, query, items]);
}
