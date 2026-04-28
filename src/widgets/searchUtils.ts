import type { JSONRecord, JSONValue } from '@s-flex/xfw-data';
import { resolve } from './resolve';

/** Case-insensitive substring match of `query` against the raw values of the
 *  listed dot-paths on `row`. Each path must resolve to a scalar (string,
 *  number, boolean) — object/array values are skipped, not stringified, to
 *  prevent a short query from accidentally matching every row via JSON
 *  punctuation or nested content. List the leaf paths you actually want to
 *  search (e.g. `["order_id", "state.name"]`). */
export function rowMatches(row: JSONRecord, query: string, fields: string[]): boolean {
  if (!query || !fields || fields.length === 0) return false;
  const q = query.toLowerCase();
  for (const field of fields) {
    const val = resolve(row, field);
    if (valueMatches(val, q)) return true;
  }
  return false;
}

function valueMatches(val: JSONValue, q: string): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'object') return false;
  return String(val).toLowerCase().includes(q);
}

/** Read the `search` field-list off a record (data_group, level config, …).
 *  Returns `undefined` when missing or empty. Values must be strings. */
export function readSearchFields(source: unknown): string[] | undefined {
  if (!source || typeof source !== 'object') return undefined;
  const raw = (source as Record<string, unknown>).search;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const fields = raw.filter((v): v is string => typeof v === 'string');
  return fields.length > 0 ? fields : undefined;
}
