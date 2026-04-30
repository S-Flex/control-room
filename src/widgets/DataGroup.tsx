import { useEffect, useMemo, useState } from 'react';
import { useDataGroups, type DataGroup } from '@s-flex/xfw-ui';
import { type JSONRecord } from '@s-flex/xfw-data';
import { getLanguage } from 'xfw-get-block';
import { useDataGeneric } from '../hooks/useDataGeneric';
import { WidgetRenderer, FallbackDataRows } from './WidgetRenderer';
import { normalizeDataGroup } from './normalizeDataGroup';
import { DataGroupProvider } from './DataGroupContext';

const EMPTY_KEYS: string[] = [];

export function DataGroupWidget({ code, title }: { code: string; title?: string; }) {
  const { data: dataGroups, isLoading: isLoadingGroups } = useDataGroups(code);
  const dataGroup = dataGroups?.[0];

  if (isLoadingGroups || !dataGroup) return <div className="datagroup-loading"><div className="datagroup-loading-spinner" /></div>;

  return <DataGroupContent dataGroup={dataGroup} title={title} />;
}

function DataGroupContent({ dataGroup, title }: { dataGroup: DataGroup; title?: string; }) {
  const [collapsed, setCollapsed] = useState(false);
  const {
    dataTable,
    dataRows,
    isLoading,
    isInitialLoading,
    error,
  } = useDataGeneric(dataGroup);

  // Pre-merge every nested `field_config` with root.field_config once, so
  // downstream widgets (and their tooltip/group sub-configs) inherit
  // label/i18n/order/control/scale without duplicating merge logic.
  const normalizedDataGroup = useMemo(() => normalizeDataGroup(dataGroup), [dataGroup]);

  // Stamp every row with a stable `track_by` index as soon as the rows arrive
  // from the API. Widgets (search, prev/next focus, list keys) treat
  // `track_by` as the canonical row id so they don't depend on
  // `primary_keys` being declared or `row.id` being present. The clone keeps
  // the cached payload in xfw-data untouched.
  const trackedRows = useMemo(() => {
    if (!dataRows) return dataRows;
    return dataRows.map((row, i) => ({ ...row, track_by: i }));
  }, [dataRows]);

  // Hold the most recent non-empty rows so a background re-fetch (e.g. a
  // `sitrep_mode` query-param flip that changes the TanStack Query key) keeps
  // the widget mounted with stale data instead of unmounting to the
  // "Loading..." placeholder. The first fetch still shows Loading because
  // `stickyRows` is undefined until at least one batch arrives.
  const [stickyRows, setStickyRows] = useState<JSONRecord[] | undefined>(undefined);
  useEffect(() => {
    if (trackedRows && trackedRows.length > 0) setStickyRows(trackedRows);
  }, [trackedRows]);
  const renderRows = trackedRows ?? stickyRows;

  // Cache the primary-keys array reference so any descendant Field with
  // `nav_field` can pull them from context as `extraParamKeys` and surface the
  // active row's identity in the URL on navigation — same behavior as the
  // row-level on_select navs in Cards / FlowBoard / Item.
  // Depend on `dataTable?.primary_keys` directly so the fallback `[]` keeps a
  // stable reference (otherwise every render before dataTable arrives builds a
  // new array, churns the context, and re-renders every descendant Field).
  const dgCtx = useMemo(
    () => ({ primaryKeys: dataTable?.primary_keys ?? EMPTY_KEYS }),
    [dataTable?.primary_keys],
  );

  if (isInitialLoading && !renderRows) return <div className="datagroup-loading"><div className="datagroup-loading-spinner" /></div>;
  if (error instanceof Error) return <p className="datagroup-error">Error: {error.message}</p>;
  if (!renderRows || renderRows.length === 0) return <p className="datagroup-empty">No data</p>;

  const layout = normalizedDataGroup.layout ?? '';
  const dg = normalizedDataGroup as Record<string, unknown>;
  const configKey = layout.replace(/-/g, '_') + '_config';
  const widgetConfig = dg[configKey] as Record<string, unknown> | undefined;

  const lang = getLanguage();
  const i18n = dg.i18n as Record<string, Record<string, string>> | undefined;
  const localized = i18n ? (i18n[lang] ?? i18n[Object.keys(i18n)[0]]) : undefined;
  const headerTitle = localized?.title;
  const headerText = localized?.text;
  const sectionTitle = title ?? headerTitle;

  return (
    <DataGroupProvider value={dgCtx}>
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
          <div className="datagroup-body">
            {widgetConfig || layout === 'cards' || layout === 'item' || layout === 'flow-board' || layout === 'content' || layout === 'table' || layout === 'status-bar' ? (
              <WidgetRenderer layout={layout} widgetConfig={widgetConfig ?? {}} dataGroup={normalizedDataGroup} data={renderRows} dataTable={dataTable} />
            ) : (
              <FallbackDataRows data={renderRows} />
            )}
            {isLoading && (
              <div className="datagroup-loading-overlay">
                <div className="datagroup-loading-spinner" />
              </div>
            )}
          </div>
        )}
      </div>
    </DataGroupProvider>
  );
}
