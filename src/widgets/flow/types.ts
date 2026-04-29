import type { FieldConfig, ResolvedField as LibResolvedField } from '@s-flex/xfw-ui';
import type { JSONValue } from '@s-flex/xfw-data';

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

export type FlowLevelFieldConfig = Record<string, FieldConfig & { aggregate_fn?: AggregateFn; }>;

export type FlowRowOptions = {
  colexp?: boolean;
  checkable?: boolean;
  selectable?: boolean;
  nav?: {
    on_select?: Record<string, unknown>;
  };
  /** Key on each row whose value is applied as the row text colour (any valid
   *  CSS color string). Empty/missing values fall back to the inherited colour. */
  color_field?: string;
};

export type FlowBoardLevelConfig = {
  layout: string;
  group_by?: FlowGroupBy;
  field_config?: FlowLevelFieldConfig;
  class_name?: string;
  row_options?: FlowRowOptions;
  children?: FlowBoardLevelConfig;
  /** Field paths a SearchBox at this level matches against. When present, the
   *  level renders its own search input + prev/next; child levels receive the
   *  filtered (filter mode) or untouched (highlight mode) row set. */
  search?: string[];
};

export type FieldNav = {
  path?: string;
  on_select?: Record<string, unknown>;
};

export type FlowResolvedField = LibResolvedField & {
  aggregate_fn?: AggregateFn;
  order?: number;
  nav?: FieldNav;
  /** Hide the label on visual controls. Inherited from
   *  `field_config[key].ui.no_label`; level field_config overrides root. */
  no_label?: boolean;
  /** Number of digits after the decimal point for numeric values. */
  scale?: number;
  /** Name of a sibling column on the row whose value supplies the colour. */
  color_field?: string;
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
  /** Resolved CSS color for the row's text — derived from
   *  `row_options.color_field` and the row data. */
  color?: string;
  i18n?: Record<string, Record<string, string>>;
  data: FlowFieldEntry[];
  rows: Record<string, JSONValue>[];
  navs?: FlowNavItem[];
  children: React.ReactNode;
  /** True when this group is at the bottom of the flow tree (no descendant
   *  level). Leaf groups carry the search highlight + prev/next anchor. */
  isLeaf?: boolean;
};

export type FlowLayoutProps = {
  layout: string;
  groups: FlowGroupData[];
};


export type FlowContextValue = {
  primaryKeys: string[];
  selectedKey: string | null;
  /** Key of the currently-selected flow group — single source of truth so
   *  ancestors/siblings don't light up when a deeper level is picked. */
  selectedGroupKey: string | null;
  toggleChecked: (row: Record<string, JSONValue>) => void;
  toggleCheckedAll: (rows: Record<string, JSONValue>[]) => void;
  clearChecked: () => void;
  mergeData: (rows: Record<string, JSONValue>[], data: FlowNavData[]) => void;
  selectItem: (row: Record<string, JSONValue>, groupKey: string, onSelect?: Record<string, unknown>) => void;
};
