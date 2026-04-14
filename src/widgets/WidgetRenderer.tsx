import { useMemo } from 'react';
import type { DataGroup, DataTable, FieldConfig, JSONRecord } from '@s-flex/xfw-data';
import { buildTableFields, type ResolvedField } from '@s-flex/xfw-ui';
import { getLanguage } from 'xfw-get-block';
import { TimelineBar, type TimelineBarConfig } from './TimelineBar';
import { DonutChart, type DonutChartConfig } from './DonutChart';
import { InkGauge, type InkGaugeConfig } from './InkGauge';
import { Cards } from './Cards';
import { FlowBoard } from './flow';
import { Content } from './Content';

const LANGS = new Set(['nl', 'en', 'de', 'fr', 'uk']);

function isI18n(val: unknown): val is Record<string, Record<string, string>> {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const keys = Object.keys(val as Record<string, unknown>);
  return keys.length > 0 && keys.every(k => LANGS.has(k));
}

function resolveTableData(
  rows: JSONRecord[],
  fieldConfig?: Record<string, FieldConfig>,
  schema?: Record<string, { scale?: number }>,
): JSONRecord[] {
  const lang = getLanguage();
  return rows.map(row => {
    const resolved: JSONRecord = {};
    for (const [key, val] of Object.entries(row)) {
      const fc = fieldConfig?.[key] as Record<string, unknown> | undefined;
      const ui = fc?.ui as Record<string, unknown> | undefined;
      const scale = ui?.scale ?? schema?.[key]?.scale;
      if (isI18n(val)) {
        const localized = val[lang] ?? val[Object.keys(val)[0]];
        resolved[key] = localized?.title ?? localized?.text ?? '';
      } else if (typeof scale === 'number' && val != null) {
        const num = typeof val === 'number' ? val : Number(val);
        resolved[key] = isNaN(num) ? val : Number(num.toFixed(scale));
      } else {
        resolved[key] = val;
      }
    }
    return resolved;
  });
}

function sortFieldsByOrder(
  fields: ResolvedField[],
  fieldConfig?: Record<string, FieldConfig>,
): ResolvedField[] {
  if (!fieldConfig) return fields;
  return [...fields].sort((a, b) => {
    const orderA = (fieldConfig[a.key]?.ui as Record<string, unknown> | undefined)?.order;
    const orderB = (fieldConfig[b.key]?.ui as Record<string, unknown> | undefined)?.order;
    return ((typeof orderA === 'number' ? orderA : 999) - (typeof orderB === 'number' ? orderB : 999));
  });
}

function resolveHeaderLabel(field: ResolvedField, lang: string): string {
  const i18n = field.i18n as Record<string, Record<string, string>> | undefined;
  return i18n?.[lang]?.label ?? i18n?.[lang]?.title ?? field.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatCellValue(val: unknown, field: ResolvedField, locale: string): string {
  if (val == null) return '';
  if (field.control === 'date') return new Date(val as string | number).toLocaleDateString(locale);
  if (field.control === 'datetime') return new Date(val as string | number).toLocaleString(locale);
  return String(val);
}

function TableWidget({ widgetConfig, dataGroup, data, dataTable }: {
  widgetConfig: Record<string, unknown>;
  dataGroup: DataGroup;
  data: JSONRecord[];
  dataTable?: DataTable;
}) {
  const lang = getLanguage();
  const locale = lang === 'nl' ? 'nl-NL' : lang === 'de' ? 'de-DE' : lang === 'fr' ? 'fr-FR' : lang === 'uk' ? 'uk-UA' : 'en-GB';
  const size = (widgetConfig?.size as string) ?? 'sm';

  const resolvedData = useMemo(
    () => resolveTableData(data, dataGroup.field_config, dataTable?.schema),
    [data, dataGroup.field_config, dataTable?.schema],
  );

  const fields = useMemo(
    () => sortFieldsByOrder(
      buildTableFields(dataTable?.schema ?? {}, dataGroup.field_config),
      dataGroup.field_config,
    ),
    [dataTable?.schema, dataGroup.field_config],
  );

  return (
    <div className={`widget-table widget-table--${size}`}>
      <div className="widget-table-card">
        <div className="widget-table-scroll">
          <table className="widget-table-root">
            <thead className="widget-table-thead">
              <tr>
                {fields.map(f => (
                  <th key={f.key} className="widget-table-th">
                    {resolveHeaderLabel(f, lang)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resolvedData.map((row, i) => (
                <tr key={i} className="widget-table-tr">
                  {fields.map(f => (
                    <td key={f.key} className="widget-table-td">
                      <div className="truncate">{formatCellValue(row[f.key], f, locale)}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function FallbackDataRows({ data }: { data: JSONRecord[] }) {
  return (
    <div className="datagroup-rows">
      {data.map((row, i) => (
        <div key={i} className="datagroup-row">
          {Object.entries(row).map(([key, val]) => (
            <div key={key} className="datagroup-field">
              <span className="datagroup-field-label">{key}</span>
              <span className="datagroup-field-value">{typeof val === 'object' ? JSON.stringify(val) : String(val ?? '—')}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function WidgetRenderer({ layout, widgetConfig, dataGroup, data, dataTable }: {
  layout: string;
  widgetConfig: Record<string, unknown>;
  dataGroup: DataGroup;
  data: JSONRecord[];
  dataTable?: DataTable;
}) {
  const key = layout.replace(/_/g, '-');
  switch (key) {
    case 'timeline-bar':
      return <TimelineBar widgetConfig={widgetConfig as unknown as TimelineBarConfig} data={data} />;
    case 'donut-chart':
      return <DonutChart widgetConfig={widgetConfig as unknown as DonutChartConfig} data={data} />;
    case 'ink-gauge':
      return <InkGauge widgetConfig={widgetConfig as unknown as InkGaugeConfig} data={data} />;
    case 'cards':
      return <Cards dataGroup={dataGroup} data={data} dataTable={dataTable} />;
    case 'flow-board':
      return <FlowBoard dataGroup={dataGroup} dataTable={dataTable!} data={data} />;
    case 'table':
      return <TableWidget widgetConfig={widgetConfig} dataGroup={dataGroup} data={data} dataTable={dataTable} />;
    case 'content':
      return <Content data={data} />;
    default:
      console.warn(`Unknown widget layout: "${layout}"`);
      return <FallbackDataRows data={data} />;
  }
}
