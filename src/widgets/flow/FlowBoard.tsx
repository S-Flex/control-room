import { useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useNavItemAction, type DataGroup, type NavItem } from '@s-flex/xfw-ui';
import type { DataTable, JSONRecord, JSONValue } from '@s-flex/xfw-data';
import { useNavigate, useQueryParams, parseFullPath } from '@s-flex/xfw-url';
import type { FlowBoardLevelConfig, FlowGroupData, FlowNavData, FlowContextValue } from './types';
import {
  resolveFieldMap,
  mergeFieldMap,
  isFilterGroupBy,
  applyFilterGroup,
  groupRowsByFields,
  getGroupByKeys,
  buildGroupFields,
  groupClassName,
  buildRowKey,
} from './utils';
import { FlowProvider } from './FlowContext';
import { useFieldOptions } from './useFieldOptions';
import { FlowBox } from './FlowBox';
import { SearchableLevel } from './SearchableLevel';
import { readSearchFields } from '../searchUtils';
import { syncQueryParams } from '../../lib/urlSync';

/** Walk the flow-board level chain and assign each level a stable
 *  `widget_id` — the explicit one if present, otherwise
 *  `<root>__<depth>` (root level uses `<root>` itself). Returns a map keyed
 *  by the level's reference identity. Returns null when no root id is
 *  available (persistence is then skipped). */
function buildWidgetIdMap(
  root: FlowBoardLevelConfig,
  rootWidgetId: string | undefined,
): Map<FlowBoardLevelConfig, string> | null {
  if (!rootWidgetId) return null;
  const map = new Map<FlowBoardLevelConfig, string>();
  let depth = 0;
  let cur: FlowBoardLevelConfig | undefined = root;
  while (cur) {
    const id = cur.widget_id ?? (depth === 0 ? rootWidgetId : `${rootWidgetId}__${depth}`);
    map.set(cur, id);
    cur = cur.children;
    depth++;
  }
  return map;
}

const COLEXP_SUFFIX = '.colexp';

function parseColexp(raw: unknown): Set<string> {
  // useQueryParams auto-coerces all-numeric values to number / number[]; we
  // must accept those shapes too or URL-persisted colexp silently disappears
  // for numeric row_keys.
  if (raw == null || raw === '') return new Set();
  if (Array.isArray(raw)) {
    return new Set(raw.map(v => String(v)).filter(s => s.length > 0));
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') {
    return new Set([String(raw)]);
  }
  if (typeof raw !== 'string') return new Set();
  return new Set(raw.split(';').filter(Boolean));
}

function formatColexp(set: Set<string>): string | null {
  if (set.size === 0) return null;
  // Sort so the URL is order-stable across toggles.
  return [...set].sort().join(';');
}

function readSelectedFromUrl(primaryKeys: string[]): string | null {
  if (primaryKeys.length === 0) return null;
  const params = new URLSearchParams(window.location.search);
  const values = primaryKeys.map(k => params.get(k));
  if (values.some(v => v === null)) return null;
  return values.join('||');
}

