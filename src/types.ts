import type { CameraState } from 'xfw-three';

export type LineConfig = {
  code: string;
  glb: string;
  block: Record<string, unknown>;
  camera?: CameraState;
  camera2d?: CameraState;
};

export type UiLabel = {
  code: string;
  block: Record<string, unknown>;
};

export type MenuContentEntry = {
  code: string;
  block: { title?: string; textFormula?: { title: string; }; i18n?: Record<string, { title?: string; textFormula?: { title: string; }; }>; };
};

export type MenuItemDef = {
  code: string;
  path: string;
  condition?: string;
  hidden_when?: { key: string; op: string; val: string[]; };
  block?: { title?: string; textFormula?: { title: string; }; i18n?: Record<string, { title?: string; textFormula?: { title: string; }; }>; };
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
  nav?: NavItem[];
  area?: string;
  class_name?: string;
  grid?: string | GridConfig;
  cols?: Section[];
  sections?: Section[];
};

export type PageConfig = {
  code: string;
  class_name?: string;
  grid?: string | GridConfig;
  cols?: Section[];
  sections?: Section[];
};
