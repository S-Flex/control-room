import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import type { JSONRecord, JSONValue } from '@s-flex/xfw-data';
import type { FieldConfig } from '@s-flex/xfw-ui';
import { getLanguage } from 'xfw-get-block';

// Recharts dispatches axis/chart settings into its internal redux store on
// every prop reference change. Inline `{}` / `[]` literals create new refs
// each render and feed an infinite settings-update loop. Keep these at module
// scope so every BarChart instance shares the same reference.
const BAR_CHART_MARGIN = { top: 8, right: 8, bottom: 8, left: 8 } as const;
const X_AXIS_TICK = { fill: '#ffffff', fontSize: 12 } as const;
const X_AXIS_LINE = { stroke: 'rgba(255,255,255,0.2)' } as const;

type I18n = Record<string, Record<string, string>>;
type FieldUI = {
  i18n?: I18n;
  order?: number;
  control?: string;
  type?: string;
  scale?: number;
  hidden?: boolean;
  hidden_when?: unknown;
  class_name?: string;
};
type TooltipFieldConfigEntry = { ui?: FieldUI; type?: string; formula?: string };

type ComputedKeyConfig = {
  template: string;
  suffix_when?: { key: string; op: string; value: JSONValue; suffix: string };
};

type TooltipGroup = {
  title?: { i18n?: I18n; title?: string };
  fields: Record<string, TooltipFieldConfigEntry>;
};

type StackedBarTooltip = {
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  field_config?: {
    class_name?: string;
    groups?: TooltipGroup[];
    /** Flat shape: same as a single group with no title. */
    fields?: Record<string, TooltipFieldConfigEntry>;
  };
};

export type StackedBarConfig = {
  x_key: string;
  y_key: string;
  name_key: string;
  computed_key?: ComputedKeyConfig;
  group_by_key?: string;
  stacked?: boolean;
  show_legend?: boolean;
  show_grid?: boolean;
  height?: number;
  color_palette?: string[];
  tooltip?: StackedBarTooltip;
};

// Palette inspired by the Planning/Status timeline tooltip — teal-greens,
// amber, violet, with a few accent hues to keep many stacks distinguishable.
const DEFAULT_PALETTE = [
  '#22c39a', // teal-green (primary status)
  '#16a34a', // green
  '#eab308', // amber
  '#7c5cff', // violet
  '#15803d', // dark green
  '#facc15', // yellow
  '#a78bfa', // light violet
  '#0ea5e9', // sky
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#84cc16', // lime
  '#6366f1', // indigo
  '#ef4444', // red
];

const LANGS = new Set(['nl', 'en', 'de', 'fr', 'uk', 'es']);

function isI18n(val: unknown): val is I18n {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const keys = Object.keys(val as Record<string, unknown>);
  return keys.length > 0 && keys.every(k => LANGS.has(k));
}

function resolveI18nText(val: unknown, lang: string): string {
  if (isI18n(val)) {
    const localized = val[lang] ?? val[Object.keys(val)[0]];
    return localized?.title ?? localized?.text ?? '';
  }
  return val == null ? '' : String(val);
}

