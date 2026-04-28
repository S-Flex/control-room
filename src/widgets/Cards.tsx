import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavItemAction, type DataGroup, type NavItem, type ResolvedField } from '@s-flex/xfw-ui';
import type { DataTable, JSONRecord, JSONValue } from '@s-flex/xfw-data';
import { useNavigate } from '@s-flex/xfw-url';
import { resolve, isFieldVisible } from './resolve';
import { Content } from './Content';
import { Field } from '../controls/Field';
import { SearchBox, useSearchState } from '../controls/SearchBox';
import { readSearchFields, rowMatches } from './searchUtils';

import type { FieldNav } from './flow/types';

type CardField = ResolvedField & { order?: number; class_name?: string; nav?: FieldNav; hidden_when?: unknown; no_label?: boolean; color_field?: string; scale?: number; };

function resolveFields(dataGroup: DataGroup): { fields: CardField[]; class_name?: string; no_label?: boolean; } {
  const fc = dataGroup.field_config;
  if (!fc) return { fields: [] };
  const fcAny = fc as Record<string, unknown>;
  const class_name = fcAny.class_name as string | undefined;
  const groupNoLabel = fcAny.no_label as boolean | undefined;
  const fields = Object.entries(fc)
    .filter(([key, config]) => {
      if (key === 'class_name' || key === 'no_label') return false;
      const ui = config.ui;
      // Static hidden — always filtered out. hidden_when is checked per-row at render time.
      return !ui?.hidden && !ui?.table?.hidden;
    })
    .map(([key, config]) => {
      const ui = config.ui as Record<string, unknown> | undefined;
      const cfgRaw = config as Record<string, unknown>;
      const fieldNoLabel = ui?.no_label as boolean | undefined;
      return {
        key,
        i18n: config.ui?.i18n,
        control: config.ui?.control,
        input_data: config.input_data,
        order: config.ui?.order,
        class_name: cfgRaw.class_name as string | undefined
          ?? ui?.class_name as string | undefined
          ?? config.ui?.group?.class_name,
        nav: cfgRaw.nav as FieldNav | undefined,
        hidden_when: config.ui?.hidden_when,
        no_label: fieldNoLabel ?? groupNoLabel,
        color_field: ui?.color_field as string | undefined,
        scale: (cfgRaw.scale as number | undefined) ?? (ui?.scale as number | undefined),
      } as CardField;
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return { fields, class_name, no_label: groupNoLabel };
}

function buildRowKey(row: Record<string, unknown>, primaryKeys: string[]): string {
  return primaryKeys.map(k => String(row[k] ?? '')).join('||');
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r} ${g} ${b} / ${Math.round(alpha * 100)}%)`;
}

function cardBackground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  if (r > 200 && g < 80) return hexToRgba(hex, 0.48);
  if (r > 200 && g < 180) return hexToRgba(hex, 0.48);
  return hexToRgba(hex, 0.20);
}

function Card({ row, fields, class_name, selectable, isSelected, onSelect, searchClass, searchTrack }: {
  row: JSONRecord;
  fields: CardField[];
  class_name?: string;
  selectable?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  /** Extra className appended for search highlight / focus state. */
  searchClass?: string;
  /** `data-search-track` attribute used by prev/next to scroll to this card. */
  searchTrack?: string;
}) {
  const stateColor = resolve(row, 'state.color') as string | null;

  return (
    <div
      className={`flow-card-section${selectable ? ' flow-selectable' : ''}${isSelected ? ' flow-selected' : ''}${searchClass ? ' ' + searchClass : ''}`}
      data-search-track={searchTrack}
      style={stateColor ? { backgroundColor: cardBackground(stateColor) } : undefined}
      onClick={selectable ? onSelect : undefined}
    >
      <div className="flow-card-header">
        <div className={class_name || undefined}>
          {fields.map((f, i) => {
            if (!isFieldVisible({ hidden_when: f.hidden_when }, row)) return null;
            const val = resolve(row, f.key) as JSONValue;
            if (f.control === 'content') {
              return (
                <div key={`${f.key}-${i}`} className={f.class_name || undefined}>
                  <Content data={val} />
                </div>
              );
            }
            return (
              <div key={`${f.key}-${i}`} className={f.class_name || undefined}>
                <Field field={f} value={val} row={row} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Cards({ dataGroup, data, dataTable }: { dataGroup: DataGroup; data: JSONRecord[]; dataTable?: DataTable; }) {
  const { fields, class_name } = resolveFields(dataGroup);
  const rowOptions = (dataGroup as Record<string, unknown>).row_options as Record<string, unknown> | undefined;
  const selectable = rowOptions?.selectable as boolean | undefined;
  const onSelectNavItem = (rowOptions?.nav as Record<string, unknown> | undefined)?.on_select;
  const primaryKeys = dataTable?.primary_keys ?? [];
  const navigate = useNavigate();
  const navAction = useNavItemAction(undefined, undefined, { extraParamKeys: primaryKeys });

  const searchFields = readSearchFields(dataGroup);
  const search = useSearchState();
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedKey, setSelectedKey] = useState<string | null>(() => {
    if (primaryKeys.length === 0) return null;
    const params = new URLSearchParams(window.location.search);
    const values = primaryKeys.map(k => params.get(k));
    if (values.some(v => v === null)) return null;
    return values.join('||');
  });

  // Match by `row.track_by` — the numeric id stamped on every row by
  // DataGroupContent. Survives the row-clone passes that toggleChecked /
  // mergeData do to flip flags, and doesn't depend on primary_keys. Uses
  // `appliedQuery` (committed via Enter), not the live input, so the match
  // set / counter only update on commit.
  const matchedTracks = useMemo(() => {
    if (!searchFields || !search.appliedQuery) return new Set<number>();
    const set = new Set<number>();
    for (const row of data) {
      const track = row.track_by;
      if (typeof track !== 'number') continue;
      if (rowMatches(row, search.appliedQuery, searchFields)) set.add(track);
    }
    return set;
  }, [data, searchFields, search.appliedQuery]);

  const visibleData = useMemo(() => {
    if (!searchFields || search.mode !== 'filter' || !search.appliedQuery) return data;
    return data.filter(row => typeof row.track_by === 'number' && matchedTracks.has(row.track_by));
  }, [data, searchFields, search.mode, search.appliedQuery, matchedTracks]);

  const matchOrderedTracks = useMemo(() => {
    const out: number[] = [];
    visibleData.forEach(row => {
      const t = row.track_by;
      if (typeof t === 'number' && matchedTracks.has(t)) out.push(t);
    });
    return out;
  }, [visibleData, matchedTracks]);

  // Scroll the focused match into view after layout settles. Highlight mode
  // only — in filter mode every match is on screen and prev/next is hidden.
  useEffect(() => {
    if (search.mode !== 'highlight') return;
    if (matchOrderedTracks.length === 0) return;
    const idx = Math.min(search.currentIndex, matchOrderedTracks.length - 1);
    const track = matchOrderedTracks[idx];
    const el = containerRef.current?.querySelector(`[data-search-track="${track}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [matchOrderedTracks, search.currentIndex, search.mode]);

  const handlePrev = useCallback(() => {
    if (matchOrderedTracks.length === 0) return;
    search.setCurrentIndex((search.currentIndex - 1 + matchOrderedTracks.length) % matchOrderedTracks.length);
  }, [matchOrderedTracks.length, search]);
  const handleNext = useCallback(() => {
    if (matchOrderedTracks.length === 0) return;
    search.setCurrentIndex((search.currentIndex + 1) % matchOrderedTracks.length);
  }, [matchOrderedTracks.length, search]);
  const handleSubmit = useCallback((direction: 'next' | 'prev') => {
    if (search.commit()) return;
    if (direction === 'next') handleNext(); else handlePrev();
  }, [search, handleNext, handlePrev]);

  const handleSelect = useCallback((row: JSONRecord) => {
    const key = buildRowKey(row, primaryKeys);
    const newKey = key === selectedKey ? null : key;
    setSelectedKey(newKey);

    if (onSelectNavItem && newKey) {
      navAction(row, onSelectNavItem as NavItem, true);
    } else {
      const keyValues = primaryKeys.map(k => ({ key: k, val: (newKey ? row[k] : null) as JSONValue }));
      navigate({ queryParams: keyValues });
    }
  }, [primaryKeys, selectedKey, onSelectNavItem, navAction, navigate]);

  if (!data || data.length === 0) return null;

  const focusedTrack = matchOrderedTracks.length > 0
    ? matchOrderedTracks[Math.min(search.currentIndex, matchOrderedTracks.length - 1)]
    : null;

  return (
    <div className="cards-widget">
      {searchFields && (
        <SearchBox
          query={search.query}
          onQueryChange={search.setQuery}
          mode={search.mode}
          onModeChange={search.setMode}
          matchCount={matchOrderedTracks.length}
          currentIndex={search.currentIndex}
          onPrev={handlePrev}
          onNext={handleNext}
          onSubmit={handleSubmit}
        />
      )}
      <div ref={containerRef} className="flow-card-list">
        {visibleData.map((row, i) => {
          const key = (row.id as string | number) ?? i;
          const rowKey = primaryKeys.length > 0 ? buildRowKey(row, primaryKeys) : null;
          const track = typeof row.track_by === 'number' ? row.track_by : null;
          const isMatch = track !== null && matchedTracks.has(track);
          const isFocus = isMatch && track === focusedTrack;
          const searchClass = isMatch && search.mode === 'highlight'
            ? `included-in-search${isFocus ? ' search-focus' : ''}`
            : undefined;
          return (
            <Card
              key={key}
              row={row}
              fields={fields}
              class_name={class_name}
              selectable={selectable}
              isSelected={selectable && selectedKey != null && rowKey === selectedKey}
              onSelect={() => handleSelect(row)}
              searchClass={searchClass}
              searchTrack={isMatch && track !== null ? String(track) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
