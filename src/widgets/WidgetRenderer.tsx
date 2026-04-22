import { useMemo } from 'react';
import type { DataGroup, FieldConfig } from '@s-flex/xfw-ui';
import type { DataTable, JSONRecord } from '@s-flex/xfw-data';
import { buildTableFields, type ResolvedField } from '@s-flex/xfw-ui';
import { getLanguage } from 'xfw-get-block';
import { isFieldVisible } from './resolve';
import { TimelineBar, type TimelineBarConfig } from './TimelineBar';
import { DonutChart, type DonutChartConfig } from './DonutChart';
import { ActivityGauge, type ActivityGaugeConfig } from './ActivityGauge';
import { InkGauge, type InkGaugeConfig } from './InkGauge';
import { Cards } from './Cards';
import { Item } from './Item';
import { FlowBoard } from './flow';
import { Content } from './Content';
import { VerticalBar, type VerticalBarConfig } from './VerticalBar';
import { StatusBar } from './StatusBar';

const LANGS = new Set(['nl', 'en', 'de', 'fr', 'uk']);

function isI18n(val: unknown): val is Record<string, Record<string, string>> {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const keys = Object.keys(val as Record<string, unknown>);
  return keys.length > 0 && keys.every(k => LANGS.has(k));
}

function resolveTableData(
  rows: JSONRecord[],
  fieldConfig?: Record<string, FieldConfig>,
  schema?: Record<string, { scale?: number; }>,
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
  if (field.control === 'percent') {
    const num = Number(val);
    if (!isNaN(num)) {
      return `${Math.round(num)}%`;
    }
  }
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

  const allFields = useMemo(
    () => sortFieldsByOrder(
      buildTableFields(dataTable?.schema ?? {}, dataGroup.field_config),
      dataGroup.field_config,
    ),
    [dataTable?.schema, dataGroup.field_config],
  );

  // Filter out columns where hidden_when hides the field for every row
  const fields = useMemo(() => {
    if (!dataGroup.field_config || resolvedData.length === 0) return allFields;
    return allFields.filter(f => {
      const fc = dataGroup.field_config![f.key];
      const ui = fc?.ui;
      if (!ui?.hidden_when) return true;
      // Keep the column if at least one row shows it
      return resolvedData.some(row => isFieldVisible(ui, row));
    });
  }, [allFields, dataGroup.field_config, resolvedData]);

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

export function FallbackDataRows({ data }: { data: JSONRecord[]; }) {
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
      return <TimelineBar widgetConfig={widgetConfig as unknown as TimelineBarConfig} dataGroup={dataGroup} data={data} />;
    case 'donut-chart':
      return <DonutChart widgetConfig={widgetConfig as unknown as DonutChartConfig} dataGroup={dataGroup} data={data} />;
    case 'activity-gauge':
      return <ActivityGauge widgetConfig={widgetConfig as unknown as ActivityGaugeConfig} dataGroup={dataGroup} data={data} />;
    case 'ink-gauge':
      return <InkGauge widgetConfig={widgetConfig as unknown as InkGaugeConfig} data={data} />;
    case 'cards':
      return <Cards dataGroup={dataGroup} data={data} dataTable={dataTable} />;
    case 'item':
      return <Item dataGroup={dataGroup} data={data} dataTable={dataTable} />;
    case 'flow-board':
      return <FlowBoard dataGroup={dataGroup} dataTable={dataTable!} data={data} />;
    case 'vertical-bar':
      return <VerticalBar widgetConfig={widgetConfig as unknown as VerticalBarConfig} dataGroup={dataGroup} data={data} />;
    case 'table':
      return <TableWidget widgetConfig={widgetConfig} dataGroup={dataGroup} data={data} dataTable={dataTable} />;
    case 'content':
      return <Content data={data} />;
    case 'status-bar':
      return <StatusBar widgetConfig={widgetConfig} dataGroup={dataGroup} data={data} dataTable={dataTable} />;
    default:
      console.warn(`Unknown widget layout: "${layout}"`);
      return <FallbackDataRows data={data} />;
  }
}
