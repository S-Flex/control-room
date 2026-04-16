import { useState } from 'react';
import { useDataGroups, useDataGeneric, type DataGroup } from '@s-flex/xfw-ui';
import { type JSONRecord } from '@s-flex/xfw-data';
import { getLanguage } from 'xfw-get-block';
import { WidgetRenderer, FallbackDataRows } from './WidgetRenderer';

export function DataGroupWidget({ code, title }: { code: string; title?: string; }) {
  const { data: dataGroups, isLoading: isLoadingGroups } = useDataGroups(code);
  const dataGroup = dataGroups?.[0];

  if (isLoadingGroups || !dataGroup) return <p className="datagroup-loading">Loading...</p>;

  return <DataGroupContent dataGroup={dataGroup} title={title} />;
}

function DataGroupContent({ dataGroup, title }: { dataGroup: DataGroup; title?: string; }) {
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
  const configKey = layout.replace(/-/g, '_') + '_config';
  const widgetConfig = dg[configKey] as Record<string, unknown> | undefined;

  const lang = getLanguage();
  const i18n = dg.i18n as Record<string, Record<string, string>> | undefined;
  const localized = i18n ? (i18n[lang] ?? i18n[Object.keys(i18n)[0]]) : undefined;
  const headerTitle = localized?.title;
  const headerText = localized?.text;
  const sectionTitle = title ?? headerTitle;

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
      {headerText && !collapsed && (
        <p className="datagroup-header-text">{headerText}</p>
      )}
      {!collapsed && (
        widgetConfig || layout === 'cards' || layout === 'flow-board' || layout === 'content' || layout === 'table' ? (
          <WidgetRenderer layout={layout} widgetConfig={widgetConfig ?? {}} dataGroup={dataGroup} data={dataRows} dataTable={dataTable} />
        ) : (
          <FallbackDataRows data={dataRows} />
        )
      )}
    </div>
  );
}
