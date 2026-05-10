import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import type { JSONRecord } from '@s-flex/xfw-data';
import type { DataGroup, FieldConfig } from '@s-flex/xfw-ui';
import { getLanguage } from 'xfw-get-block';
import { localizeI18n } from './flow/utils';
import { resolve } from './resolve';
import {
  FieldTooltip,
  type TooltipConfig,
  type TooltipFieldConfigEntry,
} from '../controls/FieldTooltip';

// Recharts dispatches axis/chart settings into its internal redux store on
// every prop reference change. Inline `{}` / `[]` literals create new refs
// each render and feed an infinite settings-update loop. Module-scope these.
//
// All-zero margin: the YAxes already provide visual padding inside the
// SVG; extra outer margin just shrinks the bar area without buying us
// anything.
const CHART_MARGIN = { top: 4, right: 0, bottom: 0, left: 0 } as const;
const X_AXIS_TICK = { fill: 'rgba(255,255,255,0.6)', fontSize: 11 } as const;
const Y_AXIS_TICK = { fill: 'rgba(255,255,255,0.6)', fontSize: 11 } as const;
const AXIS_LINE = { stroke: 'rgba(255,255,255,0.18)' } as const;
const ZERO_TO_AUTO_DOMAIN: [0, 'auto'] = [0, 'auto'];
// recharts adds default left/right padding to the X axis so the first /
// last bars don't overlap the YAxes; with explicit barSize and the bars
// already centred in their slot, that padding is wasted whitespace.
const X_AXIS_PADDING = { left: 0, right: 0 } as const;
// recharts' default YAxis width is 60px each → 120px lost to dual axes
// on a narrow card. Reserve only what the tick labels actually need.
const Y_AXIS_WIDTH = 38;

type AxisFormat = 'compact-number' | 'percentage' | 'number';

type AxisConfig = {
  field?: string;
  format?: AxisFormat;
  decimals?: number;
  show_grid?: boolean;
  begin_at_zero?: boolean;
  max?: 'auto' | number;
};

type SeriesConfig = {
  axis: 'y_left' | 'y_right';
  type: 'bar' | 'line';
  color?: string;
  /** Per-row colour: name of a sibling field whose value is the colour. */
  color_field?: string;
  z_order?: number;
  /** Bar width as a fraction of the slot (e.g. 0.9 = wide, 0.45 = narrow). */
  bar_width?: number;
  value_field: string;
  // line-only
  style?: 'dotted' | 'dashed' | 'solid';
  tension?: number;
  point_radius?: number;
};

type LegendConfig = {
  position?: 'bottom' | 'top';
  alignment?: 'left' | 'center' | 'right';
};

type HeaderMetricConfig = {
  aggregation: 'latest' | 'sum' | 'avg' | 'max' | 'min';
  value_field: string;
  /** Dot-path on the latest row whose value is either an i18n object,
   *  a "block" (`{ color, i18n }`), or a plain string. The label is
   *  resolved via i18n; if the value is a block, its `color` is used to
   *  tint the trend label. */
  trend_field?: string;
};

export type ComboChartConfig = {
  axes: { x: AxisConfig; y_left?: AxisConfig; y_right?: AxisConfig };
  i18n?: Record<string, { title?: string; subtitle?: string }>;
  legend?: LegendConfig;
  series: SeriesConfig[];
  tooltip?: TooltipConfig;
  /** Underlying X-axis key (e.g. `r_week_start`). */
  key_field: string;
  /** Field whose value is plugged into `label_format` to produce the tick label. */
  label_field: string;
  /** Template like `"w${value}"` — `${value}` is replaced with `row[label_field]`. */
  label_format?: string;
  header_metric?: HeaderMetricConfig;
  height?: number;
};

