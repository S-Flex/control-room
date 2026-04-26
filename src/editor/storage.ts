import type { EditorState } from './types';
import { DEFAULT_TEMPLATE } from './templates';

const KEY = 'data-group-editor-state-v1';

export function loadEditorState(): EditorState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_TEMPLATE.state;
    const parsed = JSON.parse(raw) as EditorState;
    if (!parsed.dataGroup || !Array.isArray(parsed.mockRows)) return DEFAULT_TEMPLATE.state;
    return parsed;
  } catch {
    return DEFAULT_TEMPLATE.state;
  }
}

export function saveEditorState(state: EditorState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* localStorage full or disabled — skip */
  }
}

export function clearEditorState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* skip */
  }
}
