import { useState } from 'react';
import type { DataGroup } from '@s-flex/xfw-ui';
import type { JSONRecord, JSONValue } from '@s-flex/xfw-data';
import { resolve } from './resolve';
import { Field } from '../controls/Field';

export type DonutChartConfig = {
  group_field: string;
  code_field?: string;
  content_field?: string;
  color_field: string;
  aggregate_field: string;
  aggregate_fn?: string;
  show_legend?: boolean;
  filter_field?: string;
};

type AggBucket = {
  key: string;
  content: JSONValue;
  color: string;
  values: number[];
};

function aggregate(values: number[], fn: string): number {
  if (values.length === 0) return 0;
  switch (fn) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'count': return values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    default: return values.reduce((a, b) => a + b, 0);
  }
}

type Group = {
  key: string;
  content: JSONValue;
  color: string;
  value: number;
  pct: number;
};

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function resolveBucketKey(row: JSONRecord, config: DonutChartConfig): string {
  if (config.code_field) {
    return String(resolve(row, config.code_field) ?? '');
  }
  const g = resolve(row, config.group_field);
  if (g && typeof g === 'object' && !Array.isArray(g)) {
    return String((g as JSONRecord).code ?? JSON.stringify(g));
  }
  return String(g ?? '');
}

function buildGroups(data: JSONRecord[], config: DonutChartConfig): Group[] {
  const fn = config.aggregate_fn ?? 'sum';

  const buckets = new Map<string, AggBucket>();
  for (const row of data) {
    const key = resolveBucketKey(row, config);
    const val = Number(resolve(row, config.aggregate_field) ?? 0);

    if (!buckets.has(key)) {
      const content = config.content_field ? resolve(row, config.content_field) : key;
      buckets.set(key, {
        key,
        content,
        color: String(resolve(row, config.color_field) ?? '#888'),
        values: [],
      });
    }
    buckets.get(key)!.values.push(val);
  }

  const groups: Group[] = [];
  let total = 0;
  for (const bucket of buckets.values()) {
    const value = aggregate(bucket.values, fn);
    if (value > 0) {
      total += value;
      groups.push({ key: bucket.key, content: bucket.content, color: bucket.color, value, pct: 0 });
    }
  }
  if (total > 0) {
    for (const g of groups) g.pct = Math.round((g.value / total) * 100);
  }
  groups.sort((a, b) => b.value - a.value);
  return groups;
}

