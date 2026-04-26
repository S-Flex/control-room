import type { DataGroup } from '@s-flex/xfw-ui';
import type { JSONRecord } from '@s-flex/xfw-data';

export type EditorState = {
  dataGroup: DataGroup;
  mockRows: JSONRecord[];
};

export const EDITOR_LANGS = ['en', 'nl', 'de', 'fr', 'uk', 'es'] as const;
export type EditorLang = typeof EDITOR_LANGS[number];
