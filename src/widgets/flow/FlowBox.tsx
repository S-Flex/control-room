import { useEffect, useMemo, useRef } from 'react';
import type { JSONRecord, JSONValue } from '@s-flex/xfw-data';
import type { FieldConfig } from '@s-flex/xfw-ui';
import type { FlowGroupData, FlowLayoutProps, FlowNavItem } from './types';
import { Field } from '../../controls/Field';
import { Checkbox } from '@s-flex/xfw-ui';
import { useGroupCheck } from '../../controls/Checkbox';
import { resolveI18nLabel, buildRowKey } from './utils';
import { useFlowContext } from './FlowContext';
import { useFlowSearch } from './FlowSearchContext';
import { DataGroupProvider, useDataGroupContext } from '../DataGroupContext';
import { ColumnGridPagerControls, useColumnGridPager, type ColumnGridPager } from '../useColumnGridPager';

function FlowBoxItem({ g, isGrid, pager, tableAllRows, isFirstInTable }: {
  g: FlowGroupData;
  isGrid: boolean;
  pager?: ColumnGridPager;
  /** All flow-table rows across every group. Set only when layout is `flow-table`.
   *  Used by the first row's "select all" checkbox; presence also signals
   *  table-mode to the rest of the component. */
  tableAllRows?: Record<string, JSONValue>[];
  isFirstInTable?: boolean;
}) {
  const isTable = !!tableAllRows;
  const { allChecked, someChecked } = useGroupCheck(g.rows);
  const tableCheck = useGroupCheck(tableAllRows ?? []);
  const {
    primaryKeys, selectedKey, toggleCheckedAll, selectItem, mergeData,
    expandedSets, toggleExpanded,
  } = useFlowContext();
  // Collapse state is URL-driven via `?<widget_id>.colexp=<row_key>;…`.
  //  Default closed for `colexp: true`, default open for `colexp: false`.
  //  Without a widget_id or row_key (no primary keys) we keep the default —
  //  the toggle still works locally for the current session via re-render
  //  but won't survive a refresh.
  const isInExpandedSet = !!(g.widget_id && g.row_key
    && expandedSets.get(g.widget_id)?.has(g.row_key));
  const defaultCollapsed = g.colexp !== false;
  const isCollapsed = defaultCollapsed ? !isInExpandedSet : isInExpandedSet;
  const flowSearch = useFlowSearch();
  // A leaf card (no descendant levels) is a search "item": it represents one
  // or more rows aggregated into a single visual card and matches the active
  // query when any of its rows' `track_by` is in the matched set. Non-leaf
  // groups never highlight — only the leaf is the unit of focus.
  const isSearchActive = flowSearch.matchedTracks.size > 0;
  const matchedTrack = (g.isLeaf && isSearchActive)
    ? rowTrackMatch(g.rows, flowSearch.matchedTracks)
    : null;
  const isSearchMatch = matchedTrack !== null;
  const isSearchFocused = isSearchMatch && matchedTrack === flowSearch.focusedTrack;
  const searchHighlightClass = isSearchMatch && flowSearch.highlight
    ? ` included-in-search${isSearchFocused ? ' search-focus' : ''}`
    : '';
  // `data-search-track` lives only on matched leaves so SearchableLevel's
  // prev/next walks exactly the matched-card list in DOM order. The value is
  // the first matching row's `track_by` — multi-row leaves still resolve to
  // a single anchor.
  const searchAnchor = matchedTrack !== null ? String(matchedTrack) : undefined;

  // Auto-expand any collapsible group whose subtree contains the currently
  // focused match — only on focus *change* so the user can still manually
  // collapse a group that happens to hold the focus without it snapping back
  // open. Initial ref = null so a focused-on-mount card still expands.
  const containsFocusedRow = flowSearch.focusedTrack !== null
    && g.rows.some(r => r.track_by === flowSearch.focusedTrack);
  const lastFocusedRef = useRef<number | null>(null);
  useEffect(() => {
    const f = flowSearch.focusedTrack;
    if (f === lastFocusedRef.current) return;
    lastFocusedRef.current = f;
    if (containsFocusedRow && isCollapsed && g.widget_id && g.row_key) {
      toggleExpanded(g.widget_id, g.row_key);
    }
  }, [flowSearch.focusedTrack, containsFocusedRow, isCollapsed, g.widget_id, g.row_key, toggleExpanded]);

  // In flow-table the checkbox is strictly opt-in (must be `true`); other
  // layouts keep the legacy default-on behaviour.
  const showCheckbox = isTable ? g.checkable === true : g.checkable !== false;
  const showColexp = g.colexp === true;
  // The selection identity is the row's primary-key string. Comparing on
  //  `g.key` (the level's group_by key, e.g. just `resource_name`) lit up
  //  every leaf with the same group key in every parent cell — multiple
  //  cards "selected" at once. Primary-keys are globally unique, so only the
  //  actually-clicked row matches; selection also persists across reloads
  //  because `selectedKey` is seeded from the URL on mount.
  const isSelected = !!g.selectable
    && primaryKeys.length > 0
    && g.rows.length > 0
    && buildRowKey(g.rows[0], primaryKeys) === selectedKey;

  const handleNavClick = (nav: FlowNavItem) => {
    if (!nav.data || nav.data.length === 0) return;
    mergeData(g.rows, nav.data);
  };

  const hasChecked = g.rows.some(r => r.checked);

  const handleSelect = g.selectable ? (e: React.MouseEvent) => {
    // Stop propagation so clicks on a deeper selectable group don't also
    // fire the ancestor's select handler — deepest level wins.
    e.stopPropagation();
    selectItem(g.rows[0], g.key, g.on_select);
  } : undefined;

  const handleColexp = (e: React.MouseEvent) => {
    // Toggling collapse must never double as a selection change.
    e.stopPropagation();
    if (g.widget_id && g.row_key) toggleExpanded(g.widget_id, g.row_key);
  };

  return (
    <div
      className={`${isGrid ? 'column-grid-column' : 'flow-card-section'}${g.selectable ? ' flow-selectable' : ''}${isSelected ? ' flow-selected' : ''}${g.color ? ' flow-row-colored' : ''}${g.background_color ? ' flow-row-bg-colored' : ''}${searchHighlightClass}`}
      data-search-track={searchAnchor}
      style={(g.color || g.background_color)
        ? {
            ...(g.color ? { color: g.color } : null),
            ...(g.background_color ? { backgroundColor: g.background_color } : null),
          }
        : undefined}
      onClick={handleSelect}
    >
      <div className={`${isGrid ? 'column-grid-column-header' : 'flow-card-header'}${(showCheckbox || showColexp) ? ' has-controls' : ''}`}>
        {(showCheckbox || showColexp) && (
          <div className="flow-card-controls">
            {isFirstInTable && showCheckbox && tableAllRows && (
              <Checkbox
                isSelected={tableCheck.allChecked}
                isIndeterminate={tableCheck.someChecked && !tableCheck.allChecked}
                onChange={() => toggleCheckedAll(tableAllRows)}
              />
            )}
            {showCheckbox && (
              <Checkbox
                isSelected={allChecked}
                isIndeterminate={someChecked && !allChecked}
                onChange={() => toggleCheckedAll(g.rows)}
              />
            )}
            {showColexp && (
              <button className="flow-collapse-btn" onClick={handleColexp}>
                <svg className={`flow-collapse-icon${isCollapsed ? ' collapsed' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className={g.class_name || undefined}>
          {g.i18n
            ? <span className="flow-box-title">{resolveI18nLabel(g.i18n, g.key)}</span>
            : g.data.map((d, i) => (
              <div
                key={d.field?.key ? `${d.field.key}-${i}` : i}
                className={d.class_name || undefined}
              >
                <Field
                  field={d.field}
                  value={d.value}
                  row={g.rows[0]}
                  progress_value={d.progress_value}
                />
              </div>
            ))
          }
        </div>
        {pager && <ColumnGridPagerControls pager={pager} />}
      </div>
      {g.navs && g.navs.length > 0 && (
        <div className={isGrid ? 'column-grid-column-nav' : undefined}>
          <div className="flow-nav">
            {g.navs.map(nav => (
              <button
                key={nav.nav_item_id}
                className="flow-nav-btn"
                disabled={!hasChecked || !nav.data}
                onClick={() => handleNavClick(nav)}
              >
                {resolveI18nLabel(nav.i18n, nav.nav_item_id)}
              </button>
            ))}
          </div>
        </div>
      )}
      {!isCollapsed && g.children && (
        <div className={isGrid ? 'column-grid-column-body' : 'flow-card-body'}>
          {g.children}
        </div>
      )}
    </div>
  );
}

function cssSize(v: string | number | undefined): string | undefined {
  if (v == null) return undefined;
  return typeof v === 'number' ? `${v}px` : v;
}

export function FlowBox({ layout, groups, columnMinWidth, columnMaxWidth, fieldConfig: levelFieldConfig }: FlowLayoutProps) {
  const isGrid = layout === 'flow-grid';
  const { gridRef, pager, handleScroll, isNarrow } = useColumnGridPager(groups.length);

  // Apply per-data-group column widths as CSS variables. The grid template
  // (`.column-grid` in app.css) reads `--column-min-width` / `--column-max-width`
  // via `minmax()` so columns clamp to those bounds and the grid scrolls
  // horizontally when content overflows.
  const gridStyle = useMemo<React.CSSProperties | undefined>(() => {
    const minW = cssSize(columnMinWidth);
    const maxW = cssSize(columnMaxWidth);
    if (!minW && !maxW) return undefined;
    const style: Record<string, string> = {};
    if (minW) style['--column-min-width'] = minW;
    if (maxW) style['--column-max-width'] = maxW;
    return style as React.CSSProperties;
  }, [columnMinWidth, columnMaxWidth]);

  // Override the DataGroupContext's `fieldConfig` with this level's merged
  // field_config so descendant `<Field>`s (notably `control: 'table'`)
  // resolve sub-field configs from the level — where overrides like
  // `hidden: false` for table columns live — instead of from the bare root.
  const ctx = useDataGroupContext();
  const ctxValue = useMemo(() => {
    if (!levelFieldConfig) return ctx;
    return { ...ctx, fieldConfig: levelFieldConfig as unknown as Record<string, FieldConfig> };
  }, [ctx, levelFieldConfig]);

  if (!isGrid) {
    // `flow-table` is `flow-cards`/`flow-container` with table-style CSS.
    // Same FlowBoxItem rendering — only the wrapper class differs. The first
    // row also gets a "select all" checkbox keyed off every table row.
    const isTable = layout === 'flow-table';
    const wrapperClass = isTable ? 'flow-table' : 'flow-card-list';
    const tableAllRows = isTable ? groups.flatMap(g => g.rows) : undefined;
    return (
      <DataGroupProvider value={ctxValue}>
        <div className={wrapperClass}>
          {isTable && groups[0] && (
            <FlowTableHeader data={groups[0].data} className={groups[0].class_name} />
          )}
          {groups.map((g, i) => (
            <FlowBoxItem
              key={g.key}
              g={g}
              isGrid={false}
              tableAllRows={tableAllRows}
              isFirstInTable={isTable && i === 0}
            />
          ))}
        </div>
      </DataGroupProvider>
    );
  }

  return (
    <DataGroupProvider value={ctxValue}>
      <div
        ref={gridRef}
        className={`column-grid column-grid--aligned${isNarrow ? ' is-narrow' : ''}`}
        style={gridStyle}
        onScroll={handleScroll}
      >
        {groups.map(g => <FlowBoxItem key={g.key} g={g} isGrid pager={pager} />)}
      </div>
    </DataGroupProvider>
  );
}

/** Return the first matching `track_by` in the group's rows, or null. */
function rowTrackMatch(rows: ReadonlyArray<Record<string, JSONValue>>, matched: Set<number>): number | null {
  for (const r of rows) {
    const t = r.track_by;
    if (typeof t === 'number' && matched.has(t)) return t;
  }
  return null;
}

/** Header row for `flow-table` layouts: renders the field labels in a
 *  dedicated div above the cards so the labels are not part of any data row
 *  (and therefore not part of the search surface). The labels reuse the same
 *  grid `className` as a card's data row so the columns line up. */
function FlowTableHeader({ data, className }: {
  data: import('./types').FlowFieldEntry[];
  className?: string;
}) {
  return (
    <div className="flow-table-header">
      <div className={`flow-table-header-grid${className ? ` ${className}` : ''}`}>
        {data.map((d, i) => (
          <div key={d.field?.key ? `${d.field.key}-${i}` : i} className={d.class_name || undefined}>
            <span className="field-label">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
