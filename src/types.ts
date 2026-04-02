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
