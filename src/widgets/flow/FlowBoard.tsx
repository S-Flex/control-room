import type { ReactNode, ComponentType } from 'react';
import type { DataGroup, DataTable, JSONRecord } from '@s-flex/xfw-data';
import type { FlowBoardLevelConfig, FlowGroupData, FlowLayoutProps } from './types';
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

  if (!flowBoardConfig) {
    return <p className="datagroup-error">Missing flow_board_config</p>;
  }

  function renderLevel(
    levelConfig: FlowBoardLevelConfig,
    rows: JSONRecord[],
    consumedFields: Set<string>,
  ): ReactNode {
    const groupBy = levelConfig.group_by;

    // Leaf level: no group_by → render table
    if (!groupBy || groupBy.length === 0) {
      const leafFields = getLeafFields(fieldMap, consumedFields);
      return <FlowTable rows={rows} fields={leafFields} fieldMap={fieldMap} />;
    }

    // Merge level field_config overrides on top of root fieldMap
    const levelFieldMap = mergeFieldMap(fieldMap, levelConfig.field_config);

    // Collect fields consumed at this level
    const gbKeys = getGroupByKeys(levelConfig);
    const aggKeys = getAggregateKeys(levelConfig.field_config);
    const newConsumed = new Set([...consumedFields, ...gbKeys, ...aggKeys]);

    let groups: FlowGroupData[];

    const levelFc = levelConfig.field_config;
    const grpClassName = groupClassName(levelFc) ?? levelConfig.class_name;

    if (isFilterGroupBy(groupBy)) {
      // Compound filter groups
      groups = groupBy.map((filters, i) => {
        const groupRows = applyFilterGroup(rows, filters);
        const filterValues = filters.map(f => ({ field: f.field, value: f.value }));
        const data = buildGroupFields(groupRows, gbKeys, levelFieldMap, levelFc, filterValues);
        const children = levelConfig.children
          ? renderLevel(levelConfig.children, groupRows, newConsumed)
          : null;
        return { key: `filter-${i}`, class_name: grpClassName, data, children };
      });
    } else {
      // Field-based grouping
      const grouped = groupRowsByFields(rows, groupBy);
      groups = [...grouped.entries()].map(([key, groupRows]) => {
        const data = buildGroupFields(groupRows, groupBy as string[], levelFieldMap, levelFc);
        const children = levelConfig.children
          ? renderLevel(levelConfig.children, groupRows, newConsumed)
          : null;
        return { key, class_name: grpClassName, data, children };
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
    <div className="flow-board">
      {renderLevel(flowBoardConfig, data, new Set())}
    </div>
  );
}
