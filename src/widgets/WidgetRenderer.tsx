import type { DataGroup, JSONRecord } from '@s-flex/xfw-data';
import { TimelineBar, type TimelineBarConfig } from './TimelineBar';
import { DonutChart, type DonutChartConfig } from './DonutChart';
import { InkGauge, type InkGaugeConfig } from './InkGauge';
import { Cards } from './Cards';

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

export function WidgetRenderer({ layout, widgetConfig, dataGroup, data }: {
  layout: string;
  widgetConfig: Record<string, unknown>;
  dataGroup: DataGroup;
  data: JSONRecord[];
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
      return <Cards dataGroup={dataGroup} data={data} />;
    default:
      console.warn(`Unknown widget layout: "${layout}"`);
      return <FallbackDataRows data={data} />;
  }
}
