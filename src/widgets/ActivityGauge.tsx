import { memo, useCallback, useMemo, useState } from 'react';
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from 'recharts';
import type { DataGroup, FieldConfig } from '@s-flex/xfw-ui';
import type { JSONRecord, JSONValue } from '@s-flex/xfw-data';
import { useQueryParams } from '@s-flex/xfw-url';
import { getLanguage } from 'xfw-get-block';
import { resolve } from './resolve';
import { formatValue, localizeI18n, resolveI18nLabel } from './flow/utils';
import { Field } from '../controls/Field';
import { FieldTooltip, type TooltipConfig, type TooltipFieldConfigEntry } from '../controls/FieldTooltip';
import { DataGroupHeaderNavs } from '../controls/DataGroupHeaderNavs';
import {
  ColumnGridPagerControls,
  useColumnGridPager,
  type ColumnGridPager,
} from './useColumnGridPager';

type ActivityGaugeSeries = {
  value_field: string;
  domain_max?: number;
  colors?: string | string[] | Record<string, string>;
};

type ActivityGaugeMode = {
  i18n?: Record<string, Record<string, string>>;
  gauge_title_field?: string;
  color_index_field?: string;
  series: ActivityGaugeSeries[];
};

export type ActivityGaugeConfig = {
  group_by?: string;
  title_field?: string;
  gauge_label_field?: string;
  mode_param?: string;
  column_min_width?: string | number;
  column_max_width?: string | number;
  modes: ActivityGaugeMode[];
  tooltip?: TooltipConfig;
};

type Ring = {
  series: ActivityGaugeSeries;
  value: number;
  domainMax: number;
  color: string;
  label: string;
};

type FieldInput = Parameters<typeof Field>[0]['field'];

function cssSize(v: string | number | undefined, fallback: string): string {
  if (v == null) return fallback;
  if (typeof v === 'number') return `${v}px`;
  return v;
}

function scalarOf(val: JSONValue, lang: string): string {
  if (val == null) return '';
  if (typeof val !== 'object') return String(val);
  if (Array.isArray(val)) return '';
  const obj = val as Record<string, unknown>;
  if (typeof obj.code === 'string') return obj.code;
  if (typeof obj.id === 'string' || typeof obj.id === 'number') return String(obj.id);
  return localizeI18n(obj, lang) ?? '';
}

function readUi(fc: FieldConfig | undefined): Record<string, unknown> | undefined {
  return fc?.ui as Record<string, unknown> | undefined;
}

function readControl(fc: FieldConfig | undefined): string | undefined {
  const ui = readUi(fc);
  return (ui?.control as string | undefined) ?? (ui?.type as string | undefined);
}

function resolveColor(
  series: ActivityGaugeSeries,
  row: JSONRecord,
  colorIndexField: string | undefined,
  fallback: string,
): string {
  if (typeof series.colors === 'string') return series.colors;
  if (!series.colors) return fallback;
  const indexRaw = colorIndexField ? resolve(row, colorIndexField) : undefined;
  if (indexRaw == null) return fallback;
  if (Array.isArray(series.colors)) {
    const i = Number(indexRaw);
    return Number.isInteger(i) && i >= 0 && i < series.colors.length
      ? series.colors[i]
      : fallback;
  }
  return series.colors[String(indexRaw)] ?? fallback;
}

