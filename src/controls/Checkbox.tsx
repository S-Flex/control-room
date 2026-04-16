import type { JSONValue } from '@s-flex/xfw-data';

/** Get checked state for a group of rows using the `checked` property on each row. */
export function useGroupCheck(rows: Record<string, JSONValue>[]) {
  const allChecked = rows.length > 0 && rows.every(r => r.checked);
  const someChecked = rows.some(r => r.checked);
  return { allChecked, someChecked };
}
