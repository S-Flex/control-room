import { useCallback, useMemo, useState } from 'react';
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
import { resolve, evaluateColorFormula } from './resolve';
import { Field } from '../controls/Field';
import { FieldTooltip, type TooltipFieldConfigEntry } from '../controls/FieldTooltip';
import { useColumnGridPager, type ColumnGridPager } from './useColumnGridPager';

type ColorConfig = { true: string; false: string };

type ActivityGaugeSeries = {
  value_field: string;
  domain_max?: number;
  colors?: string | ColorConfig;
};

type ActivityGaugeMode = {
  i18n?: Record<string, Record<string, string>>;
  /** Field path whose value renders as the center number. Either name accepted. */
  gauge_title?: string;
  gauge_title_field?: string;
  series: ActivityGaugeSeries[];
};

export type ActivityGaugeConfig = {
  group_by?: string;
  title_field?: string;
  gauge_label_field?: string;
  mode_param?: string;
  color_formula?: string;
  column_min_width?: string | number;
  column_max_width?: string | number;
  modes: ActivityGaugeMode[];
  tooltip?: { field_config?: Record<string, TooltipFieldConfigEntry> };
};

type Ring = {
  series: ActivityGaugeSeries;
  value: number;
  domainMax: number;
  color: string;
  label: string;
};

function cssSize(v: string | number | undefined, fallback: string): string {
  if (v == null) return fallback;
  if (typeof v === 'number') return `${v}px`;
  return v;
}

/** Produce a stable string key / display text from a value that may be a
 *  plain scalar, a `{code,...}` record, or an i18n object like
 *  `{nl:{title:"Plaat"}, en:{title:"Plate"}}`. Never returns "[object Object]". */
function stringifyValue(val: JSONValue, lang: string): string {
  if (val == null) return '';
  if (typeof val !== 'object') return String(val);
  if (Array.isArray(val)) return '';
  const obj = val as Record<string, unknown>;
  if (typeof obj.code === 'string') return obj.code;
  if (typeof obj.id === 'string' || typeof obj.id === 'number') return String(obj.id);
  const localized = obj[lang] ?? obj[Object.keys(obj)[0]];
  // Flat i18n: { nl: "Plaat", en: "Sheet" }
  if (typeof localized === 'string') return localized;
  // Nested i18n: { nl: { title: "Plaat" } }
  if (localized && typeof localized === 'object') {
    const inner = localized as Record<string, unknown>;
    const title = inner.title ?? inner.text;
    if (typeof title === 'string') return title;
  }
  return '';
}