// Compact number formatter that matches the screenshot ("4.5k" lowercase,
// "1k", "500"). Intl's compact notation gives "4.5K" uppercase, so we roll
// our own.
function compactFormat(val: number): string {
  if (val == null || isNaN(val)) return '';
  const abs = Math.abs(val);
  if (abs >= 1e9) return stripTrailingZero((val / 1e9).toFixed(1)) + 'b';
  if (abs >= 1e6) return stripTrailingZero((val / 1e6).toFixed(1)) + 'm';
  if (abs >= 1e3) return stripTrailingZero((val / 1e3).toFixed(1)) + 'k';
  return String(val);
}

function stripTrailingZero(s: string): string {
  return s.replace(/\.0$/, '');
}

function formatTick(val: unknown, axis: AxisConfig | undefined): string {
  const n = typeof val === 'number' ? val : Number(val);
  if (val == null || isNaN(n)) return '';
  const fmt = axis?.format;
  if (fmt === 'compact-number') return compactFormat(n);
  if (fmt === 'percentage') {
    const d = axis?.decimals ?? 0;
    // `parseFloat` + toFixed strips trailing zeros so "1.20%" → "1.2%".
    return parseFloat(n.toFixed(d)) + '%';
  }
  return String(n);
}

function aggregate(
  rows: JSONRecord[],
  field: string,
  agg: HeaderMetricConfig['aggregation'],
): number | string | null {
  if (rows.length === 0) return null;
  if (agg === 'latest') {
    const v = rows[rows.length - 1][field];
    return (typeof v === 'number' || typeof v === 'string') ? v : null;
  }
  const nums: number[] = [];
  for (const r of rows) {
    const n = Number(r[field]);
    if (!isNaN(n)) nums.push(n);
  }
  if (nums.length === 0) return null;
  switch (agg) {
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'avg': return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'max': return Math.max(...nums);
    case 'min': return Math.min(...nums);
    default: return null;
  }
}

function applyLabelFormat(template: string, value: unknown): string {
  // Accept both `{value}` (current syntax) and `${value}` (legacy).
  return template.replace(/\$?\{value\}/g, String(value ?? ''));
}

function pickStrokeDash(style?: string): string | undefined {
  switch (style) {
    case 'dotted': return '2 4';
    case 'dashed': return '6 4';
    default: return undefined;
  }
}

function axisYId(s: { axis: 'y_left' | 'y_right' }): 'left' | 'right' {
  return s.axis === 'y_right' ? 'right' : 'left';
}

// Floor / cap so a single-row chart doesn't render a full-width bar and a
// dense chart doesn't render a 1px sliver.
const MIN_SLOT_WIDTH = 24;
const MAX_SLOT_WIDTH = 120;
// Reserve a small fixed gap between categories so adjacent bars never
// touch — the configured `bar_width` is applied to (slot − this gap),
// not to the raw slot. Without this, a bar with bar_width=0.9 fills
// 90% of the slot and the wide bars from neighbouring categories end
// up almost flush.
const INTER_CATEGORY_GAP_PX = 14;

