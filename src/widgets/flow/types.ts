import type { FieldConfig, JSONValue } from '@s-flex/xfw-data';
import type { ResolvedField as LibResolvedField } from '@s-flex/xfw-ui';

export type AggregateFn = 'sum' | 'count' | 'avg' | 'min' | 'max';

export type FilterOp = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'not_in';

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
  i18n?: Record<string, Record<string, string>>;
};

export type FlowGroupBy = FlowFilterGroup[] | string[];

export type FlowLevelFieldConfig = Record<string, FieldConfig & { aggregate?: AggregateFn }>;

export type FlowRowOptions = {
  colexp?: boolean;
  checkable?: boolean;
  selectable?: boolean;
  nav?: {
    on_select?: Record<string, unknown>;
  };
};

export type FlowBoardLevelConfig = {
  layout: string;
  group_by?: FlowGroupBy;
  field_config?: FlowLevelFieldConfig;
  class_name?: string;
  row_options?: FlowRowOptions;
  children?: FlowBoardLevelConfig;
};

export type FieldNav = {
  path: string;
};

export type FlowResolvedField = LibResolvedField & {
  aggregate?: AggregateFn;
  order?: number;
  nav?: FieldNav;
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
  colexp?: boolean;
  checkable?: boolean;
  selectable?: boolean;
  on_select?: Record<string, unknown>;
  i18n?: Record<string, Record<string, string>>;
  data: FlowFieldEntry[];
  rows: Record<string, JSONValue>[];
  navs?: FlowNavItem[];
  children: React.ReactNode;
};

export type FlowLayoutProps = {
  layout: string;
  groups: FlowGroupData[];
};


export type FlowContextValue = {
  primaryKeys: string[];
  selectedKey: string | null;
  toggleChecked: (row: Record<string, JSONValue>) => void;
  toggleCheckedAll: (rows: Record<string, JSONValue>[]) => void;
  clearChecked: () => void;
  mergeData: (rows: Record<string, JSONValue>[], data: FlowNavData[]) => void;
  selectItem: (row: Record<string, JSONValue>, onSelect?: Record<string, unknown>) => void;
};
