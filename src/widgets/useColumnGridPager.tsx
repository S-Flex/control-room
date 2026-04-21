import { useCallback, useEffect, useRef, useState } from 'react';

export type ColumnGridPager = {
  index: number;
  total: number;
  atStart: boolean;
  atEnd: boolean;
  scroll: (dir: 1 | -1) => void;
};

/** Pager + responsive narrow-mode detection for the shared `.column-grid`.
 *
 *  - When the parent has room for ≥ 2 columns at `minWidthPx`, the grid stays
 *    in its default auto-fit layout (no pager visible).
 *  - When it doesn't, the grid switches to a single-column scroll-snap mode
 *    and a pager is exposed for prev/next.
 *
 *  Returns `gridRef`, `pager` (only when narrow + multi-column), `handleScroll`,
 *  and an `isNarrow` flag the caller toggles into a class. */
export function useColumnGridPager(total: number, minWidthPx = 250) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [isNarrow, setIsNarrow] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const gapRef = useRef(0);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const recomputeGap = () => {
      const styles = getComputedStyle(el);
      gapRef.current = parseFloat(styles.columnGap || styles.gap || '0') || 0;
    };
    const update = (width: number) => {
      recomputeGap();
      const next = width < 2 * minWidthPx;
      setIsNarrow(prev => (prev === next ? prev : next));
    };
    update(el.clientWidth);
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) update(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [minWidthPx]);

  const pageWidth = useCallback(() => {
    const el = gridRef.current;
    if (!el) return 0;
    const col = el.firstElementChild as HTMLElement | null;
    if (!col) return el.clientWidth;
    return col.offsetWidth + gapRef.current;
  }, []);

  const scroll = useCallback((dir: 1 | -1) => {
    const el = gridRef.current;
    if (!el) return;
    const step = pageWidth() || el.clientWidth;
    const currentIdx = Math.round(el.scrollLeft / (step || 1));
    const maxIdx = Math.max(0, Math.ceil((el.scrollWidth - el.clientWidth) / (step || 1)));
    const nextIdx = Math.max(0, Math.min(maxIdx, currentIdx + dir));
    el.scrollTo({ left: nextIdx * step, behavior: 'smooth' });
  }, [pageWidth]);

  const handleScroll = useCallback(() => {
    const el = gridRef.current;
    if (!el) return;
    const step = pageWidth();
    if (step <= 0) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const nextIndex = Math.max(0, Math.min(total - 1, Math.round(el.scrollLeft / step)));
    const nextAtStart = el.scrollLeft <= 1;
    const nextAtEnd = el.scrollLeft >= maxScroll - 1;
    setIndex(prev => (prev !== nextIndex ? nextIndex : prev));
    setAtStart(prev => (prev !== nextAtStart ? nextAtStart : prev));
    setAtEnd(prev => (prev !== nextAtEnd ? nextAtEnd : prev));
  }, [pageWidth, total]);

  // Re-seed the pager boundary flags whenever column count or narrow-mode flips.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(maxScroll <= 0 || el.scrollLeft >= maxScroll - 1);
  }, [total, isNarrow]);

  const pager: ColumnGridPager | undefined = isNarrow && total > 1
    ? { index, total, atStart, atEnd, scroll }
    : undefined;

  return { gridRef, pager, handleScroll, isNarrow };
}

/** Pager UI (prev / label / next) for use alongside `useColumnGridPager`. */
export function ColumnGridPagerControls({ pager }: { pager: ColumnGridPager }) {
  return (
    <div className="column-grid-pager">
      <button className="column-grid-pager-btn" disabled={pager.atStart} onClick={() => pager.scroll(-1)}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M7.5 3L4 6l3.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="column-grid-pager-label">{pager.index + 1}/{pager.total}</span>
      <button className="column-grid-pager-btn" disabled={pager.atEnd} onClick={() => pager.scroll(1)}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M4.5 3L8 6l-3.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
