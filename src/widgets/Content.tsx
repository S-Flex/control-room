import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSONValue } from '@s-flex/xfw-data';
import { SearchBox, useSearchState } from '../controls/SearchBox';

type ContentItem = {
  title?: string;
  text?: string;
  imgUrl?: string;
};

type ContentRow = {
  action_id?: number;
  content?: ContentItem[];
  start_at?: string;
  [key: string]: JSONValue | ContentItem[] | undefined;
};

function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  for (const el of Array.from(div.querySelectorAll('script'))) el.remove();
  for (const el of Array.from(div.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
    }
    if (el.hasAttribute('href') && el.getAttribute('href')?.trim().toLowerCase().startsWith('javascript:')) {
      el.removeAttribute('href');
    }
    if (el.hasAttribute('src') && el.getAttribute('src')?.trim().toLowerCase().startsWith('javascript:')) {
      el.removeAttribute('src');
    }
  }
  return div.innerHTML;
}

function ContentItemView({ item, searchClass, searchKey }: {
  item: ContentItem;
  searchClass?: string;
  searchKey?: string;
}) {
  return (
    <div
      className={`content-block${searchClass ? ' ' + searchClass : ''}`}
      data-search-key={searchKey}
    >
      {item.title && (
        <div className="content-block-title" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.title) }} />
      )}
      {item.text && (
        <div className="content-block-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.text) }} />
      )}
      {item.imgUrl && (
        <img className="content-block-img" src={item.imgUrl} alt={item.title ?? ''} />
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

type Group = { items: ContentItem[]; date?: string };

/** Normalize data: supports both flat ContentItem[] and row-based { content, start_at }[] */
function normalizeItems(data: JSONValue): Group[] {
  if (!data || !Array.isArray(data) || data.length === 0) return [];
  const first = data[0] as Record<string, unknown>;
  if ('content' in first && Array.isArray(first.content)) {
    return (data as ContentRow[]).map(row => ({
      items: row.content ?? [],
      date: row.start_at,
    }));
  }
  return [{ items: data as ContentItem[] }];
}

function itemMatches(item: ContentItem, q: string, fields: string[]): boolean {
  for (const f of fields) {
    const v = (item as Record<string, unknown>)[f];
    if (typeof v === 'string' && v.toLowerCase().includes(q)) return true;
  }
  return false;
}

export function Content({ data, search }: { data: JSONValue; search?: string[] }) {
  const groups = normalizeItems(data);
  const searchState = useSearchState();
  const containerRef = useRef<HTMLDivElement>(null);
  const fields = search && search.length > 0 ? search : undefined;

  const keyFor = useCallback((gi: number, ii: number) => `g${gi}-i${ii}`, []);

  const matchedKeys = useMemo(() => {
    const set = new Set<string>();
    if (!fields || !searchState.appliedQuery) return set;
    const q = searchState.appliedQuery.toLowerCase();
    groups.forEach((g, gi) => {
      g.items.forEach((item, ii) => {
        if (itemMatches(item, q, fields)) set.add(keyFor(gi, ii));
      });
    });
    return set;
  }, [groups, fields, searchState.appliedQuery, keyFor]);

  const [orderedMatches, setOrderedMatches] = useState<string[]>([]);
  useEffect(() => {
    const root = containerRef.current;
    if (!root || matchedKeys.size === 0) { setOrderedMatches([]); return; }
    const nodes = root.querySelectorAll<HTMLElement>('[data-search-key]');
    const out: string[] = [];
    nodes.forEach(n => {
      const k = n.getAttribute('data-search-key');
      if (k && matchedKeys.has(k)) out.push(k);
    });
    setOrderedMatches(out);
  }, [matchedKeys, searchState.mode]);

  useEffect(() => {
    if (orderedMatches.length === 0) return;
    const idx = Math.min(searchState.currentIndex, orderedMatches.length - 1);
    const k = orderedMatches[idx];
    const el = containerRef.current?.querySelector(`[data-search-key="${cssEscape(k)}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [orderedMatches, searchState.currentIndex]);

  const handlePrev = useCallback(() => {
    if (orderedMatches.length === 0) return;
    searchState.setCurrentIndex((searchState.currentIndex - 1 + orderedMatches.length) % orderedMatches.length);
  }, [orderedMatches.length, searchState]);
  const handleNext = useCallback(() => {
    if (orderedMatches.length === 0) return;
    searchState.setCurrentIndex((searchState.currentIndex + 1) % orderedMatches.length);
  }, [orderedMatches.length, searchState]);
  const handleSubmit = useCallback((direction: 'next' | 'prev') => {
    if (searchState.commit()) return;
    if (direction === 'next') handleNext(); else handlePrev();
  }, [searchState, handleNext, handlePrev]);

  if (groups.length === 0) return null;

  const focusedKey = orderedMatches.length > 0
    ? orderedMatches[Math.min(searchState.currentIndex, orderedMatches.length - 1)]
    : null;

  return (
    <div className="content-widget" ref={containerRef}>
      {fields && (
        <SearchBox
          query={searchState.query}
          onQueryChange={searchState.setQuery}
          mode={searchState.mode}
          onModeChange={searchState.setMode}
          matchCount={orderedMatches.length}
          currentIndex={searchState.currentIndex}
          onPrev={handlePrev}
          onNext={handleNext}
          onSubmit={handleSubmit}
        />
      )}
      <div className="content-list">
        {groups.map((group, gi) => (
          <ContentGroupRenderer
            key={gi}
            gi={gi}
            group={group}
            defaultExpanded={gi === 0}
            fields={fields}
            query={searchState.appliedQuery}
            mode={searchState.mode}
            matchedKeys={matchedKeys}
            focusedKey={focusedKey}
            keyFor={keyFor}
          />
        ))}
      </div>
    </div>
  );
}

function ContentGroupRenderer({ gi, group, defaultExpanded, fields, query, mode, matchedKeys, focusedKey, keyFor }: {
  gi: number;
  group: Group;
  defaultExpanded: boolean;
  fields: string[] | undefined;
  query: string;
  mode: 'highlight' | 'filter';
  matchedKeys: Set<string>;
  focusedKey: string | null;
  keyFor: (gi: number, ii: number) => string;
}) {
  // Auto-expand groups that hold the focused match so prev/next can scroll to
  // it even when the user collapsed the group earlier.
  const groupHasFocus = !!focusedKey && focusedKey.startsWith(`g${gi}-`);
  const [expanded, setExpanded] = useState(defaultExpanded);
  useEffect(() => { if (groupHasFocus) setExpanded(true); }, [groupHasFocus]);

  const visibleItems = useMemo(() => {
    if (!fields || mode !== 'filter' || !query) return group.items.map((item, ii) => ({ item, ii }));
    return group.items
      .map((item, ii) => ({ item, ii }))
      .filter(({ ii }) => matchedKeys.has(keyFor(gi, ii)));
  }, [group.items, fields, mode, query, matchedKeys, gi, keyFor]);

  if (mode === 'filter' && query && fields && visibleItems.length === 0) return null;

  const headerTitle = group.date
    ? formatDate(group.date)
    : group.items[0]?.title ?? '';

  return (
    <div className="content-group">
      <button className="content-group-header" onClick={() => setExpanded(e => !e)}>
        <svg className={`content-collapse-icon${expanded ? '' : ' collapsed'}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{headerTitle}</span>
      </button>
      {expanded && (
        <div className="content-group-body">
          {visibleItems.map(({ item, ii }) => {
            const sk = keyFor(gi, ii);
            const isMatch = matchedKeys.has(sk);
            const isFocus = isMatch && sk === focusedKey;
            const cls = isMatch && mode === 'highlight'
              ? `included-in-search${isFocus ? ' search-focus' : ''}`
              : undefined;
            return <ContentItemView key={ii} item={item} searchClass={cls} searchKey={fields ? sk : undefined} />;
          })}
        </div>
      )}
    </div>
  );
}

function cssEscape(s: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(s);
  return s.replace(/[^a-zA-Z0-9_-]/g, c => `\\${c}`);
}
