import { useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type { DataGroup, DataTable, JSONRecord, JSONValue } from '@s-flex/xfw-data';
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
} from './utils';
import { FlowProvider } from './FlowContext';
import { useFieldOptions } from './useFieldOptions';
import { FlowBox } from './FlowBox';

function buildRowKey(row: Record<string, unknown>, primaryKeys: string[]): string {
  return primaryKeys.map(k => String(row[k] ?? '')).join('||');
}

function readSelectedFromUrl(primaryKeys: string[]): string | null {
  if (primaryKeys.length === 0) return null;
  const params = new URLSearchParams(window.location.search);
  const values = primaryKeys.map(k => params.get(k));
  if (values.some(v => v === null)) return null;
  return values.join('||');
}

function writeSelectedToUrl(row: Record<string, unknown> | null, primaryKeys: string[]) {
  const params = new URLSearchParams(window.location.search);
  if (row) {
    for (const pk of primaryKeys) {
      const val = row[pk];
      if (val !== undefined && val !== null) params.set(pk, String(val));
    }
  } else {
    for (const pk of primaryKeys) params.delete(pk);
  }
  const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState(null, '', newUrl);
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

  const [rows, setRows] = useState<JSONRecord[]>(() => data.map(r => ({ ...r, checked: false })));
  const [selectedKey, setSelectedKey] = useState<string | null>(() => readSelectedFromUrl(primaryKeys));

  useEffect(() => {
    setRows(data.map(r => ({ ...r, checked: false })));
  }, [data]);

  // Validate selectedKey against current data — remove from URL if not found
  useEffect(() => {
    if (!selectedKey || primaryKeys.length === 0) return;
    const exists = rows.some(r => buildRowKey(r, primaryKeys) === selectedKey);
    if (!exists) {
      setSelectedKey(null);
      writeSelectedToUrl(null, primaryKeys);
    }
  }, [rows, selectedKey, primaryKeys]);

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

  const selectItem = useCallback((row: Record<string, unknown>) => {
    const key = buildRowKey(row, primaryKeys);
    const newKey = key === selectedKey ? null : key;
    setSelectedKey(newKey);
    writeSelectedToUrl(newKey ? row : null, primaryKeys);
  }, [primaryKeys, selectedKey]);

  const ctx: FlowContextValue = useMemo(() => ({
    primaryKeys,
    selectedKey,
    toggleChecked,
    toggleCheckedAll,
    clearChecked,
    mergeData,
    selectItem,
  }), [primaryKeys, selectedKey, toggleChecked, toggleCheckedAll, clearChecked, mergeData, selectItem]);

  if (!flowBoardConfig) {
    return <p className="datagroup-error">Missing flow_board_config</p>;
  }

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
    return {
      key,
      class_name: grpClassName,
      colexp: levelConfig.colexp,
      checkable: levelConfig.checkable,
      selectable: levelConfig.selectable,
      i18n,
      data,
      rows: groupRows,
      navs,
      children,
    };
  }

  function renderLevel(levelConfig: FlowBoardLevelConfig, levelRows: JSONRecord[]): ReactNode {
    const groupBy = levelConfig.group_by;
    if (!groupBy || groupBy.length === 0) return null;

    const levelFieldMap = mergeFieldMap(fieldMap, levelConfig.field_config, optionsMap);
    const gbKeys = getGroupByKeys(levelConfig);
    const levelFc = levelConfig.field_config;
    const grpClassName = groupClassName(levelFc) ?? levelConfig.class_name;

    const getCheckedRows = (groupRows: JSONRecord[]) => {
      const checked = groupRows.filter(r => r.checked);
      return checked.length > 0 ? checked : undefined;
    };

    let groups: FlowGroupData[];

    if (isFilterGroupBy(groupBy)) {
      groups = groupBy.map((filterGroup, i) => {
        const groupRows = applyFilterGroup(levelRows, filterGroup.filter);
        const data = buildGroupFields(groupRows, gbKeys, levelFieldMap, levelFc, undefined, getCheckedRows(groupRows));
        const children = levelConfig.children ? renderLevel(levelConfig.children, groupRows) : null;
        return buildGroup(levelConfig, `filter-${i}`, groupRows, data, grpClassName, children, filterGroup.navs, filterGroup.i18n);
      });
    } else {
      const grouped = groupRowsByFields(levelRows, groupBy);
      groups = [...grouped.entries()].map(([key, groupRows]) => {
        const data = buildGroupFields(groupRows, groupBy as string[], levelFieldMap, levelFc, undefined, getCheckedRows(groupRows));
        const children = levelConfig.children ? renderLevel(levelConfig.children, groupRows) : null;
        return buildGroup(levelConfig, key, groupRows, data, grpClassName, children);
      });
    }

    return <FlowBox layout={levelConfig.layout} groups={groups} />;
  }

  return (
    <FlowProvider value={ctx}>
      <div className="flow-board">
        {renderLevel(flowBoardConfig, rows)}
      </div>
    </FlowProvider>
  );
}
