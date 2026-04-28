import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { JSONRecord } from '@s-flex/xfw-data';
import { SearchBox, useSearchState } from '../../controls/SearchBox';
import { rowMatches } from '../searchUtils';
import { FlowSearchProvider, type FlowSearchInfo } from './FlowSearchContext';

/** Wraps a flow-board level (the level whose `search: [...]` is configured)
 *  with a SearchBox + match navigation.
 *
 *  Search is "Enter-to-commit": the user types freely; the active query
 *  (`appliedQuery`) only updates on Enter, button click, or arrow-key nav.
 *  This keeps the match counter from flickering on every keystroke and
 *  matches a Find-bar mental model.
 *
 *  Match identity is `row.track_by`, the numeric id stamped on every row by
 *  DataGroupContent the moment data is fetched. It survives the row clones
 *  performed by `toggleChecked` / `mergeData` (object identity wouldn't).
 */
export function SearchableLevel({ rows, fields, render }: {
  rows: JSONRecord[];
  fields: string[];
  render: (visibleRows: JSONRecord[], pruneEmpty: boolean) => ReactNode;
}) {
  const search = useSearchState();
  const containerRef = useRef<HTMLDivElement>(null);

  const matchedTracks = useMemo(() => {
    if (!search.appliedQuery) return new Set<number>();
    const set = new Set<number>();
    for (const row of rows) {
      const track = row.track_by;
      if (typeof track !== 'number') continue;
      if (rowMatches(row, search.appliedQuery, fields)) set.add(track);
    }
    return set;
  }, [rows, search.appliedQuery, fields]);

  const isFilterActive = search.mode === 'filter' && search.appliedQuery.length > 0;
  const isHighlightActive = search.mode === 'highlight' && search.appliedQuery.length > 0;

  const visibleRows = useMemo(() => {
    if (!isFilterActive) return rows;
    return rows.filter(r => typeof r.track_by === 'number' && matchedTracks.has(r.track_by));
  }, [rows, isFilterActive, matchedTracks]);

  // DOM-ordered list of matched leaf cards (highlight mode only). Recomputed
  // via an effect so prev/next walks the layout the user actually sees.
  const [orderedMatches, setOrderedMatches] = useState<number[]>([]);
  useEffect(() => {
    if (!isHighlightActive) { setOrderedMatches([]); return; }
    const root = containerRef.current;
    if (!root || matchedTracks.size === 0) { setOrderedMatches([]); return; }
    const nodes = root.querySelectorAll<HTMLElement>('[data-search-track]');
    const out: number[] = [];
    nodes.forEach(n => {
      const k = n.getAttribute('data-search-track');
      const t = k != null ? Number(k) : NaN;
      if (Number.isFinite(t)) out.push(t);
    });
    setOrderedMatches(out);
  }, [matchedTracks, visibleRows, isHighlightActive]);

  useEffect(() => {
    if (orderedMatches.length === 0) return;
    const idx = Math.min(search.currentIndex, orderedMatches.length - 1);
    const track = orderedMatches[idx];
    const el = containerRef.current?.querySelector(`[data-search-track="${track}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, [orderedMatches, search.currentIndex]);

  const handlePrev = useCallback(() => {
    if (orderedMatches.length === 0) return;
    search.setCurrentIndex((search.currentIndex - 1 + orderedMatches.length) % orderedMatches.length);
  }, [orderedMatches.length, search]);
  const handleNext = useCallback(() => {
    if (orderedMatches.length === 0) return;
    search.setCurrentIndex((search.currentIndex + 1) % orderedMatches.length);
  }, [orderedMatches.length, search]);
  const handleSubmit = useCallback((direction: 'next' | 'prev') => {
    if (search.commit()) return; // first commit: matchedTracks recompute, currentIndex resets to 0
    if (direction === 'next') handleNext(); else handlePrev();
  }, [search, handleNext, handlePrev]);

  const focusedTrack = orderedMatches.length > 0
    ? orderedMatches[Math.min(search.currentIndex, orderedMatches.length - 1)]
    : null;

  const ctx: FlowSearchInfo = useMemo(() => ({
    matchedTracks,
    focusedTrack,
    highlight: isHighlightActive,
  }), [matchedTracks, focusedTrack, isHighlightActive]);

  return (
    <div className="searchable-level" ref={containerRef}>
      <SearchBox
        query={search.query}
        onQueryChange={search.setQuery}
        mode={search.mode}
        onModeChange={search.setMode}
        matchCount={orderedMatches.length}
        currentIndex={search.currentIndex}
        onPrev={handlePrev}
        onNext={handleNext}
        onSubmit={handleSubmit}
      />
      <FlowSearchProvider value={ctx}>
        {render(visibleRows, isFilterActive)}
      </FlowSearchProvider>
    </div>
  );
}
