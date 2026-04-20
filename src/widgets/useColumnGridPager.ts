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

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const update = (width: number) => setIsNarrow(width < 2 * minWidthPx);
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
    const styles = getComputedStyle(el);
    const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
    return col.offsetWidth + gap;
  }, []);

  const scroll = useCallback((dir: 1 | -1) => {
    const el = gridRef.current;
    if (!el) return;
    const step = pageWidth() || el.clientWidth;
    // Snap to the page-aligned target so the last click always lands on the
    // last column even when scrollLeft isn't a clean multiple of step.
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
    const i = Math.max(0, Math.min(total - 1, Math.round(el.scrollLeft / step)));
    setIndex(i);
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= maxScroll - 1);
  }, [pageWidth, total]);

  // Initialise atEnd whenever the column count or width might have changed.
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