export function ComboChart({
  widgetConfig,
  dataGroup,
  data,
}: {
  widgetConfig: ComboChartConfig;
  dataGroup: DataGroup;
  data: JSONRecord[];
}) {
  const cfg = widgetConfig;
  const lang = getLanguage();
  const fieldConfig = dataGroup.field_config as Record<string, FieldConfig> | undefined;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [hover, setHover] = useState<{ row: JSONRecord; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => setCanvasWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const titleI18n = cfg.i18n?.[lang] ?? cfg.i18n?.[Object.keys(cfg.i18n ?? {})[0] ?? ''];
  const title = titleI18n?.title;
  const subtitle = titleI18n?.subtitle;

  const headerMetric = useMemo(() => {
    if (!cfg.header_metric || data.length === 0) return null;
    const hm = cfg.header_metric;
    const rawValue = aggregate(data, hm.value_field, hm.aggregation);
    const lastRow = data[data.length - 1];
    // `trend_field` may resolve to one of three shapes:
    //   1. A row-block:  `{ code, block: { i18n: {...} }, color, ... }`
    //                    (the convention used by `r_trend_block` —
    //                    matches data/languages.json, ui-labels.json).
    //   2. A bare block: `{ color?, i18n: {...} }`.
    //   3. A plain string.
    // The colour sits on the OUTER object; the localised title lives
    // inside `block.block.i18n` for shape 1, or `block.i18n` for 2.
    const trendVal = hm.trend_field ? resolve(lastRow, hm.trend_field) : undefined;
    let trendValueLabel: string | null = null;
    let trendColor: string | undefined;
    if (trendVal && typeof trendVal === 'object' && !Array.isArray(trendVal)) {
      const outer = trendVal as {
        color?: unknown;
        i18n?: unknown;
        title?: unknown;
        block?: { i18n?: unknown; title?: unknown } | unknown;
      };
      const innerBlock = outer.block && typeof outer.block === 'object' && !Array.isArray(outer.block)
        ? (outer.block as { i18n?: unknown; title?: unknown })
        : undefined;
      trendValueLabel = localizeI18n(innerBlock?.i18n ?? outer.i18n ?? outer, lang)
        ?? (typeof innerBlock?.title === 'string' ? innerBlock.title : null)
        ?? (typeof outer.title === 'string' ? outer.title : null);
      if (typeof outer.color === 'string') trendColor = outer.color;
    } else if (trendVal != null) {
      trendValueLabel = String(trendVal);
    }
    // Localised prefix ("Trend") comes from the field's i18n in
    // `field_config`. `trend_field` may be a dot path (e.g.
    // `r_trend_block.color`); the field-config key for a row-block is
    // typically the path to its inner i18n entry — `<root>.block.i18n` —
    // and only falls back to the root key when the data_group hasn't
    // declared the nested control.
    const rootKey = hm.trend_field?.split('.')[0];
    const candidateKeys = [
      hm.trend_field ? `${hm.trend_field}.block.i18n` : null,
      hm.trend_field ?? null,
      rootKey ?? null,
    ].filter((k): k is string => !!k);
    let trendFcI18n: Record<string, { title?: string }> | undefined;
    for (const key of candidateKeys) {
      const fc = fieldConfig?.[key];
      const i18n = (fc?.ui as { i18n?: Record<string, { title?: string }> } | undefined)?.i18n;
      if (i18n) { trendFcI18n = i18n; break; }
    }
    const trendFieldLabel = (trendFcI18n?.[lang] ?? trendFcI18n?.[Object.keys(trendFcI18n ?? {})[0] ?? ''])?.title;
    return {
      value: rawValue == null
        ? '—'
        : (typeof rawValue === 'number' ? compactFormat(rawValue) : String(rawValue)),
      trendValueLabel,
      trendFieldLabel,
      trendColor,
    };
  }, [data, cfg.header_metric, lang, fieldConfig]);

  // Pre-build a key → row map so the tick formatter and the mouse-move
  // handler don't do a linear scan of `data` on every fire.
  const rowByKey = useMemo(() => {
    const m = new Map<string, JSONRecord>();
    for (const r of data) m.set(String(r[cfg.key_field]), r);
    return m;
  }, [data, cfg.key_field]);

  const xTickFormatter = useCallback((value: unknown): string => {
    const row = rowByKey.get(String(value));
    if (!row) return String(value);
    const labelVal = row[cfg.label_field];
    return cfg.label_format
      ? applyLabelFormat(cfg.label_format, labelVal)
      : String(labelVal ?? '');
  }, [rowByKey, cfg.label_field, cfg.label_format]);

  const yLeftTickFormatter = useCallback(
    (v: unknown) => formatTick(v, cfg.axes.y_left),
    [cfg.axes.y_left],
  );
  const yRightTickFormatter = useCallback(
    (v: unknown) => formatTick(v, cfg.axes.y_right),
    [cfg.axes.y_right],
  );

  // Bars first (sorted by z_order ascending), then lines — so lines paint on
  // top of bars. Within bars, declaration order matters for the centred
  // overlay (wide bar must come first).
  const sortedSeries = useMemo(
    () => [...cfg.series].sort((a, b) => (a.z_order ?? 0) - (b.z_order ?? 0)),
    [cfg.series],
  );
  const barSeries = useMemo(() => sortedSeries.filter(s => s.type === 'bar'), [sortedSeries]);
  const lineSeries = useMemo(() => sortedSeries.filter(s => s.type === 'line'), [sortedSeries]);

  // Slot width = chart area / number of categories. Chart area =
  // wrapper width minus the YAxes recharts reserves on each side. Bars
  // scale with the chart this way; absolute pixel sizes left big empty
  // gaps when the chart was wide and few categories.
  const slotWidth = useMemo(() => {
    if (canvasWidth <= 0 || data.length === 0) return MIN_SLOT_WIDTH;
    const axesReserved =
      (cfg.axes.y_left ? Y_AXIS_WIDTH : 0) +
      (cfg.axes.y_right ? Y_AXIS_WIDTH : 0);
    const usable = Math.max(0, canvasWidth - axesReserved);
    const slot = usable / data.length;
    return Math.max(MIN_SLOT_WIDTH, Math.min(MAX_SLOT_WIDTH, slot));
  }, [canvasWidth, data.length, cfg.axes.y_left, cfg.axes.y_right]);

  const barSizes = useMemo(() => {
    const usableSlot = Math.max(2, slotWidth - INTER_CATEGORY_GAP_PX);
    return barSeries.map(s => Math.max(2, Math.round(usableSlot * (s.bar_width ?? 0.6))));
  }, [barSeries, slotWidth]);
  const barGap = useMemo(() => {
    if (barSizes.length !== 2) return 0;
    return -Math.round((barSizes[0] + barSizes[1]) / 2);
  }, [barSizes]);

  const onMouseMove = useCallback((state: { activeLabel?: unknown; chartX?: number; chartY?: number } | null) => {
    if (!state?.activeLabel) return;
    const row = rowByKey.get(String(state.activeLabel));
    if (!row) return;
    const rect = wrapperRef.current?.getBoundingClientRect();
    setHover({
      row,
      x: (rect?.left ?? 0) + (state.chartX ?? 0),
      y: (rect?.top ?? 0) + (state.chartY ?? 0),
    });
  }, [rowByKey]);

  const onMouseLeave = useCallback(() => setHover(null), []);

  // Resolve the visual colour for each series. Lines that have a
  // `color_field` defer to the latest row's value (via dot-path resolve,
  // so things like `r_trend_block.color` work) — same source the per-row
  // dots already use, so the line and its dots stay in sync.
  const seriesColor = useCallback((s: SeriesConfig): string => {
    if (s.color_field && data.length > 0) {
      const last = resolve(data[data.length - 1], s.color_field);
      if (typeof last === 'string' && last) return last;
    }
    return s.color ?? 'var(--brand)';
  }, [data]);

  const chartHeight = cfg.height ?? 280;
  const showGrid = cfg.axes.x?.show_grid !== false || cfg.axes.y_left?.show_grid !== false;

  const legendPos = cfg.legend?.position ?? 'bottom';
  const legendAlign = cfg.legend?.alignment ?? 'center';
  const legendNode = cfg.legend ? (
    <ul className={`combo-chart-legend combo-chart-legend-${legendAlign}`}>
      {sortedSeries.map(s => {
        const fc = fieldConfig?.[s.value_field];
        const ui = fc?.ui as { i18n?: Record<string, { title?: string }> } | undefined;
        const label = ui?.i18n?.[lang]?.title ?? s.value_field;
        const swatchColor = seriesColor(s);
        return (
          <li key={s.value_field} className="combo-chart-legend-item">
            {s.type === 'bar' ? (
              <span className="combo-chart-legend-swatch" style={{ background: swatchColor }} />
            ) : (
              <span
                className="combo-chart-legend-line"
                style={{
                  borderTopColor: swatchColor,
                  borderTopStyle: s.style === 'dashed' ? 'dashed' : 'dotted',
                }}
              />
            )}
            <span className="combo-chart-legend-label">{label}</span>
          </li>
        );
      })}
    </ul>
  ) : null;

  return (
    <div className="combo-chart-card" ref={wrapperRef}>
      <div className="combo-chart-header">
        {title && <div className="combo-chart-title">{title}</div>}
        {subtitle && <div className="combo-chart-subtitle">{subtitle}</div>}
      </div>
      {headerMetric && (
        <div className="combo-chart-metric-row">
          <span className="combo-chart-metric-value">{headerMetric.value}</span>
          {(headerMetric.trendFieldLabel || headerMetric.trendValueLabel) && (
            <span
              className="combo-chart-metric-trend"
              style={headerMetric.trendColor ? { color: headerMetric.trendColor } : undefined}
            >
              {headerMetric.trendFieldLabel && headerMetric.trendValueLabel
                ? `${headerMetric.trendFieldLabel}: ${headerMetric.trendValueLabel}`
                : (headerMetric.trendValueLabel ?? headerMetric.trendFieldLabel)}
            </span>
          )}
        </div>
      )}
      {legendPos === 'top' && legendNode}
      <div className="combo-chart-canvas" ref={canvasRef} style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <ComposedChart
            data={data}
            margin={CHART_MARGIN}
            barGap={barGap}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
          >
            {showGrid && (
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" vertical={false} />
            )}
            <XAxis
              dataKey={cfg.key_field}
              tick={X_AXIS_TICK}
              axisLine={AXIS_LINE}
              tickLine={false}
              tickFormatter={xTickFormatter}
              interval="preserveStartEnd"
              padding={X_AXIS_PADDING}
            />
            {cfg.axes.y_left && (
              <YAxis
                yAxisId="left"
                orientation="left"
                width={Y_AXIS_WIDTH}
                tick={Y_AXIS_TICK}
                axisLine={AXIS_LINE}
                tickLine={false}
                tickFormatter={yLeftTickFormatter}
                domain={cfg.axes.y_left.begin_at_zero !== false ? ZERO_TO_AUTO_DOMAIN : undefined}
              />
            )}
            {cfg.axes.y_right && (
              <YAxis
                yAxisId="right"
                orientation="right"
                width={Y_AXIS_WIDTH}
                tick={Y_AXIS_TICK}
                axisLine={AXIS_LINE}
                tickLine={false}
                tickFormatter={yRightTickFormatter}
                domain={cfg.axes.y_right.begin_at_zero !== false ? ZERO_TO_AUTO_DOMAIN : undefined}
              />
            )}
            {barSeries.map((s, i) => (
              <Bar
                key={s.value_field}
                yAxisId={axisYId(s)}
                dataKey={s.value_field}
                fill={s.color ?? 'var(--brand)'}
                barSize={barSizes[i]}
                isAnimationActive={false}
              />
            ))}
            {lineSeries.map(s => {
              const stroke = seriesColor(s);
              return (
                <Line
                  key={s.value_field}
                  yAxisId={axisYId(s)}
                  dataKey={s.value_field}
                  stroke={stroke}
                  strokeDasharray={pickStrokeDash(s.style)}
                  strokeWidth={2}
                  type={s.tension && s.tension > 0 ? 'monotone' : 'linear'}
                  dot={s.point_radius
                    ? (props: { cx?: number; cy?: number; payload?: JSONRecord }) => {
                        const cx = props.cx ?? 0;
                        const cy = props.cy ?? 0;
                        const fromRow = s.color_field && props.payload
                          ? resolve(props.payload, s.color_field)
                          : undefined;
                        const fill = (typeof fromRow === 'string' && fromRow) || stroke;
                        return <circle cx={cx} cy={cy} r={s.point_radius} fill={fill} stroke="none" />;
                      }
                    : false}
                  isAnimationActive={false}
                  connectNulls
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {legendPos === 'bottom' && legendNode}
      <FieldTooltip
        row={hover?.row ?? null}
        x={hover?.x ?? 0}
        y={hover?.y ?? 0}
        fieldConfig={fieldConfig as Record<string, TooltipFieldConfigEntry> | undefined}
        tooltipConfig={cfg.tooltip}
      />
    </div>
  );
}
