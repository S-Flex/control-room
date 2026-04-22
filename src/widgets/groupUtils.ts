import type { JSONRecord, JSONValue } from '@s-flex/xfw-data';
import { resolve } from './resolve';

/** Group config shared between widgets: binds a parent field path (whose value
 *  resolves to an array or object-of-objects) to a set of sub-field overrides
 *  that are rendered once per item. */
export type FieldGroupConfig<TEntry = unknown> = {
  data_field: string;
  field_config?: Record<string, TEntry>;
  class_name?: string;
};

/** Resolve a parent field path on a row into a list of sub-records.
 *  - Array → filter non-null objects.
 *  - Object (record-of-records) → take its values.
 *  - Anything else → empty list.
 */
export function resolveGroupItems(row: JSONRecord, dataField: string): JSONRecord[] {
  const raw = resolve(row, dataField);
  if (Array.isArray(raw)) {
    return raw.filter(v => v != null && typeof v === 'object' && !Array.isArray(v)) as JSONRecord[];
  }
  if (raw != null && typeof raw === 'object') {
    return Object.values(raw as Record<string, JSONValue>)
      .filter(v => v != null && typeof v === 'object' && !Array.isArray(v)) as JSONRecord[];
  }
  return [];
}

/** Strip a parent-path prefix from a field key so sub-records can be resolved
 *  relative to the group item rather than the full row.
 *  `relativeKey("data.nest_status", "data.nest_status.amount") === "amount"` */
export function relativeKey(parent: string, key: string): string {
  return key.startsWith(`${parent}.`) ? key.slice(parent.length + 1) : key;
}
