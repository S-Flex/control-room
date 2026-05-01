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
 *  Navigation is data-driven: `total` is the caller's dataset count, the
 *  active `index` is pure state advanced by `scroll(dir)`, and the counter
 *  is `index + 1 / total`. The grid is scrolled via `scrollIntoView` on
 *  the target column element — no width / gap measurements are involved
 *  in the page math, so floating-point quirks can't push the counter past
 *  the dataset (no more "6/5").
 *
 *  Manual scrolling (touchpad / swipe / wheel) is synced via
 *  `IntersectionObserver`: whichever column is most visible becomes the
 *  active index. `handleScroll` is kept as a no-op for callers that still
 *  wire it up via `onScroll` — the IntersectionObserver does the work. */
export function useColumnGridPager(total: number, minWidthPx = 250) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const update = (width: number) => {
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

  const scroll = useCallback((dir: 1 | -1) => {
    setIndex(prev => {
      const next = Math.max(0, Math.min(total - 1, prev + dir));
      if (next === prev) return prev;
      const el = gridRef.current;
      const target = el?.children[next] as HTMLElement | undefined;
      target?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      return next;
    });
  }, [total]);

  // No-op kept for backwards compat with callers that still pass it as
  // `onScroll`. Index sync happens via the IntersectionObserver below.
  const handleScroll = useCallback(() => {}, []);

  // Reset to the first dataset whenever the dataset shape changes.
  useEffect(() => {
    setIndex(0);
  }, [total, isNarrow]);

  // Sync `index` when the user scrolls manually: whichever column has the
  // largest visible area inside the grid wins.
  useEffect(() => {
    if (!isNarrow || total <= 1) return;
    const el = gridRef.current;
    if (!el) return;
    const cols = Array.from(el.children) as HTMLElement[];
    if (cols.length === 0) return;
    const io = new IntersectionObserver(
      entries => {
        let bestIdx = -1;
        let bestRatio = 0;
        for (const entry of entries) {
          if (entry.intersectionRatio > bestRatio) {
            const idx = cols.indexOf(entry.target as HTMLElement);
            if (idx !== -1) {
              bestRatio = entry.intersectionRatio;
              bestIdx = idx;
            }
          }
        }
        if (bestIdx !== -1) {
          setIndex(prev => (prev !== bestIdx ? bestIdx : prev));
        }
      },
      { root: el, threshold: [0.25, 0.5, 0.75, 1] },
    );
    for (const c of cols) io.observe(c);
    return () => io.disconnect();
  }, [isNarrow, total]);

  const pager: ColumnGridPager | undefined = isNarrow && total > 1
    ? { index, total, atStart: index <= 0, atEnd: index >= total - 1, scroll }
    : undefined;

  return { gridRef, pager, handleScroll, isNarrow };
}

/** Pager state for a horizontally scrollable row that pages one child-width
 *  at a time. Unlike `useColumnGridPager`, it always returns a pager — the
 *  caller decides when to render the controls (e.g. only when the parent's
 *  column-grid pager is also visible). Same target-ref / animating-ref
 *  guard as `useColumnGridPager.scroll` so rapid clicks during a smooth
 *  animation don't read mid-flight `scrollLeft` and stall. */
export function useScrollRowPager() {
  const rowRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(1);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const targetIdxRef = useRef(0);
  const animatingRef = useRef(false);

  const pageWidth = useCallback(() => {
    const el = rowRef.current;
    if (!el) return 0;
    const child = el.firstElementChild as HTMLElement | null;
    return (child?.offsetWidth ?? el.clientWidth) || 1;
  }, []);

  const refresh = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    const step = pageWidth();
    const maxScroll = el.scrollWidth - el.clientWidth;
    const maxIdx = step > 0 ? Math.max(0, Math.ceil(maxScroll / step)) : 0;
    const nextTotal = maxIdx + 1;
    const nextIndex = step > 0 ? Math.max(0, Math.min(maxIdx, Math.round(el.scrollLeft / step))) : 0;
    const nextAtStart = el.scrollLeft <= 1;
    const nextAtEnd = maxScroll <= 0 || el.scrollLeft >= maxScroll - 1;
    const nextOverflowing = maxScroll > 1;
    setTotal(prev => (prev !== nextTotal ? nextTotal : prev));
    setIndex(prev => (prev !== nextIndex ? nextIndex : prev));
    setAtStart(prev => (prev !== nextAtStart ? nextAtStart : prev));
    setAtEnd(prev => (prev !== nextAtEnd ? nextAtEnd : prev));
    setOverflowing(prev => (prev !== nextOverflowing ? nextOverflowing : prev));
  }, [pageWidth]);

  const scroll = useCallback((dir: 1 | -1) => {
    const el = rowRef.current;
    if (!el) return;
    const step = pageWidth();
    if (step <= 0) return;
    const maxIdx = Math.max(0, Math.ceil((el.scrollWidth - el.clientWidth) / step));
    const nextIdx = Math.max(0, Math.min(maxIdx, targetIdxRef.current + dir));
    if (nextIdx === targetIdxRef.current) return;
    targetIdxRef.current = nextIdx;
    animatingRef.current = true;
    el.scrollTo({ left: nextIdx * step, behavior: 'smooth' });
  }, [pageWidth]);

  const handleScroll = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    const step = pageWidth();
    if (step <= 0) return;
    if (animatingRef.current) {
      if (Math.abs(el.scrollLeft - targetIdxRef.current * step) < 2) {
        animatingRef.current = false;
      }
    } else {
      targetIdxRef.current = Math.max(0, Math.round(el.scrollLeft / step));
    }
    refresh();
  }, [pageWidth, refresh]);

  // Watch the row for size changes — children like recharts gauges paint
  // asynchronously, so `scrollWidth` after the first commit often reads
  // smaller than the eventual settled layout. Without this, `atEnd` seeds
  // to `true` and the next button stays disabled.
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    targetIdxRef.current = 0;
    animatingRef.current = false;
    refresh();
    const ro = new ResizeObserver(refresh);
    ro.observe(el);
    for (const child of Array.from(el.children) as HTMLElement[]) ro.observe(child);
    return () => ro.disconnect();
  }, [refresh]);

  const pager: ColumnGridPager = { index, total, atStart, atEnd, scroll };
  return { rowRef, pager, handleScroll, overflowing };
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
