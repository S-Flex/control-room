import type { DataGroup, JSONRecord, JSONValue } from '@s-flex/xfw-data';
import { getLanguage } from 'xfw-get-block';
import { resolve } from './resolve';
import { Content } from './Content';

/** Convert a field key to a human-readable label. */
function toDisplayLabel(key: string): string {
  const segment = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
  return segment
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .trim()
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function resolveLabel(fieldConfig: DataGroup['field_config'], key: string): string {
  const fc = fieldConfig?.[key];
  const raw = fc?.ui?.i18n;
  if (raw) {
    const lang = getLanguage();
    const r = raw as Record<string, unknown>;
    // Format: { label: "Width" } or { title: "Width" } — direct
    if (typeof r.label === 'string') return r.label;
    if (typeof r.title === 'string') return r.title;
    // Format: { en: { label: "Width" }, nl: { title: "Datum" } } — per-language
    const byLang = raw as Record<string, Record<string, string>>;
    const langEntry = byLang[lang];
    const label = langEntry?.label ?? langEntry?.title;
    if (label) return label;
    for (const v of Object.values(byLang)) {
      if (v?.label ?? v?.title) return v.label ?? v.title;
    }
  }
  return toDisplayLabel(key);
}

function formatValue(val: unknown, fieldType?: string): string {
  if (val === null || val === undefined) return '—';
  switch (fieldType) {
    case 'date':
    case 'datetime': {
      const d = new Date(val as string | number);
      if (isNaN(d.getTime())) return String(val);
      return fieldType === 'date'
        ? d.toLocaleDateString()
        : d.toLocaleString();
    }
    default:
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r} ${g} ${b} / ${Math.round(alpha * 100)}%)`;
}

function cardBackground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  // Warm colors (red/orange/yellow) get higher opacity for vibrancy
  if (r > 200 && g < 80) return hexToRgba(hex, 0.48);   // reds
  if (r > 200 && g < 180) return hexToRgba(hex, 0.48);  // oranges/yellows
  return hexToRgba(hex, 0.20);                           // greens, blues, etc.
}

function sortFields(keys: string[], fieldConfig?: DataGroup['field_config']): string[] {
  if (!fieldConfig) return keys;
  return [...keys].sort((a, b) => {
    const orderA = fieldConfig[a]?.ui?.order ?? 999;
    const orderB = fieldConfig[b]?.ui?.order ?? 999;
    return orderA - orderB;
  });
}

function Card({ row, fields, fieldConfig }: {
  row: JSONRecord;
  fields: string[];
  fieldConfig?: DataGroup['field_config'];
}) {
  const stateColor = resolve(row, 'state.color') as string | null;

  return (
    <div
      className="cards-card"
      style={stateColor ? { backgroundColor: cardBackground(stateColor) } : undefined}
    >
      <div className="cards-card-fields">
        {fields.map(key => {
          const fc = fieldConfig?.[key];
          const className = fc?.ui?.group?.class_name;
          const fieldType = fc?.ui?.control;

          if (fieldType === 'content') {
            const val = resolve(row, key) as JSONValue;
            return (
              <div key={key} className={`cards-field${className ? ' ' + className : ''}`}>
                <Content data={val} />
              </div>
            );
          }

          return (
            <div key={key} className={`cards-field${className ? ' ' + className : ''}`}>
              <span className="cards-field-label">{resolveLabel(fieldConfig, key)}</span>
              <span className="cards-field-value">{formatValue(resolve(row, key), fieldType)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Cards({ dataGroup, data }: { dataGroup: DataGroup; data: JSONRecord[]; }) {
  if (!data || data.length === 0) return null;

  const fieldConfig = dataGroup.field_config;

  const fields = fieldConfig
    ? sortFields(Object.keys(fieldConfig).filter(k => {
      const ui = fieldConfig[k]?.ui;
      return !ui?.hidden && !ui?.hidden && !ui?.table?.hidden;
    }), fieldConfig)
    : Object.keys(data[0]);

  return (
    <div className="cards-list">
      {data.map((row, i) => (
        <Card
          key={(row.id as string | number) ?? i}
          row={row}
          fields={fields}
          fieldConfig={fieldConfig}
        />
      ))}
    </div>
  );
}
