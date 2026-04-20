import type { JSONRecord, JSONValue } from '@s-flex/xfw-data';
import { isNavItemHidden } from '@s-flex/xfw-ui';

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

/**
 * Check whether a field should be visible given its ui config and a data row.
 * Evaluates both `ui.hidden` (static) and `ui.hidden_when` (row-dependent)
 * using the library's isNavItemHidden.
 */
/** Convert a time string like "04:18:29+00" or "14:30" to minutes since midnight. */
function timeToMinutes(time: string): number {
  const clean = time.replace(/[+-]\d{2}$/, ''); // strip timezone offset
  const parts = clean.split(':');
  return Number(parts[0]) * 60 + Number(parts[1] || 0);
}

type ColorConfig = { values: string[]; formula: string };

/**
 * Evaluate a color formula against a data row.
 * The formula can reference row fields and use time comparisons.
 * Returns the color string from values[formulaResult].
 */
export function evaluateColorFormula(
  config: ColorConfig,
  row: JSONRecord,
  placeholders?: Record<string, string | number>,
): string {
  let expr = config.formula;

  // Substitute {name} placeholders first so the value (e.g. a series % read
  // from outside the row) can be injected before field/time replacements.
  if (placeholders) {
    expr = expr.replace(/\{(\w+)\}/g, (_, key) => {
      const v = placeholders[key];
      return v == null ? '0' : String(v);
    });
  }

  // Replace time literals like '12:00' or '0:00' with minutes
  expr = expr.replace(/'(\d{1,2}:\d{2})'/g, (_, t) => String(timeToMinutes(t)));

  // Replace field references with their values
  expr = expr.replace(/[a-z_][a-z0-9_]*/gi, (match) => {
    // Skip JS keywords
    if (match === 'true' || match === 'false' || match === 'null') return match;
    const val = row[match];
    if (val == null) return '0';
    const str = String(val);
    // If it looks like a time (HH:MM:SS or HH:MM), convert to minutes
    if (/^\d{1,2}:\d{2}(:\d{2})?([+-]\d{2})?$/.test(str)) {
      return String(timeToMinutes(str));
    }
    const num = Number(val);
    return isNaN(num) ? '0' : String(num);
  });

  try {
    const index = Number(new Function(`return (${expr})`)());
    const i = isFinite(index) ? Math.round(index) : 0;
    return config.values[Math.max(0, Math.min(i, config.values.length - 1))];
  } catch {
    return config.values[0];
  }
}

export function isFieldVisible(
  ui: { hidden?: boolean; hidden_when?: unknown } | undefined,
  row: JSONRecord,
): boolean {
  if (!ui) return true;
  if (ui.hidden) return false;
  if (ui.hidden_when) {
    return !isNavItemHidden({ hidden_when: ui.hidden_when } as any, row);
  }
  return true;
}