export function FlowBoard({ dataGroup, dataTable, data }: {
  dataGroup: DataGroup;
  dataTable: DataTable;
  data: JSONRecord[];
}) {
  const rawFieldMap = resolveFieldMap(dataGroup, dataTable);
  const dg = dataGroup as Record<string, unknown>;
  const flowBoardConfig = dg.flow_board_config as FlowBoardLevelConfig | undefined;
  const { fieldMap, optionsMap } = useFieldOptions(rawFieldMap, flowBoardConfig);
  const primaryKeys = dataTable.primary_keys ?? [];
  const navigate = useNavigate();
  const rootWidgetId = (dataGroup as { widget_id?: string }).widget_id;

  // Query params declared at the data_group root (externally-controlled
  // state — parent filters, etc.). Selection may write these on enter but
  // must NEVER null them on deselect, or the data_group loses its scoping.
  const rootQueryParamKeys = useMemo(
    () => new Set((dataGroup.params ?? []).filter(p => p.is_query_param).map(p => p.key)),
    [dataGroup.params],
  );
  const clearablePrimaryKeys = useMemo(
    () => primaryKeys.filter(k => !rootQueryParamKeys.has(k)),
    [primaryKeys, rootQueryParamKeys],
  );

  // Resolve a widget_id for every level (root + children). Order matters
  //  because `useQueryParams` depends on the resulting list of keys.
  const { widgetIdMap, widgetIds } = useMemo(() => {
    if (!flowBoardConfig) return { widgetIdMap: null, widgetIds: [] as string[] };
    const map = buildWidgetIdMap(flowBoardConfig, rootWidgetId);
    return {
      widgetIdMap: map,
      widgetIds: map ? [...new Set(map.values())] : [],
    };
  }, [flowBoardConfig, rootWidgetId]);

  const colexpQpDefs = useMemo(
    () => widgetIds.map(id => ({ key: id + COLEXP_SUFFIX, is_query_param: true, is_optional: true })),
    [widgetIds],
  );
  const colexpParams = useQueryParams(colexpQpDefs);
  const expandedSets = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const id of widgetIds) {
      const raw = colexpParams.find(p => p.key === id + COLEXP_SUFFIX)?.val;
      m.set(id, parseColexp(raw));
    }
    return m;
  }, [widgetIds, colexpParams]);

  // Latest expandedSets reachable from the toggle callback without retriggering
  //  the FlowProvider memo on every URL flip.
  const expandedSetsRef = useRef(expandedSets);
  expandedSetsRef.current = expandedSets;

  const toggleExpanded = useCallback((widgetId: string, rowKey: string) => {
    if (!widgetId || !rowKey) return;
    const cur = expandedSetsRef.current.get(widgetId) ?? new Set<string>();
    const next = new Set(cur);
    if (next.has(rowKey)) next.delete(rowKey);
    else next.add(rowKey);
    syncQueryParams({ [widgetId + COLEXP_SUFFIX]: formatColexp(next) });
  }, []);

  const [rows, setRows] = useState<JSONRecord[]>(() => data.map(r => ({ ...r, checked: false })));
  const [selectedKey, setSelectedKey] = useState<string | null>(() => readSelectedFromUrl(primaryKeys));
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);

  useEffect(() => {
    setRows(data.map(r => ({ ...r, checked: false })));
  }, [data]);

  // Validate selectedKey against current data — remove from URL if not found
  useEffect(() => {
    if (!selectedKey || primaryKeys.length === 0) return;
    const exists = rows.some(r => buildRowKey(r, primaryKeys) === selectedKey);
    if (!exists) {
      setSelectedKey(null);
      setSelectedGroupKey(null);
      navigate({ queryParams: clearablePrimaryKeys.map(k => ({ key: k, val: null })) });
    }
  }, [rows, selectedKey, primaryKeys, clearablePrimaryKeys, navigate]);

  const toggleChecked = useCallback((row: Record<string, unknown>) => {
    setRows(prev => prev.map(r => r === row ? { ...r, checked: !r.checked } : r));
  }, []);

  const toggleCheckedAll = useCallback((targetRows: Record<string, unknown>[]) => {
    const allChecked = targetRows.every(r => r.checked);
    setRows(prev => {
      const targetSet = new Set(targetRows);
      return prev.map(r => targetSet.has(r) ? { ...r, checked: !allChecked } : r);
    });
  }, []);

  const clearChecked = useCallback(() => {
    setRows(prev => prev.map(r => r.checked ? { ...r, checked: false } : r));
  }, []);

  const mergeData = useCallback((columnRows: Record<string, unknown>[], navData: FlowNavData[]) => {
    if (columnRows.length === 0 || navData.length === 0) return;
    const columnSet = new Set(columnRows);
    const hasChecked = columnRows.some(cr => cr.checked);
    setRows(prev => prev.map(r => {
      if (!columnSet.has(r)) return r;
      if (hasChecked && !r.checked) return r;
      const updated: JSONRecord = { ...r, checked: true };
      for (const d of navData) {
        updated[d.field] = d.value;
      }
      return updated;
    }));
  }, []);

  const navAction = useNavItemAction(undefined, undefined, { extraParamKeys: primaryKeys });

  const selectItem = useCallback((row: Record<string, unknown>, groupKey: string, onSelect?: Record<string, unknown>) => {
    const key = buildRowKey(row, primaryKeys);
    const sameGroup = groupKey === selectedGroupKey && key === selectedKey;
    const newKey = sameGroup ? null : key;
    const newGroupKey = sameGroup ? null : groupKey;
    setSelectedKey(newKey);
    setSelectedGroupKey(newGroupKey);

    // Fire on_select whenever the user *enters* a selection (sameGroup=false).
    // We can't gate on `newKey` because some inner levels (e.g. flow-table over a
    // view without primary_keys) produce an empty key — but the click is still a
    // valid selection and the nav must run. Toggling-off a selection (sameGroup
    // = true → newKey null) skips the nav, as before.
    if (onSelect && !sameGroup) {
      navAction(row as JSONRecord, onSelect as NavItem, true);
    } else if (newKey) {
      navigate({ queryParams: primaryKeys.map(k => ({ key: k, val: row[k] as JSONValue })) });
    } else {
      // Deselect: null clearable primary_keys. If selection was entered via
      // on_select, also undo that — close any aux outlets it opened and null
      // the on_select query_params (excluding ones declared at the root).
      const queryParams: { key: string; val: JSONValue }[] = clearablePrimaryKeys
        .map(k => ({ key: k, val: null as JSONValue }));
      let outlets: { key: string; val: string }[] | undefined;
      if (onSelect) {
        const onSelectPath = (onSelect as { path?: string }).path;
        if (onSelectPath) {
          const parsed = parseFullPath(onSelectPath);
          if (parsed.outlets.length > 0) {
            outlets = parsed.outlets.map(o => ({ key: o.key, val: '' }));
          }
        }
        const onSelectParams =
          (onSelect as { params?: { key: string; is_query_param?: boolean }[] }).params ?? [];
        const seen = new Set(queryParams.map(q => q.key));
        for (const p of onSelectParams) {
          if (p.is_query_param && !rootQueryParamKeys.has(p.key) && !seen.has(p.key)) {
            queryParams.push({ key: p.key, val: null });
            seen.add(p.key);
          }
        }
      }
      navigate({ outlets, queryParams });
    }
  }, [primaryKeys, clearablePrimaryKeys, rootQueryParamKeys, selectedKey, selectedGroupKey, navAction, navigate]);

  const ctx: FlowContextValue = useMemo(() => ({
    primaryKeys,
    selectedKey,
    selectedGroupKey,
    toggleChecked,
    toggleCheckedAll,
    clearChecked,
    mergeData,
    selectItem,
    expandedSets,
    toggleExpanded,
  }), [primaryKeys, selectedKey, selectedGroupKey, toggleChecked, toggleCheckedAll, clearChecked, mergeData, selectItem, expandedSets, toggleExpanded]);

  // Self-heal: when data lands, drop any persisted expanded `row_key` whose
  //  row no longer exists. The valid set is built off the same `buildRowKey`
  //  string the toggle writes, so the comparison is symmetric. Writes happen
  //  once per widget and only when something is actually pruned.
  useEffect(() => {
    if (primaryKeys.length === 0 || widgetIds.length === 0) return;
    const validKeys = new Set(rows.map(r => buildRowKey(r, primaryKeys)));
    const updates: Record<string, string | null> = {};
    for (const id of widgetIds) {
      const cur = expandedSets.get(id);
      if (!cur || cur.size === 0) continue;
      let dropped = false;
      const cleaned = new Set<string>();
      for (const k of cur) {
        if (validKeys.has(k)) cleaned.add(k);
        else dropped = true;
      }
      if (dropped) updates[id + COLEXP_SUFFIX] = formatColexp(cleaned);
    }
    if (Object.keys(updates).length > 0) syncQueryParams(updates);
  }, [rows, primaryKeys, widgetIds, expandedSets]);

  if (!flowBoardConfig) {
    return <p className="datagroup-error">Missing flow_board_config</p>;
  }

  // Fallback row_key generator for tables without primary_keys: hand out
  // sequential indices per widget_id so colexp can still persist a stable id.
  // Recreated each render — same data shape always yields the same indices.
  const colexpIndexCounter = new Map<string, number>();

  function buildGroup(
    levelConfig: FlowBoardLevelConfig,
    key: string,
    groupRows: JSONRecord[],
    data: FlowGroupData['data'],
    grpClassName: string | undefined,
    children: ReactNode,
    navs?: FlowGroupData['navs'],
    i18n?: FlowGroupData['i18n'],
  ): FlowGroupData {
    const colorField = levelConfig.row_options?.color_field;
    const colorRaw = colorField ? groupRows[0]?.[colorField] : undefined;
    const color = typeof colorRaw === 'string' && colorRaw ? colorRaw : undefined;
    const bgField = levelConfig.row_options?.background_color_field;
    const bgRaw = bgField ? groupRows[0]?.[bgField] : undefined;
    const background_color = typeof bgRaw === 'string' && bgRaw ? bgRaw : undefined;
    const widget_id = widgetIdMap?.get(levelConfig) ?? '';
    let row_key = '';
    if (primaryKeys.length > 0 && groupRows[0]) {
      row_key = buildRowKey(groupRows[0], primaryKeys);
    } else if (widget_id) {
      const idx = colexpIndexCounter.get(widget_id) ?? 0;
      colexpIndexCounter.set(widget_id, idx + 1);
      row_key = String(idx);
    }
    return {
      key,
      class_name: grpClassName,
      colexp: levelConfig.row_options?.colexp,
      checkable: levelConfig.row_options?.checkable,
      selectable: levelConfig.row_options?.selectable,
      on_select: levelConfig.row_options?.nav?.on_select,
      color,
      background_color,
      i18n,
      data,
      rows: groupRows,
      navs,
      children,
      isLeaf: !levelConfig.children,
      widget_id,
      row_key,
    };
  }

  function renderLevel(levelConfig: FlowBoardLevelConfig, levelRows: JSONRecord[], pruneEmpty = false): ReactNode {
    // If this level declares `search: [...]`, wrap its render in a
    // SearchableLevel that owns the search state. The wrapper hands back the
    // rows it wants displayed (filtered in filter mode, untouched in
    // highlight mode) so we can recurse normally over the visible subset.
    const searchFields = readSearchFields(levelConfig);
    if (searchFields) {
      return (
        <SearchableLevel
          rows={levelRows}
          fields={searchFields}
          render={(visibleRows, prune) => renderLevelInner(levelConfig, visibleRows, prune)}
        />
      );
    }
    return renderLevelInner(levelConfig, levelRows, pruneEmpty);
  }

  function renderLevelInner(levelConfig: FlowBoardLevelConfig, levelRows: JSONRecord[], pruneEmpty: boolean): ReactNode {
    const groupBy = levelConfig.group_by;
    const levelFieldMap = mergeFieldMap(fieldMap, levelConfig.field_config, optionsMap);
    const levelFc = levelConfig.field_config;
    const grpClassName = groupClassName(levelFc) ?? levelConfig.class_name;

    const getCheckedRows = (groupRows: JSONRecord[]) => {
      const checked = groupRows.filter(r => r.checked);
      return checked.length > 0 ? checked : undefined;
    };

    let groups: FlowGroupData[];

    if (!groupBy || groupBy.length === 0) {
      // No group_by: one card per row, fields from level field_config
      groups = levelRows.map((row, i) => {
        const data = buildGroupFields([row], [], levelFieldMap, levelFc);
        const children = levelConfig.children ? renderLevel(levelConfig.children, [row], pruneEmpty) : null;
        const rowKey = primaryKeys.length > 0
          ? primaryKeys.map(k => String(row[k] ?? '')).join('||')
          : String(i);
        return buildGroup(levelConfig, rowKey, [row], data, grpClassName, children);
      });
    } else if (isFilterGroupBy(groupBy)) {
      const gbKeys = getGroupByKeys(levelConfig);
      groups = groupBy
        .map((filterGroup, i) => {
          const groupRows = applyFilterGroup(levelRows, filterGroup.filter);
          // In filter mode, drop columns that came back empty so parents of
          // zero matches disappear instead of rendering as bare placeholders.
          if (pruneEmpty && groupRows.length === 0) return null;
          const data = buildGroupFields(groupRows, gbKeys, levelFieldMap, levelFc, undefined, getCheckedRows(groupRows));
          const children = levelConfig.children ? renderLevel(levelConfig.children, groupRows, pruneEmpty) : null;
          return buildGroup(levelConfig, `filter-${i}`, groupRows, data, grpClassName, children, filterGroup.navs, filterGroup.i18n);
        })
        .filter((g): g is FlowGroupData => g !== null);
    } else {
      const grouped = groupRowsByFields(levelRows, groupBy);
      groups = [...grouped.entries()].map(([key, groupRows]) => {
        const data = buildGroupFields(groupRows, groupBy as string[], levelFieldMap, levelFc, undefined, getCheckedRows(groupRows));
        const children = levelConfig.children ? renderLevel(levelConfig.children, groupRows, pruneEmpty) : null;
        return buildGroup(levelConfig, key, groupRows, data, grpClassName, children);
      });
    }

    // `hide_column_when_empty` only applies to flow-grid layouts. Empty
    // columns in card / table layouts often render group headers that are
    // still meaningful even with no rows, so we don't drop them there.
    if (levelConfig.hide_column_when_empty && levelConfig.layout === 'flow-grid') {
      groups = groups.filter(g => g.rows.length > 0);
    }

    return (
      <FlowBox
        layout={levelConfig.layout}
        groups={groups}
        columnMinWidth={levelConfig.column_min_width}
        columnMaxWidth={levelConfig.column_max_width}
        fieldConfig={levelConfig.field_config}
      />
    );
  }

  return (
    <FlowProvider value={ctx}>
      <div className="flow-board">
        {renderLevel(flowBoardConfig, rows)}
      </div>
    </FlowProvider>
  );
}
