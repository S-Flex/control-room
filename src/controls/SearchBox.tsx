import { useCallback, useState } from 'react';

export type SearchMode = 'highlight' | 'filter';

export type SearchStateValue = {
  /** Live input value bound to the SearchBox `<input>`. */
  query: string;
  /** Committed search term used by the consumer to compute matches. Updated
   *  only when `commit()` runs (Enter / button), so typing doesn't trigger
   *  expensive recomputation, prev/next stays anchored, and the match
   *  counter doesn't flicker on every keystroke. */
  appliedQuery: string;
  /** Update the input. Clearing the input also clears `appliedQuery` so a
   *  zero-state input always means zero-state search. */
  setQuery: (q: string) => void;
  mode: SearchMode;
  setMode: (m: SearchMode) => void;
  currentIndex: number;
  setCurrentIndex: (n: number) => void;
  /** Promote `query` to `appliedQuery`, resetting `currentIndex` to 0. Returns
   *  `true` when a new query was committed, `false` when nothing changed (so
   *  the caller can fall through to prev/next navigation). */
  commit: () => boolean;
};

/** Independent search state per searchable section: input value,
 *  applied/committed value, mode, prev/next cursor. */
export function useSearchState(initialMode: SearchMode = 'highlight'): SearchStateValue {
  const [query, setInputQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [currentIndex, setCurrentIndex] = useState(0);

  const setQuery = useCallback((q: string) => {
    setInputQuery(q);
    if (q === '') setAppliedQuery('');
  }, []);

  const commit = useCallback(() => {
    if (query !== appliedQuery) {
      setAppliedQuery(query);
      setCurrentIndex(0);
      return true;
    }
    return false;
  }, [query, appliedQuery]);

  return { query, appliedQuery, setQuery, mode, setMode, currentIndex, setCurrentIndex, commit };
}

export function SearchBox({
  query, onQueryChange,
  mode, onModeChange,
  matchCount, currentIndex,
  onPrev, onNext, onSubmit,
  placeholder,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  mode: SearchMode;
  onModeChange: (m: SearchMode) => void;
  matchCount: number;
  currentIndex: number;
  /** Navigate to the previous committed match. ArrowUp + the prev button. */
  onPrev: () => void;
  /** Navigate to the next committed match. ArrowDown + the next button. */
  onNext: () => void;
  /** Commit the current input as the active search (or, when already
   *  committed, advance to next/prev). Bound to Enter / Shift+Enter so the
   *  user starts a search by typing then pressing Enter. The `direction`
   *  argument lets the caller advance to prev on Shift+Enter once committed. */
  onSubmit: (direction: 'next' | 'prev') => void;
  placeholder?: string;
}) {
  const counterIdx = matchCount > 0 ? Math.min(currentIndex, matchCount - 1) + 1 : 0;
  // In filter mode every match is already on screen — prev/next would have
  // nothing to scroll between, so the controls and counter are hidden.
  const showNav = mode !== 'filter';
  const handleKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onQueryChange('');
      return;
    }
    if (!showNav) return;
    // Enter commits the query (or advances if already committed). Arrow keys
    // are pure navigation — only useful after a query has been committed.
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit(e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onNext();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onPrev();
    }
  }, [onPrev, onNext, onSubmit, onQueryChange, showNav]);

  // While the input has any text, pin the box to the top via CSS sticky so
  // the user can scroll long match lists without losing the search controls.
  // Empty input → normal flow, so the searchbox doesn't permanently steal a
  // row of vertical space when nobody is searching.
  const isActive = query.length > 0;
  return (
    <div className={`searchbox${isActive ? ' is-sticky' : ''}`}>
      <input
        type="search"
        className="searchbox-input"
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder ?? 'Search…'}
      />
      {isActive && (
        <button
          type="button"
          className="searchbox-clear"
          title="Clear search"
          aria-label="Clear search"
          onClick={() => onQueryChange('')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      )}
      <button
        type="button"
        className={`searchbox-toggle${mode === 'highlight' ? ' is-active' : ''}`}
        title="Highlight matches"
        aria-pressed={mode === 'highlight'}
        onClick={() => onModeChange('highlight')}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.4" />
          <path d="M9.2 9.2L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        className={`searchbox-toggle${mode === 'filter' ? ' is-active' : ''}`}
        title="Filter to matches"
        aria-pressed={mode === 'filter'}
        onClick={() => onModeChange('filter')}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 3h10l-3.6 4.5V12L5.6 10.5V7.5L2 3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      </button>
      {showNav && (
        <>
          <button
            type="button"
            className="searchbox-nav"
            title="Previous match"
            disabled={matchCount === 0}
            onClick={onPrev}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M6.5 2L3.5 5L6.5 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="searchbox-counter">{counterIdx}/{matchCount}</span>
          <button
            type="button"
            className="searchbox-nav"
            title="Next match"
            disabled={matchCount === 0}
            onClick={onNext}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M3.5 2L6.5 5L3.5 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