function getLabel(
  key: string,
  fc: { ui?: { i18n?: I18n } } | undefined,
  lang: string,
): string {
  const title = fc?.ui?.i18n?.[lang]?.title;
  if (title) return title;
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function evaluateSuffix(
  cfg: ComputedKeyConfig['suffix_when'],
  row: JSONRecord,
): string {
  if (!cfg) return '';
  const lhs = row[cfg.key];
  const rhs = cfg.value;
  let match = false;
  switch (cfg.op) {
    case '==': match = String(lhs) === String(rhs); break;
    case '!=': match = String(lhs) !== String(rhs); break;
    case '>':  match = Number(lhs) > Number(rhs); break;
    case '<':  match = Number(lhs) < Number(rhs); break;
    case '>=': match = Number(lhs) >= Number(rhs); break;
    case '<=': match = Number(lhs) <= Number(rhs); break;
  }
  return match ? cfg.suffix : '';
}

function applyTemplate(template: string, row: JSONRecord): string {
  // Supports both `${var}` and `{var}` placeholders.
  return template
    .replace(/\$\{(\w+)\}/g, (_, k) => {
      const v = row[k];
      if (v == null) return '';
      const n = Number(v);
      return !isNaN(n) && typeof v !== 'boolean' ? String(n) : String(v);
    })
    .replace(/\{(\w+)\}/g, (_, k) => {
      const v = row[k];
      return v == null ? '' : String(v);
    });
}

function computeKey(row: JSONRecord, cfg: ComputedKeyConfig | undefined, fallbackKey: string): string {
  if (!cfg) {
    const v = row[fallbackKey];
    return v == null ? '' : String(v);
  }
  const base = applyTemplate(cfg.template, row);
  return base + evaluateSuffix(cfg.suffix_when, row);
}

function formatValue(val: unknown, ui: FieldUI | undefined): string {
  if (val == null) return '—';
  const control = ui?.control ?? ui?.type;
  const scale = ui?.scale;
  if (control === 'percent') {
    const n = Number(val);
    if (!isNaN(n)) return `${Math.round(n)}%`;
  }
  if (control === 'date') {
    const d = new Date(val as string | number);
    if (!isNaN(d.getTime())) return d.toLocaleDateString();
  }
  if (typeof scale === 'number') {
    const n = Number(val);
    if (!isNaN(n)) return n.toFixed(scale);
  }
  return String(val);
}

function pickColor(idx: number, palette: string[]): string {
  return palette[idx % palette.length];
}

type Stack = { key: string; label: string; color: string; rows: JSONRecord[] };

function buildPivot(
  rows: JSONRecord[],
  cfg: StackedBarConfig,
  palette: string[],
): { chartData: JSONRecord[]; stacks: Stack[] } {
  const stackOrder: string[] = [];
  const stackRows = new Map<string, JSONRecord[]>();
  const xValues: string[] = [];
  const xSeen = new Set<string>();
  const cellValues = new Map<string, Map<string, number>>(); // x -> stackKey -> value

  for (const row of rows) {
    const xRaw = row[cfg.x_key];
    const x = xRaw == null ? '' : String(xRaw);
    if (!xSeen.has(x)) { xSeen.add(x); xValues.push(x); }

    const stackKey = computeKey(row, cfg.computed_key, cfg.name_key);
    if (!stackRows.has(stackKey)) {
      stackRows.set(stackKey, []);
      stackOrder.push(stackKey);
    }
    stackRows.get(stackKey)!.push(row);

    const yVal = Number(row[cfg.y_key]);
    if (!isNaN(yVal)) {
      let m = cellValues.get(x);
      if (!m) { m = new Map(); cellValues.set(x, m); }
      m.set(stackKey, (m.get(stackKey) ?? 0) + yVal);
    }
  }

  xValues.sort();

  const chartData: JSONRecord[] = xValues.map(x => {
    const out: JSONRecord = { [cfg.x_key]: x };
    const cells = cellValues.get(x);
    for (const k of stackOrder) {
      out[k] = cells?.get(k) ?? 0;
    }
    return out;
  });

  const stacks: Stack[] = stackOrder.map((key, i) => ({
    key,
    label: key,
    color: pickColor(i, palette),
    rows: stackRows.get(key) ?? [],
  }));

  return { chartData, stacks };
}

function CustomTooltip({
  payload,
  label,
  cfg,
  fieldConfig,
  lang,
  stacks,
}: {
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  cfg: StackedBarConfig;
  fieldConfig?: Record<string, FieldConfig>;
  lang: string;
  stacks: Stack[];
}) {
  if (!payload || payload.length === 0) return null;

  // Group payload by stack key + sort
  let entries = payload
    .map(p => {
      const stack = stacks.find(s => s.key === p.dataKey);
      const sourceRow = stack?.rows.find(r => String(r[cfg.x_key]) === String(label));
      return { stack, color: p.color, value: p.value, row: sourceRow };
    })
    .filter(e => e.stack && e.value > 0);

  const sortBy = cfg.tooltip?.sort_by ?? cfg.y_key;
  const sortOrder = cfg.tooltip?.sort_order ?? 'desc';
  entries.sort((a, b) => {
    const av = Number(a.row?.[sortBy] ?? a.value ?? 0);
    const bv = Number(b.row?.[sortBy] ?? b.value ?? 0);
    return sortOrder === 'asc' ? av - bv : bv - av;
  });

  const tooltipFc = cfg.tooltip?.field_config;
  const wrapperClass = `stacked-bar-tooltip${tooltipFc?.class_name ? ` ${tooltipFc.class_name}` : ''}`;
  const groups: TooltipGroup[] = tooltipFc?.groups
    ?? (tooltipFc?.fields ? [{ fields: tooltipFc.fields }] : []);

  return (
    <div className="stacked-bar-tooltip-card">
      <div className="stacked-bar-tooltip-title">{label}</div>
      <div className="stacked-bar-tooltip-entries">
        {entries.map((e, i) => {
          if (!e.stack) return null;
          const row = e.row ?? ({} as JSONRecord);
          return (
            <div key={i} className="stacked-bar-tooltip-entry">
              <div className="stacked-bar-tooltip-entry-header">
                <span className="stacked-bar-tooltip-swatch" style={{ background: e.color }} />
                <span className="stacked-bar-tooltip-entry-label">{e.stack.label}</span>
              </div>
              <div className={wrapperClass}>
                {groups.map((g, gi) => {
                  const sortedFields = Object.entries(g.fields).sort(([, a], [, b]) =>
                    (a.ui?.order ?? 999) - (b.ui?.order ?? 999),
                  );
                  return (
                    <div key={gi} className="stacked-bar-tooltip-group">
                      {g.title && (
                        <div className="stacked-bar-tooltip-group-title col-span-6">
                          {resolveI18nText(g.title.i18n, lang) || g.title.title || ''}
                        </div>
                      )}
                      {sortedFields.map(([fkey, fcfg]) => {
                        const baseFc = fieldConfig?.[fkey] as TooltipFieldConfigEntry | undefined;
                        const ui: FieldUI = { ...(baseFc?.ui ?? {}), ...(fcfg.ui ?? {}) };
                        const label = getLabel(fkey, { ui }, lang);
                        const val = row[fkey];
                        const cls = fcfg.ui?.class_name ?? '';
                        return (
                          <div key={fkey} className={`stacked-bar-tooltip-cell ${cls}`}>
                            <div className="stacked-bar-tooltip-cell-label">{label}</div>
                            <div className="stacked-bar-tooltip-cell-value">{formatValue(val, ui)}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StackedBarChart({
  cfg,
  rows,
  fieldConfig,
  title,
}: {
  cfg: StackedBarConfig;
  rows: JSONRecord[];
  fieldConfig?: Record<string, FieldConfig>;
  title?: string;
}) {
  const lang = getLanguage();
  const palette = cfg.color_palette ?? DEFAULT_PALETTE;
  const { chartData, stacks } = useMemo(() => buildPivot(rows, cfg, palette), [rows, cfg, palette]);
  const [hover, setHover] = useState<{ x: number; y: number; payload: any[]; label: string } | null>(null);

  // The recharts BarChart auto-scales the Y axis to the max bar height plus a
  // bit of headroom — so bars that sum to the expected total still don't quite
  // reach the top. We compute the per-bar totals, detect the data scale (1.0
  // vs 100), and pin the Y axis explicitly below.
  const { yMax, breakdownLog } = useMemo(() => {
    let maxTotal = 0;
    const totals: number[] = [];
    const rowsBreakdown: Record<string, unknown>[] = [];
    for (const row of chartData) {
      let total = 0;
      const parts: Record<string, number> = {};
      for (const s of stacks) {
        const v = Number(row[s.key] ?? 0);
        parts[s.label] = v;
        total += v;
      }
      totals.push(total);
      if (total > maxTotal) maxTotal = total;
      rowsBreakdown.push({ [cfg.x_key]: row[cfg.x_key], total: Number(total.toFixed(4)), ...parts });
    }
    // Snap the expected total to whichever common "100%" scale the data is
    // closest to (1 for fractions, 100 for percent-points). Anything else
    // falls back to the observed maximum so the chart still renders sensibly.
    const expected = Math.abs(maxTotal - 1) < 0.05 ? 1
      : Math.abs(maxTotal - 100) < 1 ? 100
      : maxTotal;
    return { yMax: expected, breakdownLog: { rowsBreakdown, totals, expected } };
  }, [chartData, stacks, cfg.x_key]);

  useEffect(() => {
    if (breakdownLog.rowsBreakdown.length === 0) return;
    const tol = breakdownLog.expected * 0.005; // 0.5% relative tolerance
    const offBy = breakdownLog.rowsBreakdown.filter(b =>
      Math.abs((b.total as number) - breakdownLog.expected) > tol,
    );
    /* eslint-disable no-console */
    console.groupCollapsed(
      `[StackedBar] ${title ?? '(untitled)'} — ${breakdownLog.rowsBreakdown.length} bars, ${stacks.length} stacks (expected total ${breakdownLog.expected})`,
    );
    console.table(breakdownLog.rowsBreakdown);
    if (offBy.length > 0) {
      console.warn(`[StackedBar] ${offBy.length}/${breakdownLog.rowsBreakdown.length} bars off the expected ${breakdownLog.expected} total:`, offBy);
    }
    console.groupEnd();
    /* eslint-enable no-console */
  }, [breakdownLog, stacks.length, title]);

  const yDomain = useMemo<[number, number]>(() => [0, yMax], [yMax]);

  const stackId = cfg.stacked === false ? undefined : 'stack';
  const xLabel = useCallback((val: string) => {
    // Date strings → "D-M" (e.g. 2026-04-14 → "14-4"); leave non-dates alone.
    const d = new Date(val);
    if (!isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(val)) {
      return `${d.getDate()}-${d.getMonth() + 1}`;
    }
    return val;
  }, []);

  const chartHeight = cfg.height ?? 320;
  return (
    <div className="stacked-bar-chart">
      {title && <div className="stacked-bar-chart-title">{title}</div>}
      <div className="stacked-bar-chart-canvas" style={{ height: chartHeight }}>
        {/* `minWidth/minHeight={0}` silences the recharts "-1 width/-1 height"
            warning that fires when ResponsiveContainer measures before the
            parent has been laid out (common in flex / sidebar layouts on
            first paint). */}
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart
          data={chartData}
          margin={BAR_CHART_MARGIN}
          onMouseMove={(state: any) => {
            if (state?.activePayload && state.activeLabel != null && state.chartX != null) {
              setHover({
                x: state.chartX,
                y: state.chartY ?? 0,
                payload: state.activePayload,
                label: String(state.activeLabel),
              });
            }
          }}
          onMouseLeave={() => setHover(null)}
        >
          {cfg.show_grid !== false && <CartesianGrid stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" vertical={false} />}
          <XAxis
            dataKey={cfg.x_key}
            tickFormatter={xLabel}
            tick={X_AXIS_TICK}
            axisLine={X_AXIS_LINE}
            tickLine={false}
          />
          {/* Pinning the domain to the detected expected total (1 or 100)
              guarantees every bar reaches the top of the chart instead of
              recharts auto-extending the axis past the data max for headroom.
              `domain` MUST be a memoised reference — recharts dispatches axis
              settings into its internal redux store on every prop reference
              change, and inline `[0, yMax]` literals trigger an infinite
              dispatch loop. */}
          <YAxis hide domain={yDomain} allowDataOverflow={false} />
          {stacks.map(s => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId={stackId}
              fill={s.color}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
        </ResponsiveContainer>
      </div>
      {cfg.show_legend !== false && (
        <ul className="stacked-bar-legend">
          {stacks.map(s => (
            <li key={s.key} className="stacked-bar-legend-item">
              <span className="stacked-bar-legend-swatch" style={{ background: s.color }} />
              <span className="stacked-bar-legend-label">{s.label}</span>
            </li>
          ))}
        </ul>
      )}
      {hover && (
        <div
          className="stacked-bar-tooltip-pinned"
          style={{ left: hover.x, top: hover.y }}
        >
          <CustomTooltip
            payload={hover.payload}
            label={hover.label}
            cfg={cfg}
            fieldConfig={fieldConfig}
            lang={lang}
            stacks={stacks}
          />
        </div>
      )}
    </div>
  );
}

export function StackedBar({
  widgetConfig,
  dataGroup,
  data,
}: {
  widgetConfig: StackedBarConfig;
  dataGroup: { field_config?: Record<string, FieldConfig> };
  data: JSONRecord[];
}) {
  const lang = getLanguage();
  const groups = useMemo(() => {
    if (!widgetConfig.group_by_key) {
      return [{ key: '', title: '', rows: data }];
    }
    const map = new Map<string, { title: string; rows: JSONRecord[] }>();
    for (const row of data) {
      const raw = row[widgetConfig.group_by_key];
      const title = resolveI18nText(raw, lang) || (raw == null ? '' : String(raw));
      if (!map.has(title)) map.set(title, { title, rows: [] });
      map.get(title)!.rows.push(row);
    }
    return Array.from(map, ([key, g]) => ({ key, title: g.title, rows: g.rows }));
  }, [data, widgetConfig.group_by_key, lang]);

  return (
    <div className={`stacked-bar-widget${widgetConfig.group_by_key ? ' stacked-bar-grouped' : ''}`}>
      {groups.map(g => (
        <StackedBarChart
          key={g.key || 'all'}
          cfg={widgetConfig}
          rows={g.rows}
          fieldConfig={dataGroup.field_config}
          title={widgetConfig.group_by_key ? g.title : undefined}
        />
      ))}
    </div>
  );
}
