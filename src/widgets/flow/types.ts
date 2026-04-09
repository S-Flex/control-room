import type { FieldConfig, JSONValue } from '@s-flex/xfw-data';
import type { ResolvedField as LibResolvedField } from '@s-flex/xfw-ui';

export type AggregateFn = 'sum' | 'count' | 'avg' | 'min' | 'max';

export type FilterOp = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'like';

export type FilterRule = {
  field: string;
  op: FilterOp;
  value: JSONValue;
};

export type FlowGroupBy = FilterRule[][] | string[];

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
  children: React.ReactNode;
};

export type FlowLayoutProps = {
  groups: FlowGroupData[];
};

export type FlowTableProps = {
  rows: Record<string, JSONValue>[];
  fields: FlowResolvedField[];
  fieldMap?: FieldMap;
};
