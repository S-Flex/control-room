import { useState, useMemo, useCallback } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import type { JSONRecord } from '@s-flex/xfw-data';
import type { FieldConfig } from '@s-flex/xfw-ui';
import { getLanguage } from 'xfw-get-block';
import { isFieldVisible, evaluateColorFormula } from './resolve';

type ColorConfig = { values: string[]; formula: string };

type BarSet = {
  color: string | ColorConfig;
  value_field: string;
  max_value_field?: string;
  i18n?: Record<string, { textFormula?: string }>;
};

type TooltipFieldConfig = {
  ui?: {
    i18n?: Record<string, Record<string, string>>;
    order?: number;
    control?: string;
    type?: string;
    scale?: number;
    hidden?: boolean;
    hidden_when?: unknown;
  };
  formula?: string;
};

type VerticalBarTooltip = {
  field_config?: Record<string, TooltipFieldConfig>;
};

export type VerticalBarConfig = {
  sets: BarSet[];
  vertical_axis: { field: string };
  tooltip?: VerticalBarTooltip;
  group_by?: string;
};

type MergedFieldEntry = {
  key: string;
  order: number;
  label: string;
  control?: string;
  scale?: number;
  formula?: string;
  hidden?: boolean;
  hidden_when?: unknown;
};

function getFieldLabel(
  key: string,
  fc: { ui?: { i18n?: Record<string, Record<string, string>> } } | undefined,
  lang: string,
): string {
  const title = fc?.ui?.i18n?.[lang]?.title;
  if (title) return title;
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function buildMergedFields(
  rootFieldConfig: Record<string, FieldConfig> | undefined,
  tooltipFieldConfig: Record<string, TooltipFieldConfig> | undefined,
  lang: string,
): MergedFieldEntry[] {
  const merged: Record<string, TooltipFieldConfig> = {};

  if (rootFieldConfig) {
    for (const [key, val] of Object.entries(rootFieldConfig)) {
      merged[key] = val as unknown as TooltipFieldConfig;
    }
  }

  if (tooltipFieldConfig) {
    for (const [key, val] of Object.entries(tooltipFieldConfig)) {
      merged[key] = { ...merged[key], ...val, ui: { ...merged[key]?.ui, ...val.ui } };
    }
  }

  const entries: MergedFieldEntry[] = [];
  for (const [key, fc] of Object.entries(merged)) {
    if (!tooltipFieldConfig?.[key]) continue;
    entries.push({
      key,
      order: fc.ui?.order ?? 999,
      label: getFieldLabel(key, fc, lang),
      control: fc.ui?.control ?? fc.ui?.type,
      scale: fc.ui?.scale,
      formula: fc.formula,
      hidden: fc.ui?.hidden,
      hidden_when: fc.ui?.hidden_when,
    });
  }

  entries.sort((a, b) => a.order - b.order);
  return entries;
}

function evaluateFormula(formula: string, row: JSONRecord): number | null {
  try {
    const expr = formula.replace(/[a-z_][a-z0-9_]*/gi, (match) => {
      const val = row[match];
      if (val == null) return 'NaN';
      return String(Number(val));
    });
    const result = new Function(`return (${expr})`)() as number;
    return isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function resolveTextFormula(formula: string, row: JSONRecord): string {
  return formula.replace(/\{(\w+)\}/g, (_, key) => {
    const val = row[key];
    if (val == null) {
      return '';
    }
    const num = Number(val);
    if (!isNaN(num) && typeof val !== 'boolean') return String(Math.round(num));
    return String(val);
  });
}

function formatValue(val: unknown, control?: string, scale?: number): string {
  if (val == null) return '—';
  if (control === 'level') {
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return `${Math.round(num * 100)}%`;
  }
  if (control === 'percent') {
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return `${Math.round(num)}%`;
  }
  if (control === 'date') {
    return new Date(val as string | number).toLocaleDateString();
  }
  if (control === 'i18n-text') {
    return String(val);
  }
  if (typeof scale === 'number') {
    const num = Number(val);
    if (!isNaN(num)) return num.toFixed(scale);
  }
  return String(val);
}

const LANGS = new Set(['nl', 'en', 'de', 'fr', 'uk']);

function resolveI18n(val: unknown, lang: string): string {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const keys = Object.keys(val as Record<string, unknown>);
    if (keys.length > 0 && keys.every(k => LANGS.has(k))) {
      const localized = (val as Record<string, Record<string, string>>)[lang]
        ?? (val as Record<string, Record<string, string>>)[keys[0]];
      return localized?.title ?? localized?.text ?? '';
    }
  }
  return String(val ?? '');
}

function CustomTooltip({
  payload,
  tooltipFields,
}: {
  payload?: Array<{ payload: JSONRecord }>;
  tooltipFields: MergedFieldEntry[];
}) {
  if (!payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="vbar-tooltip">
      {tooltipFields.map(f => {
        if (!isFieldVisible(f, row)) return null;
        let val: unknown;
        if (f.formula) {
          val = evaluateFormula(f.formula, row);
        } else {
          val = row[f.key];
        }
        return (
          <div key={f.key} className="vbar-tooltip-row">
            <span className="vbar-tooltip-label">{f.label}</span>
            <span className="vbar-tooltip-value">{formatValue(val, f.control, f.scale)}</span>
          </div>
        );
      })}
    </div>
  );
}

function VerticalBarChart({
  sets,
  vertical_axis,
  tooltipFields,
  data,
  rawData,
  title,
}: {
  sets: BarSet[];
  vertical_axis: { field: string };
  tooltipFields: MergedFieldEntry[];
  data: JSONRecord[];
  rawData: JSONRecord[];
  title?: string;
}) {
  const lang = getLanguage();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const xAxes = useMemo(() => {
    return sets.map((set, i) => {
      let maxVal = 0;
      for (const row of rawData) {
        if (set.max_value_field) {
          const mv = Number(row[set.max_value_field] ?? 0);
          if (mv > maxVal) maxVal = mv;
        } else {
          const v = Number(row[set.value_field] ?? 0);
          if (v > maxVal) maxVal = v;
        }
      }
      return {
        id: `x-${i}`,
        orientation: i === 0 ? 'bottom' as const : 'top' as const,
        domain: [0, maxVal || 'auto'] as [number, number | string],
      };
    });
  }, [sets, rawData]);

  const handleClick = useCallback((state: any, e: any) => {
    if (state?.activeTooltipIndex != null) {
      setActiveIndex(prev =>
        prev === state.activeTooltipIndex ? null : state.activeTooltipIndex,
      );
      if (e?.nativeEvent) {
        const rect = (e.nativeEvent.target as Element)?.closest('.vbar-chart')?.getBoundingClientRect();
        if (rect) {
          setTooltipPos({
            x: e.nativeEvent.clientX - rect.left,
            y: e.nativeEvent.clientY - rect.top,
          });
        }
      }
    }
  }, []);

  const linesPerGroup = 1 + sets.length;
  const chartHeight = Math.max(160, data.length * linesPerGroup * 18 + 40);

  return (
    <div className="vbar-chart">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          onClick={handleClick}
        >
          <CartesianGrid stroke="none" />
          <YAxis
            type="category"
            dataKey={vertical_axis.field}
            tick={(tickProps: any) => {
              const { x, y, payload } = tickProps;
              const row = data[payload.index];
              const rawRow = rawData[payload.index];
              const category = String(payload.value);

              const contentObj = rawRow?.[vertical_axis.field];
              let textFormulas: string[] | undefined;
              if (contentObj && typeof contentObj === 'object' && !Array.isArray(contentObj)) {
                const obj = contentObj as Record<string, unknown>;
                if (obj.i18n && typeof obj.i18n === 'object') {
                  const i18n = obj.i18n as Record<string, { text_formulas?: string[] }>;
                  const localized = i18n[lang] ?? i18n[Object.keys(i18n)[0]];
                  textFormulas = localized?.text_formulas;
                }
                if (!textFormulas) {
                  const localized = (obj as Record<string, { text_formulas?: string[] }>)[lang]
                    ?? (obj as Record<string, { text_formulas?: string[] }>)[Object.keys(obj)[0]];
                  if (localized?.text_formulas) {
                    textFormulas = localized.text_formulas;
                  }
                }
              }

              const formulaLines: string[] = [];
              if (textFormulas && row) {
                for (let i = 0; i < sets.length; i++) {
                  const formula = textFormulas[i];
                  if (formula) {
                    formulaLines.push(resolveTextFormula(formula, row));
                  }
                }
              }

              const totalLines = 1 + formulaLines.length;
              const lineHeight = 14;
              const startY = y - ((totalLines - 1) / 2) * lineHeight;
              const isFirst = payload.index === 0;
              return (
                <g>
                  {isFirst && title && (
                    <text
                      x={4}
                      y={startY}
                      fontSize={12}
                      fontWeight={600}
                      fill="var(--text-primary)"
                      textAnchor="start"
                      dominantBaseline="central"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {title}
                    </text>
                  )}
                  <text
                    x={x - 4}
                    y={startY}
                    fontSize={12}
                    fontWeight={600}
                    fill="var(--text-primary)"
                    textAnchor="end"
                    dominantBaseline="central"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {category}
                  </text>
                  {formulaLines.map((line, li) => (
                    <text
                      key={li}
                      x={x - 4}
                      y={startY + (li + 1) * lineHeight}
                      fontSize={11}
                      fill="var(--text-secondary)"
                      textAnchor="end"
                      dominantBaseline="central"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {line}
                    </text>
                  ))}
                </g>
              );
            }}
            axisLine={false}
            tickLine={false}
            width={200}
          />
          {xAxes.map((axis) => (
            <XAxis
              key={axis.id}
              xAxisId={axis.id}
              type="number"
              hide
            />
          ))}
          {sets.map((set, i) => {
            const isStatic = typeof set.color === 'string';
            return (
              <Bar
                key={set.value_field}
                xAxisId={xAxes[i].id}
                dataKey={set.value_field}
                fill={isStatic ? (set.color as string) : (set.color as ColorConfig).values[0]}
                radius={0}
                barSize={18}
              >
                {!isStatic && rawData.map((row, j) => (
                  <Cell
                    key={j}
                    fill={evaluateColorFormula(set.color as ColorConfig, row)}
                  />
                ))}
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
      {activeIndex != null && data[activeIndex] && (
        <div
          className="vbar-tooltip-pinned"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <CustomTooltip
            payload={[{ payload: data[activeIndex] }]}
            tooltipFields={tooltipFields}
          />
        </div>
      )}
    </div>
  );
}

export function VerticalBar({
  widgetConfig,
  dataGroup,
  data,
}: {
  widgetConfig: VerticalBarConfig;
  dataGroup: { field_config?: Record<string, FieldConfig> };
  data: JSONRecord[];
}) {
  const lang = getLanguage();
  const { sets, vertical_axis, tooltip, group_by } = widgetConfig;

  const tooltipFields = useMemo(
    () => buildMergedFields(dataGroup.field_config, tooltip?.field_config, lang),
    [dataGroup.field_config, tooltip?.field_config, lang],
  );

  // Group data by group_by field, resolve i18n on group key
  const resolvedGroups = useMemo(() => {
    if (!group_by) {
      return [{
        key: '',
        rawData: data,
        chartData: data.map(row => {
          const resolved: JSONRecord = { ...row };
          resolved[vertical_axis.field] = resolveI18n(row[vertical_axis.field], lang);
          return resolved;
        }),
      }];
    }
    const map = new Map<string, { title: string; rows: JSONRecord[] }>();
    for (const row of data) {
      const rawVal = row[group_by];
      const title = resolveI18n(rawVal, lang);
      const groupKey = title || String(rawVal ?? '');
      if (!map.has(groupKey)) map.set(groupKey, { title, rows: [] });
      map.get(groupKey)!.rows.push(row);
    }
    return Array.from(map, ([, g]) => ({
      key: g.title,
      rawData: g.rows,
      chartData: g.rows.map(row => {
        const resolved: JSONRecord = { ...row };
        resolved[vertical_axis.field] = resolveI18n(row[vertical_axis.field], lang);
        return resolved;
      }),
    }));
  }, [data, group_by, vertical_axis.field, lang]);

  return (
    <div className={`vbar-widget${group_by ? ' vbar-grouped' : ''}`}>
      {resolvedGroups.map(g => (
        <VerticalBarChart
          key={g.key}
          sets={sets}
          vertical_axis={vertical_axis}
          tooltipFields={tooltipFields}
          data={g.chartData}
          rawData={g.rawData}
          title={group_by ? g.key : undefined}
        />
      ))}
    </div>
  );
}