function DonutRing({ groups }: { groups: Group[]; }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 76;
  const stroke = 22;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const producingGroup = groups.find(g => g.key === 'producing');

  return (
    <div className="donut-chart-ring">
      <svg width="100%" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bar-bg)" strokeWidth={stroke} />
        {groups.map(g => {
          const dash = (g.pct / 100) * circumference;
          const gap = circumference - dash;
          const el = (
            <circle
              key={g.key}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={g.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}
            />
          );
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" fontSize="28" fontWeight="800">
          {producingGroup?.pct ?? 0}%
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontWeight="500">
          OEE
        </text>
      </svg>
    </div>
  );
}

type FieldConfigEntry = Record<string, unknown> & {
  control?: string;
  ui?: Record<string, unknown>;
};

function resolveControl(fc: FieldConfigEntry | undefined): string | undefined {
  if (!fc) return undefined;
  return (fc.control as string | undefined) ?? ((fc.ui as Record<string, unknown> | undefined)?.control as string | undefined);
}

function LegendLabel({ content, fieldKey, fieldConfig }: {
  content: JSONValue;
  fieldKey: string | undefined;
  fieldConfig: FieldConfigEntry | undefined;
}) {
  const control = resolveControl(fieldConfig);
  if (!control || !fieldKey) {
    return <span>{typeof content === 'string' ? content : JSON.stringify(content)}</span>;
  }
  const i18n = (fieldConfig?.ui as Record<string, unknown> | undefined)?.i18n as Record<string, Record<string, string>> | undefined;
  return (
    <Field
      field={{ key: fieldKey, control, i18n, no_label: true }}
      value={content}
    />
  );
}

export function DonutChart({ widgetConfig, dataGroup, data }: {
  widgetConfig: DonutChartConfig;
  dataGroup?: DataGroup;
  data: JSONRecord[];
}) {
  const filterField = widgetConfig.filter_field;
  const filterOptions: { key: string; label: string; }[] = [];
  if (filterField && data) {
    const seen = new Set<string>();
    for (const row of data) {
      const val = String(resolve(row, filterField) ?? '');
      if (val && !seen.has(val)) {
        seen.add(val);
        filterOptions.push({ key: val, label: val });
      }
    }
  }

  const [activeFilters, setActiveFilters] = useState<Set<string>>(() => new Set(filterOptions.map(o => o.key)));

  const currentKeys = filterOptions.map(o => o.key).sort().join(',');
  const [prevKeys, setPrevKeys] = useState(currentKeys);
  if (currentKeys !== prevKeys) {
    setPrevKeys(currentKeys);
    setActiveFilters(new Set(filterOptions.map(o => o.key)));
  }

  const toggleFilter = (key: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (!data || data.length === 0) return null;

  const filteredData = filterField
    ? data.filter(row => {
        const v = String(resolve(row, filterField) ?? '');
        // Rows without a filter value aren't covered by any tab — always include them
        // so the total matches the data and doesn't silently drop unclassified duration.
        return !v || activeFilters.has(v);
      })
    : data;

  const groups = buildGroups(filteredData, widgetConfig);

  const totalSeconds = data.reduce((s, r) => s + Number(resolve(r, widgetConfig.aggregate_field) ?? 0), 0);
  const filteredSeconds = filteredData.reduce((s, r) => s + Number(resolve(r, widgetConfig.aggregate_field) ?? 0), 0);
  const groupsSeconds = groups.reduce((s, g) => s + g.value, 0);
  console.log('[DonutChart] rows', {
    rowCount: data.length,
    filteredCount: filteredData.length,
    totalSeconds,
    totalHMS: `${Math.floor(totalSeconds / 3600)}:${String(Math.round((totalSeconds % 3600) / 60)).padStart(2, '0')}`,
    filteredSeconds,
    groupsSeconds,
    activeFilters: Array.from(activeFilters),
    config: widgetConfig,
    rows: data,
    filteredRows: filteredData,
    groups,
  });

  if (groups.length === 0) return null;

  const contentField = widgetConfig.content_field;
  const fieldConfig = dataGroup?.field_config as Record<string, FieldConfigEntry> | undefined;
  const contentFieldConfig = contentField ? fieldConfig?.[contentField] : undefined;

  return (
    <div className="donut-chart-wrap">
      {filterOptions.length > 1 && (
        <div className="donut-filter-tabstrip">
          {filterOptions.map(o => (
            <button
              key={o.key}
              className={`donut-filter-tab${activeFilters.has(o.key) ? ' active' : ''}`}
              onClick={() => toggleFilter(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      <DonutRing groups={groups} />
      {widgetConfig.show_legend !== false && (
        <div className="donut-chart-legend">
          {groups.map(g => (
            <div key={g.key} className="donut-chart-legend-item">
              <span className="donut-chart-legend-dot" style={{ background: g.color }} />
              <span className="donut-chart-legend-label">
                <LegendLabel content={g.content} fieldKey={contentField} fieldConfig={contentFieldConfig} />
              </span>
              <span className="donut-chart-legend-detail">{formatDuration(g.value)}</span>
              <span className="donut-chart-legend-pct">{g.pct}%</span>
            </div>
          ))}
          <div className="donut-chart-legend-item donut-chart-legend-total">
            <span className="donut-chart-legend-dot" />
            <span className="donut-chart-legend-label">Total</span>
            <span className="donut-chart-legend-detail">
              {formatDuration(groups.reduce((s, g) => s + g.value, 0))}
            </span>
            <span className="donut-chart-legend-pct">
              {groups.reduce((s, g) => s + g.pct, 0)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
