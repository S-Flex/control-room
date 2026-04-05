import { useState } from 'react';
import { useDataGroups, useDataGeneric, type DataGroup, type JSONRecord } from 'xfw-data';
import { getBlock } from 'xfw-get-block';
import { WidgetRenderer, FallbackDataRows } from './WidgetRenderer';

export type DataGroupEntry = {
  code: string;
  block: { title: string; i18n?: Record<string, { title: string }> };
};

export function DataGroupWidget({ entry }: { entry: DataGroupEntry }) {
  const { data: dataGroups, isLoading: isLoadingGroups } = useDataGroups(entry.code);
  const dataGroup = dataGroups?.[0];

  if (isLoadingGroups || !dataGroup) return <p className="datagroup-loading">Loading...</p>;

  return <DataGroupContent dataGroup={dataGroup} entry={entry} />;
}

function DataGroupContent({ dataGroup, entry }: { dataGroup: DataGroup; entry: DataGroupEntry }) {
  const [collapsed, setCollapsed] = useState(false);
  const {
    dataTable,
    dataRows,
    isLoading,
    error,
  } = useDataGeneric(dataGroup);

  if (isLoading) return <p className="datagroup-loading">Loading...</p>;
  if (error instanceof Error) return <p className="datagroup-error">Error: {error.message}</p>;
  if (!dataRows || dataRows.length === 0) return <p className="datagroup-empty">No data</p>;

  const layout = dataGroup.layout ?? '';
  const dg = dataGroup as Record<string, unknown>;
  const widgetConfig = dg.widget_config as Record<string, unknown> | undefined;
  const sectionTitle = getBlock([entry], entry.code, 'title');

  return (
    <div className="datagroup-container">
      {sectionTitle && (
        <button className="datagroup-title" onClick={() => setCollapsed(c => !c)}>
          <svg className={`datagroup-collapse-icon${collapsed ? ' collapsed' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
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
