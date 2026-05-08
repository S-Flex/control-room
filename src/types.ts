import type { CameraState } from 'xfw-three';

export type ProductionLine = {
  code: string;
  block: Record<string, unknown>;
  production_line_id: number;
  production_line_name: string;
};

export type LineConfig = {
  code: string;
  glb: string;
  block: Record<string, unknown>;
  camera?: CameraState;
  camera2d?: CameraState;
  production_lines?: ProductionLine[];
};

/** Configuration for one level of the generic <Menu>. Levels nest via
 *  `menu_config`; the items for the next level live on the selected parent
 *  record at `items_field`. */
export type MenuConfig = {
  /** Dot-path on each item to read the value written to the URL. */
  value_field: string;
  /** Dot-path on each item to read the display value passed to <Field>. */
  text_field: string;
  /** URL query-param key the selected value is written to. */
  query_param_field: string;
  /** Field control name passed to <Field> (e.g. "i18n-text", "text"). */
  control: string;
  /** Path on each item that holds the next level's items array. */
  items_field?: string;
  /** Configuration for the next nested level. */
  menu_config?: MenuConfig;
};

export type UiLabel = {
  code: string;
  block: Record<string, unknown>;
};

export type MenuContentEntry = {
  code: string;
  block: { title?: string; template?: { title: string; }; i18n?: Record<string, { title?: string; template?: { title: string; }; }>; };
};

export type MenuItemDef = {
  code: string;
  path: string;
  condition?: string;
  hidden_when?: { key: string; op: string; val: string[]; };
  block?: { title?: string; template?: { title: string; }; i18n?: Record<string, { title?: string; template?: { title: string; }; }>; };
};

export type GridConfig = {
  columns: string;
  rows?: string;
  areas?: string[];
  gap?: string;
  row_gap?: string;
  column_gap?: string;
};

export type NavItem = {
  text: string;
  icon?: string;
  path: string;
  params?: { key: string; val: string; is_query_param?: boolean }[];
  i18n?: Record<string, { text?: string; path?: string }>;
};

export type Section = {
  code?: string;
  data_group?: string;
  /** Renders a footer pager bound to another data_group's row count. The
   *  active index lives in the URL (`page_param`, default `?page=N`) so any
   *  widget reading the same param flips in lockstep. */
  pager?: { data_group: string; page_param?: string };
  nav?: NavItem[];
  area?: string;
  class_name?: string;
  /** When set, `sections` are laid out as grid children. Otherwise they
   *  stack vertically. */
  grid?: string | GridConfig;
  sections?: Section[];
};

export type PageArea = {
  class_name?: string;
  grid?: string | GridConfig;
  sections?: Section[];
};

export type PageConfig = {
  code: string;
  class_name?: string;
  main?: PageArea;
  footer?: PageArea;
};