// Wrapped in React.memo because recharts' internal `SetAngleAxisSettings`
// component has a useMemo whose deps include the entire `props` object —
// React passes a new props ref every render, so SetAngleAxisSettings
// re-dispatches `addAngleAxis` to its redux store on every render, which
// re-renders us, which re-dispatches… infinite loop. Memoising Gauge breaks
// the cycle: when our props are stable, recharts isn't called at all.
const Gauge = memo(function GaugeImpl({
  rings,
  centerTitle,
  row,
  onHover,
  onLeave,
}: {
  rings: Ring[];
  centerTitle: string;
  row: JSONRecord;
  onHover: (row: JSONRecord, x: number, y: number) => void;
  onLeave: () => void;
}) {
  // Recharts places the first data entry innermost, so reverse to land
  // series[0] on the outer ring and series[last] innermost.
  const data = useMemo(
    () => [...rings].reverse().map(r => ({ name: r.label, value: r.value, fill: r.color })),
    [rings],
  );
  const domain = useMemo<[number, number]>(
    () => [0, Math.max(100, ...rings.map(r => r.domainMax))],
    [rings],
  );
  // Recharts dispatches axis/chart settings into its internal redux store on
  // every prop reference change. Inline `{}` / `[]` literals create new refs
  // each render and feed an infinite settings-update loop in PolarAngleAxis
  // and RadialBar's background. Memoise these.
  const radialBackground = useMemo(() => ({ fill: 'var(--border)' }), []);

  return (
    <div
      className="activity-gauge-chart"
      onMouseEnter={e => onHover(row, e.clientX, e.clientY)}
      onMouseLeave={onLeave}
    >
      <ResponsiveContainer width="100%" height={140}>
        <RadialBarChart
          data={data}
          innerRadius={28}
          outerRadius={62}
          startAngle={90}
          endAngle={450}
          margin={CHART_MARGIN}
        >
          <PolarAngleAxis tick={false} domain={domain} type="number" />
          <RadialBar
            isAnimationActive={false}
            dataKey="value"
            cornerRadius={99}
            background={radialBackground}
          />
          {centerTitle && (
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="central"
              className="activity-gauge-title"
            >
              {centerTitle}
            </text>
          )}
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
});

const CHART_MARGIN = { top: 0, right: 0, bottom: 0, left: 0 } as const;

function GaugeLegend({
  rings,
  fieldConfig,
}: {
  rings: Ring[];
  fieldConfig?: Record<string, FieldConfig>;
}) {
  return (
    <div className="activity-gauge-legend">
      {rings.map(r => {
        const ui = readUi(fieldConfig?.[r.series.value_field]);
        const isPct = ui?.type === 'percent' || ui?.control === 'percent';
        const scale = ui?.scale as number | undefined;
        const display = formatValue(r.value, isPct ? 'percent' : undefined, scale);
        return (
          <div key={r.series.value_field} className="activity-gauge-legend-row">
            <span className="activity-gauge-legend-dot" style={{ background: r.color }} />
            <span className="activity-gauge-legend-label">{r.label}</span>
            <span className="activity-gauge-legend-value">{display}</span>
          </div>
        );
      })}
    </div>
  );
}

function GaugeCell({
  row,
  rings,
  centerTitle,
  labelField,
  fieldConfig,
  onHover,
  onLeave,
}: {
  row: JSONRecord;
  rings: Ring[];
  centerTitle: string;
  labelField?: string;
  fieldConfig?: Record<string, FieldConfig>;
  onHover: (row: JSONRecord, x: number, y: number) => void;
  onLeave: () => void;
}) {
  const labelValue = labelField ? resolve(row, labelField) as JSONValue : null;
  const labelFc = labelField ? fieldConfig?.[labelField] : undefined;
  const labelUi = readUi(labelFc);
  // `field_config[labelField].ui.nav_field` makes the per-cell label
  // (e.g. sitrep's "Vertraagd / Vandaag / Morgen / Overmorgen") clickable —
  // Field resolves `row[nav_field]` to a NavItem and wraps the value in a
  // button.
  const labelNavField = (labelUi as Record<string, unknown> | undefined)?.nav_field as string | undefined;

  return (
    <div className="activity-gauge-cell">
      {labelField && labelValue != null && (
        <div className="activity-gauge-cell-label">
          <Field
            field={{
              key: labelField,
              control: readControl(labelFc),
              i18n: labelUi?.i18n as Record<string, Record<string, string>> | undefined,
              no_label: true,
              nav_field: labelNavField,
            } as FieldInput}
            value={labelValue}
            row={row}
          />
        </div>
      )}
      <Gauge rings={rings} row={row} centerTitle={centerTitle} onHover={onHover} onLeave={onLeave} />
      <GaugeLegend rings={rings} fieldConfig={fieldConfig} />
    </div>
  );
}

type ColumnProps = {
  titleField?: string;
  labelField?: string;
  fieldConfig?: Record<string, FieldConfig>;
  rows: JSONRecord[];
  mode: ActivityGaugeMode;
  lang: string;
  style?: React.CSSProperties;
  onHover: (row: JSONRecord, x: number, y: number) => void;
  onLeave: () => void;
  pager?: ColumnGridPager;
  fallbackTitle?: string;
  /** Renders `data_group.header.navs` (tabstrip) inside the column-title.
   *  Passed to every column so the tabstrip stays visible on each page when
   *  the grid is in narrow scroll-snap mode. */
  headerNavs?: Parameters<typeof DataGroupHeaderNavs>[0]['navs'];
};

function Column({
  titleField,
  labelField,
  fieldConfig,
  rows,
  mode,
  lang,
  style,
  onHover,
  onLeave,
  pager,
  fallbackTitle,
  headerNavs,
}: ColumnProps) {
  const headerRow = rows[0];
  const headerField = titleField ? fieldConfig?.[titleField] : undefined;
  const headerUi = readUi(headerField);
  const headerValue = titleField && headerRow ? resolve(headerRow, titleField) as JSONValue : null;
  const gaugeTitleField = mode.gauge_title_field;
  const centerField = gaugeTitleField ? fieldConfig?.[gaugeTitleField] : undefined;
  // `field_config[titleField].ui.nav_field` makes the column title clickable.
  // The string is the name of a sibling row column whose value is a NavItem;
  // Field renders the title as a button when both are present.
  const titleNavField = (headerUi as Record<string, unknown> | undefined)?.nav_field as string | undefined;

  // Series labels are stable per field-config / mode and don't depend on rows,
  // so resolving them once per render cycle (outside the row loop) avoids
  // re-walking i18n per period.
  const seriesLabels = useMemo(
    () => mode.series.map(s => resolveI18nLabel(readUi(fieldConfig?.[s.value_field])?.i18n, s.value_field)),
    [mode, fieldConfig],
  );

  const cells = useMemo(() => {
    const colorIndexField = mode.color_index_field?.trim();
    const out: { row: JSONRecord; rings: Ring[]; centerTitle: string }[] = [];
    for (const row of rows) {
      const rings: Ring[] = [];
      mode.series.forEach((s, i) => {
        const raw = resolve(row, s.value_field);
        if (raw == null) return;
        const value = Number(raw);
        if (!isFinite(value) || value === 0) return;
        rings.push({
          series: s,
          value,
          domainMax: s.domain_max ?? 100,
          color: resolveColor(s, row, colorIndexField, 'var(--brand)'),
          label: seriesLabels[i],
        });
      });
      // Keep the cell even when every series is zero/null — otherwise an
      // empty bucket (e.g. "overdue" with no orders) would silently drop
      // out and the user would see 3 circles instead of the expected 4.
      const centerValue = gaugeTitleField ? resolve(row, gaugeTitleField) as JSONValue : null;
      const centerTitle = centerValue == null
        ? ''
        : formatValue(centerValue, readControl(centerField), readUi(centerField)?.scale as number | undefined);
      out.push({ row, rings, centerTitle });
    }
    return out;
  }, [rows, mode, seriesLabels, gaugeTitleField, centerField]);

  if (cells.length === 0) return null;

  return (
    <div className="column-grid-column" style={style}>
      <div className="column-grid-column-body">
        <div className="activity-gauge-cells">
          <div className="activity-gauge-column-title">
            <div className="activity-gauge-title-group">
              {titleField && headerValue != null ? (
                <Field
                  field={{
                    key: titleField,
                    control: readControl(headerField),
                    i18n: headerUi?.i18n as Record<string, Record<string, string>> | undefined,
                    no_label: true,
                    nav_field: titleNavField,
                  } as FieldInput}
                  value={headerValue}
                  row={headerRow}
                />
              ) : (
                <span>{fallbackTitle}</span>
              )}
              {headerNavs && <DataGroupHeaderNavs navs={headerNavs} />}
            </div>
            {pager && <ColumnGridPagerControls pager={pager} />}
          </div>
          <div className="activity-gauge-cells-row">
            {cells.map((c, idx) => (
              <GaugeCell
                key={idx}
                row={c.row}
                rings={c.rings}
                centerTitle={c.centerTitle}
                labelField={labelField}
                fieldConfig={fieldConfig}
                onHover={onHover}
                onLeave={onLeave}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActivityGauge({
  widgetConfig,
  dataGroup,
  data,
}: {
  widgetConfig: ActivityGaugeConfig;
  dataGroup?: DataGroup;
  data: JSONRecord[];
}) {
  const {
    group_by,
    title_field,
    gauge_label_field,
    mode_param,
    column_min_width,
    column_max_width,
    modes,
    tooltip,
  } = widgetConfig;

  const fieldConfig = dataGroup?.field_config as Record<string, FieldConfig> | undefined;
  const lang = getLanguage();
  const headerNavs = ((dataGroup as Record<string, unknown> | undefined)?.header as
    { navs?: Parameters<typeof DataGroupHeaderNavs>[0]['navs'] } | undefined)?.navs;

  const resolvedLabelField = useMemo(() => {
    if (gauge_label_field) return gauge_label_field;
    if (!fieldConfig) return undefined;
    const candidates = Object.entries(fieldConfig)
      .filter(([key, fc]) => key !== title_field && readUi(fc)?.control === 'i18n-text')
      .sort(([, a], [, b]) => {
        const oa = (readUi(a)?.order as number | undefined) ?? 999;
        const ob = (readUi(b)?.order as number | undefined) ?? 999;
        return oa - ob;
      });
    return candidates[0]?.[0];
  }, [gauge_label_field, fieldConfig, title_field]);

  const modeParams = useQueryParams(
    mode_param ? [{ key: mode_param, is_query_param: true, is_optional: true }] : [],
  );
  const modeIndex = useMemo(() => {
    if (!mode_param || !modes || modes.length === 0) return 0;
    const raw = modeParams.find(p => p.key === mode_param)?.val;
    const n = Number(raw ?? 0);
    if (!isFinite(n)) return 0;
    return Math.max(0, Math.min(modes.length - 1, Math.floor(n)));
  }, [modeParams, mode_param, modes]);

  const activeMode = modes?.[modeIndex];
  const [hover, setHover] = useState<{ row: JSONRecord; x: number; y: number } | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; rows: JSONRecord[] }>();
    if (group_by) {
      for (const row of data) {
        const key = scalarOf(resolve(row, group_by), lang);
        if (!map.has(key)) map.set(key, { key, rows: [] });
        map.get(key)!.rows.push(row);
      }
    } else {
      map.set('_all', { key: '_all', rows: data });
    }
    return Array.from(map.values());
  }, [data, group_by, lang]);

  const minWidthPx = useMemo(() => {
    if (typeof column_min_width === 'number') return column_min_width;
    if (typeof column_min_width === 'string') {
      const n = parseFloat(column_min_width);
      if (isFinite(n)) return n;
    }
    return 320;
  }, [column_min_width]);

  const { gridRef, pager, handleScroll, isNarrow } = useColumnGridPager(groups.length, minWidthPx);

  const onHover = useCallback((row: JSONRecord, x: number, y: number) => {
    setHover({ row, x, y });
  }, []);
  const onLeave = useCallback(() => setHover(null), []);

  const gridStyle = useMemo(() => ({
    '--column-min-width': cssSize(column_min_width, '320px'),
    ...(column_max_width != null ? { '--column-max-width': cssSize(column_max_width, 'none') } : {}),
  }) as React.CSSProperties, [column_min_width, column_max_width]);

  const columnStyle = useMemo<React.CSSProperties>(
    () => (column_max_width != null ? { maxWidth: cssSize(column_max_width, 'none') } : {}),
    [column_max_width],
  );

  if (!data || data.length === 0 || !activeMode) return null;

  return (
    <>
      <div
        ref={gridRef}
        className={`column-grid${isNarrow ? ' is-narrow' : ''}`}
        style={gridStyle}
        onScroll={handleScroll}
      >
        {groups.map((g) => (
          <Column
            key={g.key}
            titleField={title_field}
            labelField={resolvedLabelField}
            fieldConfig={fieldConfig}
            rows={g.rows}
            mode={activeMode}
            lang={lang}
            style={columnStyle}
            onHover={onHover}
            onLeave={onLeave}
            pager={pager}
            fallbackTitle={g.key}
            headerNavs={headerNavs}
          />
        ))}
      </div>
      <FieldTooltip
        row={hover?.row ?? null}
        x={hover?.x ?? 0}
        y={hover?.y ?? 0}
        fieldConfig={fieldConfig as Record<string, TooltipFieldConfigEntry> | undefined}
        tooltipConfig={tooltip}
        titleField={title_field}
      />
    </>
  );
}
