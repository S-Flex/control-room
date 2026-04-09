import { useState, useCallback, useEffect, useMemo, type ReactNode, type ComponentType } from 'react';
import type { DataGroup, DataTable, JSONRecord } from '@s-flex/xfw-data';
import type { FlowBoardLevelConfig, FlowGroupData, FlowLayoutProps, FlowNavData, FlowContextValue } from './types';
import {
  resolveFieldMap,
  mergeFieldMap,
  isFilterGroupBy,
  applyFilterGroup,
  groupRowsByFields,
  getLeafFields,
  getGroupByKeys,
  getAggregateKeys,
  buildGroupFields,
  groupClassName,
} from './utils';
import { FlowProvider } from './FlowContext';
import { FlowGrid } from './FlowGrid';
import { FlowContainer } from './FlowContainer';
import { FlowCards } from './FlowCards';
import { FlowTable } from './FlowTable';

const layoutMap: Record<string, ComponentType<FlowLayoutProps>> = {
  'flow-grid': FlowGrid,
  'flow-container': FlowContainer,
  'flow-cards': FlowCards,
};

export function FlowBoard({ dataGroup, dataTable, data }: {
  dataGroup: DataGroup;
  dataTable: DataTable;
  data: JSONRecord[];
}) {
  const fieldMap = resolveFieldMap(dataGroup, dataTable);
  const dg = dataGroup as Record<string, unknown>;
  const flowBoardConfig = dg.flow_board_config as FlowBoardLevelConfig | undefined;
  const primaryKeys = dataTable.primary_keys ?? [];

  const [rows, setRows] = useState<JSONRecord[]>(() => data.map(r => ({ ...r, checked: false })));
  const [undoStack, setUndoStack] = useState<{ field: string; value_before: unknown; value_after: unknown }[][]>([]);

  useEffect(() => {
    setRows(data.map(r => ({ ...r, checked: false })));
    setUndoStack([]);
  }, [data]);

  const toggleChecked = useCallback((row: Record<string, unknown>) => {
    setRows(prev => prev.map(r => r === row ? { ...r, checked: !r.checked } : r));
  }, []);

  const toggleCheckedAll = useCallback((targetRows: Record<string, unknown>[]) => {
    const allChecked = targetRows.every(r => r.checked);
    console.log('toggleCheckedAll', { count: targetRows.length, allChecked, willSet: !allChecked });
    setRows(prev => {
      const targetSet = new Set(targetRows);
      return prev.map(r => targetSet.has(r) ? { ...r, checked: !allChecked } : r);
    });
  }, []);

  const clearChecked = useCallback(() => {
    setRows(prev => prev.map(r => r.checked ? { ...r, checked: false } : r));
  }, []);

  const MAX_UNDO = 50;

  const mergeData = useCallback((columnRows: Record<string, unknown>[], navData: FlowNavData[]) => {
    if (columnRows.length === 0 || navData.length === 0) return;
    const columnSet = new Set(columnRows);
    setRows(prev => {
      const next = prev.map(r => {
        if (!columnSet.has(r)) return r;
        // If none were checked, apply to all in this column; otherwise only checked
        const hasChecked = columnRows.some(cr => cr.checked);
        if (hasChecked && !r.checked) return r;
        const updated: JSONRecord = { ...r, checked: true };
        for (const d of navData) {
          updated[d.field] = d.value;
        }
        return updated;
      });
      console.log('mergeData applied', { columnCount: columnRows.length, changed: next.filter((r, i) => r !== prev[i]).length });
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    // TODO: undo with row-reference approach needs rethinking
    setUndoStack(prev => prev.slice(0, -1));
  }, []);

  const ctx: FlowContextValue = useMemo(() => ({
    toggleChecked,
    toggleCheckedAll,
    clearChecked,
    mergeData,
    undo,
    undoCount: undoStack.length,
  }), [toggleChecked, toggleCheckedAll, clearChecked, mergeData, undo, undoStack.length]);

  if (!flowBoardConfig) {
    return <p className="datagroup-error">Missing flow_board_config</p>;
  }

  function renderLevel(
    levelConfig: FlowBoardLevelConfig,
    levelRows: JSONRecord[],
    consumedFields: Set<string>,
  ): ReactNode {
    const groupBy = levelConfig.group_by;

    if (!groupBy || groupBy.length === 0) {
      const leafFields = getLeafFields(fieldMap, consumedFields);
      return <FlowTable rows={levelRows} fields={leafFields} />;
    }

    const levelFieldMap = mergeFieldMap(fieldMap, levelConfig.field_config);
    const gbKeys = getGroupByKeys(levelConfig);
    const aggKeys = getAggregateKeys(levelConfig.field_config);
    const newConsumed = new Set([...consumedFields, ...gbKeys, ...aggKeys]);

    let groups: FlowGroupData[];

    const levelFc = levelConfig.field_config;
    const grpClassName = groupClassName(levelFc) ?? levelConfig.class_name;

    const getCheckedRows = (groupRows: JSONRecord[]) => {
      const checked = groupRows.filter(r => r.checked);
      return checked.length > 0 ? checked : undefined;
    };

    if (isFilterGroupBy(groupBy)) {
      groups = groupBy.map((filterGroup, i) => {
        const groupRows = applyFilterGroup(levelRows, filterGroup.filter);
        const seen = new Set<string>();
        const filterValues: { field: string; value: unknown }[] = [];
        for (const rule of filterGroup.filter.flat()) {
          const key = `${rule.field}=${String(rule.value)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          filterValues.push({ field: rule.field, value: rule.value });
        }
        const data = buildGroupFields(groupRows, gbKeys, levelFieldMap, levelFc, filterValues, getCheckedRows(groupRows));
        const children = levelConfig.children
          ? renderLevel(levelConfig.children, groupRows, newConsumed)
          : null;
        return { key: `filter-${i}`, class_name: grpClassName, data, rows: groupRows, navs: filterGroup.navs, children };
      });
    } else {
      const grouped = groupRowsByFields(levelRows, groupBy);
      groups = [...grouped.entries()].map(([key, groupRows]) => {
        const data = buildGroupFields(groupRows, groupBy as string[], levelFieldMap, levelFc, undefined, getCheckedRows(groupRows));
        const children = levelConfig.children
          ? renderLevel(levelConfig.children, groupRows, newConsumed)
          : null;
        return { key, class_name: grpClassName, data, rows: groupRows, children };
      });
    }

    const Template = layoutMap[levelConfig.layout];
    if (!Template) {
      console.warn(`Unknown flow layout: "${levelConfig.layout}"`);
      return null;
    }

    return <Template groups={groups} />;
  }

  return (
    <FlowProvider value={ctx}>
      <div className="flow-board">
        {renderLevel(flowBoardConfig, rows, new Set())}
      </div>
    </FlowProvider>
  );
}
