import type { JSONRecord, JSONValue } from '@s-flex/xfw-data';

/** Resolve a dot-notation field path on a JSON record. */
export function resolve(row: JSONRecord, path: string | undefined): JSONValue {
  if (!path) return null;
  let val: JSONValue = row;
  for (const seg of path.split('.')) {
    if (val === null || typeof val !== 'object' || Array.isArray(val)) return null;
    val = (val as JSONRecord)[seg] ?? null;
  }
  return val;
}
