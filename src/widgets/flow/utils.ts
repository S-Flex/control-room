import type { DataGroup, DataTable, JSONRecord, JSONValue } from '@s-flex/xfw-data';
import { resolveField, toDisplayLabel } from '@s-flex/xfw-ui';
import { getLanguage } from 'xfw-get-block';
import { resolve } from '../resolve';
import type { AggregateFn, FieldMap, FilterRule, FlowBoardLevelConfig, FlowFieldEntry, FlowFilterGroup, FlowGroupBy, FlowLevelFieldConfig, FlowResolvedField } from './types';

export function isFilterGroupBy(groupBy: FlowGroupBy): groupBy is FlowFilterGroup[] {
  if (groupBy.length === 0) return false;
  const first = groupBy[0];
  return typeof first === 'object' && !Array.isArray(first) && 'filter' in first;
}

/** Resolve a dot-notation path with optional [index] and [*] wildcard. */
function resolvePath(obj: unknown, path: string): JSONValue[] {
  const segments = path.replace(/\[(\*|\d+)\]/g, '.$1').split('.');
  let current: unknown[] = [obj];
  for (const seg of segments) {
    const next: unknown[] = [];
    for (const node of current) {
      if (node === null || node === undefined || typeof node !== 'object') continue;
      if (seg === '*' && Array.isArray(node)) {
        next.push(...node);
      } else if (Array.isArray(node) && /^\d+$/.test(seg)) {
        const item = node[Number(seg)];
        if (item !== undefined) next.push(item);
      } else {
        const val = (node as Record<string, unknown>)[seg];
        if (val !== undefined) next.push(val);
      }
    }
    current = next;
    if (current.length === 0) return [null];
  }
  return current as JSONValue[];
}

/** Match a single filter rule against a row. Supports dot paths and [*] wildcards. */
export function matchFilter(row: JSONRecord, rule: FilterRule): boolean {
  const values = resolvePath(row, rule.field);
  const op = rule.op ?? '==';
  return values.some(val => {
    switch (op) {
      case '==': return val === rule.value;
      case '!=': return val !== rule.value;
      case '>': return typeof val === 'number' && typeof rule.value === 'number' && val > rule.value;
      case '>=': return typeof val === 'number' && typeof rule.value === 'number' && val >= rule.value;
      case '<': return typeof val === 'number' && typeof rule.value === 'number' && val < rule.value;
      case '<=': return typeof val === 'number' && typeof rule.value === 'number' && val <= rule.value;
      case 'in': return Array.isArray(rule.value) && rule.value.includes(val);
      case 'not_in': return Array.isArray(rule.value) && !rule.value.includes(val);
      default: return false;
    }
  });
}

/** Apply OR-of-ANDs filter: each sub-array is ANDed, sub-arrays are ORed. */
export function applyFilterGroup(rows: JSONRecord[], filter: FilterRule[][]): JSONRecord[] {
  return rows.filter(row =>
    filter.some(andGroup => andGroup.every(f => matchFilter(row, f)))
  );
}

