import type { FieldConfig, JSONValue } from '@s-flex/xfw-data';
import type { ResolvedField as LibResolvedField } from '@s-flex/xfw-ui';

export type AggregateFn = 'sum' | 'count' | 'avg' | 'min' | 'max';

export type FilterOp = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'like';

export type FilterRule = {
  field: string;
  op: FilterOp;
  value: JSONValue;
};

export type FlowNavData = {
  field: string;
  value: JSONValue;
};

export type FlowNavItem = {
  nav_item_id: string;
  type: string;
  i18n?: Record<string, Record<string, string>>;
  data?: FlowNavData[];
};

export type FlowFilterGroup = {
  filter: FilterRule[][];
  navs?: FlowNavItem[];
};

export type FlowGroupBy = FlowFilterGroup[] | string[];

export type FlowLevelFieldConfig = Record<string, FieldConfig & { aggregate?: AggregateFn }>;

export type FlowBoardLevelConfig = {
  layout: string;
  group_by?: FlowGroupBy;
  field_config?: FlowLevelFieldConfig;
  class_name?: string;
  children?: FlowBoardLevelConfig;
};

export type FlowResolvedField = LibResolvedField & {
  aggregate?: AggregateFn;
  order?: number;
};

export type FieldMap = Record<string, FlowResolvedField>;

export type FlowFieldEntry = {
  label: string;
  value: JSONValue;
  field: FlowResolvedField;
  class_name?: string;
};

export type FlowGroupData = {
  key: string;
  class_name?: string;
  data: FlowFieldEntry[];
  rows: Record<string, JSONValue>[];
  navs?: FlowNavItem[];
  children: React.ReactNode;
};

export type FlowLayoutProps = {
  groups: FlowGroupData[];
};

export type FlowTableProps = {
  rows: Record<string, JSONValue>[];
  fields: FlowResolvedField[];
};

export type ActionChange = {
  primary_key: string;
  field: string;
  value_before: JSONValue;
  value_after: JSONValue;
};

export type FlowContextValue = {
  toggleChecked: (row: Record<string, JSONValue>) => void;
  toggleCheckedAll: (rows: Record<string, JSONValue>[]) => void;
  clearChecked: () => void;
  mergeData: (rows: Record<string, JSONValue>[], data: FlowNavData[]) => void;
  undo: () => void;
  undoCount: number;
};
