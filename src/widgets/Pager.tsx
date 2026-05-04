import { useDataGroups } from '@s-flex/xfw-ui';
import { useDataGeneric } from '../hooks/useDataGeneric';
import { usePageIndex, useSetPageIndex, PAGE_PARAM } from './usePageIndex';

/** Footer pager — counts rows from a sibling data_group and writes the
 *  active index to the shared `?page=N` URL param. Any widget on the page
 *  that calls `usePageIndex` (StatusBar, sitrep) flips in lockstep.
 *
 *  No separate backend config required: just point it at an existing
 *  data_group code (e.g. `status_bar`) via the `pager` field on a footer
 *  section. */
export function Pager({ dataGroupCode, pageParam = PAGE_PARAM }: {
  dataGroupCode: string;
  pageParam?: string;
}) {
  const { data: dataGroups } = useDataGroups(dataGroupCode);
  const dataGroup = dataGroups?.[0];
  const { dataRows } = useDataGeneric(dataGroup);

  const total = dataRows?.length ?? 0;
  const index = usePageIndex(total, pageParam);
  const setIndex = useSetPageIndex(pageParam);

  if (total <= 1) return null;

  const atStart = index <= 0;
  const atEnd = index >= total - 1;

  return (
    <div className="column-grid-pager pager-widget">
      <button
        className="column-grid-pager-btn"
        disabled={atStart}
        onClick={() => setIndex(index - 1)}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M7.5 3L4 6l3.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="column-grid-pager-label">{index + 1}/{total}</span>
      <button
        className="column-grid-pager-btn"
        disabled={atEnd}
        onClick={() => setIndex(index + 1)}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M4.5 3L8 6l-3.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