export function groupRowsByFields(rows: JSONRecord[], fields: string[]): Map<string, JSONRecord[]> {
  const groups = new Map<string, JSONRecord[]>();
  for (const row of rows) {
    const key = fields.map(f => String(resolve(row, f) ?? '')).join('||');
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

export function resolveFieldMap(dataGroup: DataGroup, dataTable: DataTable): FieldMap {
  const fc = dataGroup.field_config ?? {};
  const result = Object.fromEntries(
    Object.entries(fc).map(([key, config]) => {
      const pgField = dataTable.schema[key];
      const resolved = pgField
        ? resolveField(key, pgField, config, fc)
        : { key, i18n: config.ui?.i18n, control: config.ui?.control, input_data: config.input_data };
      const uiInputData = (config.ui as Record<string, unknown> | undefined)?.input_data as typeof resolved.input_data | undefined;
      const input_data = resolved.input_data ?? config.input_data ?? uiInputData ?? pgField?.ref;
      return [key, {
        ...resolved,
        input_data,
        aggregate: (config as Record<string, unknown>).aggregate as AggregateFn | undefined,
        order: config.ui?.order,
        nav: (config as Record<string, unknown>).nav as FlowResolvedField['nav'],
      }];
    })
  );
  return result;
}

/** Resolve label from an i18n object, checking text, title, and label keys. */
export function resolveI18nLabel(i18n: unknown, key: string): string {
  if (i18n && typeof i18n === 'object') {
    const lang = getLanguage();
    const map = i18n as Record<string, Record<string, string> | undefined>;
    const byLang = map[lang];
    if (byLang?.text) return byLang.text;
    if (byLang?.label) return byLang.label;
    if (byLang?.title) return byLang.title;
    for (const v of Object.values(map)) {
      if (v?.text) return v.text;
      if (v?.label) return v.label;
      if (v?.title) return v.title;
    }
  }
  return toDisplayLabel(key);
}

export function resolveLabel(fieldMap: FieldMap, key: string): string {
  return resolveI18nLabel(fieldMap[key]?.i18n, key);
}

function resolveLevelLabel(levelFieldConfig: FlowLevelFieldConfig | undefined, fieldMap: FieldMap, key: string): string {
  const levelFc = levelFieldConfig?.[key];
  if (levelFc?.ui?.i18n) return resolveI18nLabel(levelFc.ui.i18n, key);
  return resolveLabel(fieldMap, key);
}

export function formatValue(val: JSONValue, control?: string): string {
  if (val === null || val === undefined) return '—';
  if (control === 'percent') {
    const num = Number(val);
    if (!isNaN(num)) {
      return `${Math.round(num)}%`;
    }
  }
  if (control === 'date' || control === 'datetime') {
    const d = new Date(val as string | number);
    if (!isNaN(d.getTime())) return control === 'date' ? d.toLocaleDateString() : `${d.toLocaleDateString()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function computeAggregate(rows: JSONRecord[], key: string, fn: AggregateFn): number {
  const vals = rows.map(r => Number(resolve(r, key) ?? 0)).filter(n => !isNaN(n));
  switch (fn) {
    case 'sum': return vals.reduce((a, b) => a + b, 0);
    case 'count': return rows.length;
    case 'avg': return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    case 'min': return vals.length ? Math.min(...vals) : 0;
    case 'max': return vals.length ? Math.max(...vals) : 0;
  }
}

export function getGroupByKeys(levelConfig: FlowBoardLevelConfig): string[] {
  const gb = levelConfig.group_by;
  if (!gb) return [];
  if (isFilterGroupBy(gb)) {
    const keys = new Set<string>();
    for (const group of gb) {
      for (const andGroup of group.filter) {
        for (const rule of andGroup) keys.add(rule.field);
      }
    }
    return [...keys];
  }
  return gb;
}

export function getAggregateKeys(levelFieldConfig: FlowLevelFieldConfig | undefined): string[] {
  if (!levelFieldConfig) return [];
  return Object.entries(levelFieldConfig)
    .filter(([key, fc]) => key !== 'class_name' && fc.aggregate)
    .map(([key]) => key);
}

/** Merge level field_config overrides on top of the root fieldMap.
 *  Only fields present in levelFieldConfig are included in the result;
 *  the root fieldMap is used as a lookup for defaults (i18n, control, etc.). */
export function mergeFieldMap(
  fieldMap: FieldMap,
  levelFieldConfig: FlowLevelFieldConfig | undefined,
  optionsMap?: Record<string, JSONRecord[]>,
): FieldMap {
  if (!levelFieldConfig) return fieldMap;
  const merged: FieldMap = {};
  for (const [key, fc] of Object.entries(levelFieldConfig)) {
    if (key === 'class_name' || key === 'no_label') continue;
    if (fc.ui?.hidden) continue;
    const base = fieldMap[key] ?? { key };
    // Resolve input_data: check fc.input_data, fc.ui.input_data, or base
    const uiInputData = (fc.ui as Record<string, unknown> | undefined)?.input_data as typeof base.input_data | undefined;
    let input_data = fc.input_data ?? uiInputData ?? base.input_data;
    if (input_data?.src && optionsMap?.[input_data.src]) {
      input_data = {
        options: optionsMap[input_data.src],
        value_key: input_data.value_key,
        label_key: input_data.label_key,
      };
    }
    merged[key] = {
      ...base,
      aggregate: fc.aggregate ?? base.aggregate,
      control: fc.ui?.control ?? base.control,
      i18n: fc.ui?.i18n ?? base.i18n,
      input_data,
      order: fc.ui?.order ?? base.order,
      nav: (fc as Record<string, unknown>).nav as FlowResolvedField['nav'] ?? base.nav,
    };
  }
  return merged;
}

/** Read class_name from a level field_config entry (fc.class_name or fc.ui.class_name). */
function fieldClassName(fc: FlowLevelFieldConfig[string] | undefined): string | undefined {
  if (!fc) return undefined;
  const raw = fc as Record<string, unknown>;
  const ui = fc.ui as Record<string, unknown> | undefined;
  return (raw.class_name as string) ?? (ui?.class_name as string) ?? undefined;
}

/** Read the group-level class_name from field_config (a top-level "class_name" key). */
export function groupClassName(levelFieldConfig: FlowLevelFieldConfig | undefined): string | undefined {
  if (!levelFieldConfig) return undefined;
  const raw = levelFieldConfig as Record<string, unknown>;
  const val = raw.class_name;
  return typeof val === 'string' ? val : undefined;
}

/**
 * Build all fields for a group: group-by values + aggregates, sorted by order.
 * Aggregate fields get their computed value; non-aggregate fields get the row value.
 */
export function buildGroupFields(
  rows: JSONRecord[],
  groupByFields: string[],
  fieldMap: FieldMap,
  levelFieldConfig?: FlowLevelFieldConfig,
  filterValues?: { field: string; value: JSONValue }[],
  aggregateRows?: JSONRecord[],
): FlowFieldEntry[] {
  const entries: FlowFieldEntry[] = [];
  const seen = new Set<string>();

  const isHidden = (key: string) => {
    const fc = levelFieldConfig?.[key];
    if (fc?.ui?.hidden) return true;
    const resolved = fieldMap[key];
    if (resolved?.control === 'hidden') return true;
    return false;
  };

  // Group-by fields: use first row value (or filter value)
  if (filterValues) {
    for (const f of filterValues) {
      seen.add(f.field);
      if (!fieldMap[f.field] || isHidden(f.field)) continue;
      entries.push({
        label: resolveLabel(fieldMap, f.field),
        value: f.value,
        field: fieldMap[f.field],
        class_name: fieldClassName(levelFieldConfig?.[f.field]),
      });
    }
  } else {
    const firstRow = rows[0];
    if (firstRow) {
      for (const key of groupByFields) {
        seen.add(key);
        if (!fieldMap[key] || isHidden(key)) continue;
        entries.push({
          label: resolveLabel(fieldMap, key),
          value: resolve(firstRow, key),
          field: fieldMap[key],
          class_name: fieldClassName(levelFieldConfig?.[key]),
        });
      }
    }
  }

  // Additional fields from level field_config (aggregate or first-row value)
  if (levelFieldConfig) {
    const firstRow = rows[0];
    for (const [key, fc] of Object.entries(levelFieldConfig)) {
      if (key === 'class_name' || key === 'no_label' || seen.has(key)) continue;
      const resolved = fieldMap[key];
      if (!resolved || isHidden(key)) continue;
      const agg = fc.aggregate;
      if (agg) {
        entries.push({
          label: resolveLevelLabel(levelFieldConfig, fieldMap, key),
          value: computeAggregate(aggregateRows ?? rows, key, agg),
          field: { ...resolved, aggregate: agg },
          class_name: fieldClassName(levelFieldConfig[key]),
        });
      } else if (firstRow) {
        entries.push({
          label: resolveLevelLabel(levelFieldConfig, fieldMap, key),
          value: resolve(firstRow, key),
          field: resolved,
          class_name: fieldClassName(levelFieldConfig[key]),
        });
      }
    }
  }

  return entries.sort((a, b) => (a.field?.order ?? 999) - (b.field?.order ?? 999));
}