function resolveFieldLabel(
  key: string,
  fieldConfig: Record<string, FieldConfig> | undefined,
  lang: string,
): string {
  const fc = fieldConfig?.[key];
  const i18n = (fc?.ui as Record<string, unknown> | undefined)?.i18n as
    Record<string, Record<string, string>> | undefined;
  return i18n?.[lang]?.title
    ?? i18n?.[Object.keys(i18n ?? {})[0]]?.title
    ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatCenter(value: JSONValue, field: FieldConfig | undefined): string {
  if (value == null) return '';
  const ui = field?.ui as Record<string, unknown> | undefined;
  const scale = ui?.scale as number | undefined;
  const num = Number(value);
  if (!isNaN(num) && isFinite(num)) {
    if (typeof scale === 'number') return num.toFixed(scale);
    return String(Math.round(num));
  }
  return String(value);
}

function resolveColor(
  series: ActivityGaugeSeries,
  row: JSONRecord,
  value: number,
  formula: string | undefined,
  fallback: string,
): string {
  if (typeof series.colors === 'string') return series.colors;
  if (!series.colors) return fallback;
  if (!formula) return series.colors.true;
  const picked = evaluateColorFormula(
    { values: [series.colors.false, series.colors.true], formula },
    row,
    { pct: value },
  );
  return picked ?? fallback;
}

function Gauge({
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
  // Recharts places the first data entry innermost; reverse so series[0] sits
  // on the outer ring and series[last] innermost.
  const data = [...rings].reverse().map(r => ({
    name: r.label,
    value: r.value,
    fill: r.color,
  }));
  const domainMax = Math.max(100, ...rings.map(r => r.domainMax));

  return (
    <div
      className="activity-gauge-chart"
      onMouseEnter={e => onHover(row, e.clientX, e.clientY)}
      onMouseMove={e => onHover(row, e.clientX, e.clientY)}
      onMouseLeave={onLeave}
    >
      <ResponsiveContainer width="100%" height={140}>
        <RadialBarChart
          data={data}
          innerRadius={28}
          outerRadius={62}
          startAngle={90}
          endAngle={450}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <PolarAngleAxis tick={false} domain={[0, domainMax]} type="number" />
          <RadialBar
            isAnimationActive={false}
            dataKey="value"
            cornerRadius={99}
            background={{ fill: 'var(--border)' }}
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
}

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
        const fc = fieldConfig?.[r.series.value_field];
        const ui = fc?.ui as Record<string, unknown> | undefined;
        const isPct = ui?.type === 'percent' || ui?.control === 'percent';
        const scale = ui?.scale as number | undefined;
        const num = Math.round(r.value * (typeof scale === 'number' ? 10 ** scale : 1))
          / (typeof scale === 'number' ? 10 ** scale : 1);
        const display = isPct ? `${num}%` : String(num);
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
  const labelFc = (labelField ? fieldConfig?.[labelField] : undefined) as FieldConfig | undefined;
  const labelUi = labelFc?.ui as Record<string, unknown> | undefined;
  const labelControl = (labelUi?.control as string | undefined) ?? (labelUi?.type as string | undefined);
  const labelI18n = labelUi?.i18n as Record<string, Record<string, string>> | undefined;

  return (
    <div className="activity-gauge-cell">
      {labelField && labelValue != null && (
        <div className="activity-gauge-cell-label">
          <Field
            field={{
              key: labelField,
              control: labelControl,
              i18n: labelI18n,
              no_label: true,
            } as Parameters<typeof Field>[0]['field']}
            value={labelValue}
            row={row}
          />
        </div>
      )}
      <Gauge
        rings={rings}
        row={row}
        centerTitle={centerTitle}
        onHover={onHover}
        onLeave={onLeave}
      />
      <GaugeLegend rings={rings} fieldConfig={fieldConfig} />
    </div>
  );
}

function Column({
  titleField,
  labelField,
  fieldConfig,
  rows,
  mode,
  colorFormula,
  lang,
  style,
  onHover,
  onLeave,
  pager,
  fallbackTitle,
}: {
  titleField?: string;
  labelField?: string;
  fieldConfig?: Record<string, FieldConfig>;
  rows: JSONRecord[];
  mode: ActivityGaugeMode;
  colorFormula?: string;
  lang: string;
  style?: React.CSSProperties;
  onHover: (row: JSONRecord, x: number, y: number) => void;
  onLeave: () => void;
  pager?: ColumnGridPager;
  fallbackTitle?: string;
}) {
  const headerRow = rows[0];
  const headerValue = titleField && headerRow ? resolve(headerRow, titleField) as JSONValue : null;
  const headerField = (titleField ? fieldConfig?.[titleField] : undefined) as FieldConfig | undefined;
  const headerUi = headerField?.ui as Record<string, unknown> | undefined;
  const headerControl = (headerUi?.control as string | undefined)
    ?? (headerUi?.type as string | undefined);
  const headerI18n = headerUi?.i18n as Record<string, Record<string, string>> | undefined;
  const gaugeTitleField = mode.gauge_title_field ?? mode.gauge_title;
  const centerFieldConfig = gaugeTitleField ? fieldConfig?.[gaugeTitleField] : undefined;

  const cells = rows.map(row => {
    const rings: Ring[] = [];
    for (const s of mode.series) {
      const raw = resolve(row, s.value_field);
      if (raw == null) continue;
      const value = Number(raw);
      if (!isFinite(value) || value === 0) continue;
      const domainMax = s.domain_max ?? 100;
      const color = resolveColor(s, row, value, colorFormula, 'var(--brand)');
      rings.push({
        series: s,
        value,
        domainMax,
        color,
        label: resolveFieldLabel(s.value_field, fieldConfig, lang),
      });
    }
    if (rings.length === 0) return null;
    const centerValue = gaugeTitleField ? resolve(row, gaugeTitleField) as JSONValue : null;
    const centerTitle = formatCenter(centerValue, centerFieldConfig);
    return { row, rings, centerTitle };
  }).filter(Boolean) as { row: JSONRecord; rings: Ring[]; centerTitle: string }[];

  if (cells.length === 0) return null;

  return (
    <div className="column-grid-column" style={style}>
      <div className="column-grid-column-body">
        <div className="activity-gauge-cells">
          <div className="activity-gauge-column-title">
            {titleField && headerValue != null ? (
              <Field
                field={{
                  key: titleField,
                  control: headerControl,
                  i18n: headerI18n,
                  no_label: true,
                } as Parameters<typeof Field>[0]['field']}
                value={headerValue}
                row={headerRow}
              />
            ) : (
              <span>{fallbackTitle}</span>
            )}
            {pager && (
              <div className="column-grid-pager">
                <button
                  className="column-grid-pager-btn"
                  disabled={pager.atStart}
                  onClick={() => pager.scroll(-1)}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M7.5 3L4 6l3.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <span className="column-grid-pager-label">{pager.index + 1}/{pager.total}</span>
                <button
                  className="column-grid-pager-btn"
                  disabled={pager.atEnd}
                  onClick={() => pager.scroll(1)}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M4.5 3L8 6l-3.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )}
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
    color_formula,
    column_min_width,
    column_max_width,
    modes,
    tooltip,
  } = widgetConfig;

  const fieldConfig = dataGroup?.field_config as Record<string, FieldConfig> | undefined;
  const tooltipFc = tooltip?.field_config;
  const lang = getLanguage();

  const resolvedLabelField = useMemo(() => {
    if (gauge_label_field) return gauge_label_field;
    if (!fieldConfig) return undefined;
    const candidates = Object.entries(fieldConfig)
      .filter(([key, fc]) => {
        if (key === title_field) return false;
        const ui = fc.ui as Record<string, unknown> | undefined;
        return ui?.control === 'i18n-text';
      })
      .sort(([, a], [, b]) => {
        const oa = ((a.ui as Record<string, unknown> | undefined)?.order as number | undefined) ?? 999;
        const ob = ((b.ui as Record<string, unknown> | undefined)?.order as number | undefined) ?? 999;
        return oa - ob;
      });
    return candidates[0]?.[0];
  }, [gauge_label_field, fieldConfig, title_field]);

  const modeParams = useQueryParams(
    mode_param ? [{ key: mode_param, is_query_param: true, is_optional: true }] : [],
  );
  const modeIndex = useMemo(() => {
    if (!mode_param) return 0;
    const raw = modeParams.find(p => p.key === mode_param)?.val;
    const n = Number(raw ?? 0);
    if (!isFinite(n)) return 0;
    if (!modes || modes.length === 0) return 0;
    return Math.max(0, Math.min(modes.length - 1, Math.floor(n)));
  }, [modeParams, mode_param, modes]);

  const activeMode = modes?.[modeIndex];
  const [hover, setHover] = useState<{ row: JSONRecord; x: number; y: number } | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; rows: JSONRecord[] }>();
    if (group_by) {
      for (const row of data) {
        const key = stringifyValue(resolve(row, group_by), lang);
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

  if (!data || data.length === 0 || !activeMode) return null;

  const gridStyle = {
    '--column-min-width': cssSize(column_min_width, '320px'),
    ...(column_max_width != null ? { '--column-max-width': cssSize(column_max_width, 'none') } : {}),
  } as React.CSSProperties;
  const columnStyle: React.CSSProperties = column_max_width != null
    ? { maxWidth: cssSize(column_max_width, 'none') }
    : {};

  return (
    <>
      <div
        ref={gridRef}
        className={`column-grid${isNarrow ? ' is-narrow' : ''}`}
        style={gridStyle}
        onScroll={handleScroll}
      >
        {groups.map(g => (
          <Column
            key={g.key}
            titleField={title_field}
            labelField={resolvedLabelField}
            fieldConfig={fieldConfig}
            rows={g.rows}
            mode={activeMode}
            colorFormula={color_formula}
            lang={lang}
            style={columnStyle}
            onHover={onHover}
            onLeave={onLeave}
            pager={pager}
            fallbackTitle={g.key}
          />
        ))}
      </div>
      <FieldTooltip
        row={hover?.row ?? null}
        x={hover?.x ?? 0}
        y={hover?.y ?? 0}
        fieldConfig={fieldConfig as Record<string, TooltipFieldConfigEntry> | undefined}
        tooltipConfig={tooltipFc}
        titleField={title_field}
      />
    </>
  );
}
