import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDataGroups, useDataGeneric, type DataGroup, type JSONRecord } from 'xfw-data';
import { getBlock } from 'xfw-get-block';
import { TimelineBar, type TimelineBarConfig } from './widgets/TimelineBar';
import { DonutChart, type DonutChartConfig } from './widgets/DonutChart';
import { InkGauge, type InkGaugeConfig } from './widgets/InkGauge';
import { Cards } from './widgets/Cards';

type SidebarDataGroupEntry = {
  code: string;
  block: { title: string; i18n?: Record<string, { title: string }> };
};

type SidebarConfig = {
  code: string;
  data_groups: SidebarDataGroupEntry[];
};

function FallbackDataRows({ data }: { data: JSONRecord[] }) {
  return (
    <div className="sidebar-data-rows">
      {data.map((row, i) => (
        <div key={i} className="sidebar-data-row">
          {Object.entries(row).map(([key, val]) => (
            <div key={key} className="sidebar-data-field">
              <span className="sidebar-field-label">{key}</span>
              <span className="sidebar-field-value">{typeof val === 'object' ? JSON.stringify(val) : String(val ?? '—')}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function WidgetRenderer({ layout, widgetConfig, dataGroup, data }: {
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

function SidebarDataGroup({ entry }: { entry: SidebarDataGroupEntry }) {
  const { data: dataGroups, isLoading: isLoadingGroups } = useDataGroups(entry.code);
  const dataGroup = dataGroups?.[0];

  if (isLoadingGroups || !dataGroup) return <p className="sidebar-loading">Loading...</p>;

  return <SidebarDataGroupContent dataGroup={dataGroup} entry={entry} />;
}

function SidebarDataGroupContent({ dataGroup, entry }: { dataGroup: DataGroup; entry: SidebarDataGroupEntry }) {
  const [collapsed, setCollapsed] = useState(false);
  const {
    dataTable,
    dataRows,
    isLoading,
    error,
  } = useDataGeneric(dataGroup);

  if (isLoading) return <p className="sidebar-loading">Loading...</p>;
  if (error instanceof Error) return <p className="sidebar-error">Error: {error.message}</p>;
  if (!dataRows || dataRows.length === 0) return <p className="sidebar-empty">No data</p>;

  const layout = dataGroup.layout ?? '';
  const dg = dataGroup as Record<string, unknown>;
  const widgetConfig = dg.widget_config as Record<string, unknown> | undefined;
  const sectionTitle = getBlock([entry], entry.code, 'title');

  return (
    <div className="sidebar-data-group">
      {sectionTitle && (
        <button className="sidebar-section-title" onClick={() => setCollapsed(c => !c)}>
          <svg className={`sidebar-collapse-icon${collapsed ? ' collapsed' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {sectionTitle}
        </button>
      )}
      {!collapsed && (
        widgetConfig || layout === 'cards' ? (
          <WidgetRenderer layout={layout} widgetConfig={widgetConfig ?? {}} dataGroup={dataGroup} data={dataRows} />
        ) : (
          <FallbackDataRows data={dataRows} />
        )
      )}
    </div>
  );
}

export function SidebarPanel({ code, title, onClose }: {
  code: string;
  title: string;
  onClose: () => void;
}) {
  const [sidebarConfigs, setSidebarConfigs] = useState<SidebarConfig[]>([]);
  const [width, setWidth] = useState(20); // percentage
  const dragging = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/data/sidebar.json')
      .then(r => r.json())
      .then(data => setSidebarConfigs(data));
  }, []);

  const config = sidebarConfigs.find(s => s.code === code);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startX = e.clientX;
    const startWidth = width;
    const vw = window.innerWidth;

    const onMove = (ev: PointerEvent) => {
      if (!dragging.current) return;
      const delta = startX - ev.clientX;
      const newWidth = Math.min(50, Math.max(15, startWidth + (delta / vw) * 100));
      setWidth(newWidth);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [width]);

  return (
    <div className="sidebar" ref={sidebarRef} style={{ width: `${width}%` }}>
      <div className="sidebar-resize-handle" onPointerDown={handleResizeStart} />
      <div className="sidebar-header">
        <h3 className="sidebar-title">{title}</h3>
        <button className="sidebar-close" onClick={onClose} title="Close">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="sidebar-body">
        {!config && <p className="sidebar-loading">Loading...</p>}
        {config?.data_groups.map(entry => (
          <SidebarDataGroup key={entry.code} entry={entry} />
        ))}
      </div>
    </div>
  );
}
