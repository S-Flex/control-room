import { useCallback, useMemo } from 'react';
import { useQueryParams } from '@s-flex/xfw-url';
import { syncQueryParams } from '../lib/urlSync';

/** Default URL query param name carrying the shared row pager index. */
export const PAGE_PARAM = 'page';

/** Read the active page index from the URL, clamped into [0, total - 1].
 *  Used by widgets that share a single dataset row across the footer (e.g.
 *  StatusBar + sitrep) so a single Pager in the footer flips both at once. */
export function usePageIndex(total: number, paramName: string = PAGE_PARAM): number {
  const params = useQueryParams([{ key: paramName, is_query_param: true }]);
  const raw = params.find(p => p.key === paramName)?.val;
  return useMemo(() => {
    if (total <= 0) return 0;
    const n = typeof raw === 'number' ? raw : Number(raw ?? 0);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(total - 1, Math.floor(n)));
  }, [raw, total]);
}

/** Setter for the same URL query param. Page 0 removes the param so the URL
 *  stays clean on the default view. */
export function useSetPageIndex(paramName: string = PAGE_PARAM): (next: number) => void {
  return useCallback((next: number) => {
    syncQueryParams({ [paramName]: next > 0 ? String(next) : null });
  }, [paramName]);
}
