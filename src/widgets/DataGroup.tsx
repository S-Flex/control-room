import { useEffect, useMemo, useRef, useState } from 'react';
import { useDataGroups, type DataGroup, type FieldConfig } from '@s-flex/xfw-ui';
import { type JSONRecord } from '@s-flex/xfw-data';
import { getLanguage } from 'xfw-get-block';
import { useDataGeneric } from '../hooks/useDataGeneric';
import { WidgetRenderer, FallbackDataRows } from './WidgetRenderer';
import { normalizeDataGroup } from './normalizeDataGroup';
import { DataGroupProvider } from './DataGroupContext';

const EMPTY_KEYS: string[] = [];

export function DataGroupLoading() {
  return <div className="datagroup-loading"><div className="datagroup-loading-spinner" /></div>;
}

export function DataGroupWidget({ code, title }: { code: string; title?: string; }) {
  const { data: dataGroups, isLoading: isLoadingGroups } = useDataGroups(code);
  const dataGroup = dataGroups?.[0];

  if (isLoadingGroups || !dataGroup) return <DataGroupLoading />;

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
    params,
    dataUpdatedAt,
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

  // Detect when fetch params change (e.g. switching production_line_id). The
  //  underlying xfw-data hook returns *stale* rows from `persistentData` while
  //  the new query is in flight; without this guard, downstream widgets like
  //  StatusBar render the previous selection's teams until new data lands —
  //  which looks like "old teams haven't cleared yet". `dataUpdatedAt` ticks
  //  forward only when a fresh fetch resolves, so we use it to mark when the
  //  rows we have actually correspond to the current params.
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);
  const [resolvedParamsKey, setResolvedParamsKey] = useState<string | null>(null);
  // Track via ref so we can tell `dataUpdatedAt-actually-changed` from
  //  `paramsKey-changed` without the latter retriggering the snap.
  const lastDataUpdatedAtRef = useRef<number | undefined>(undefined);
  const paramsKeyRef = useRef(paramsKey);
  paramsKeyRef.current = paramsKey;
  useEffect(() => {
    if (dataUpdatedAt && dataUpdatedAt !== lastDataUpdatedAtRef.current) {
      lastDataUpdatedAtRef.current = dataUpdatedAt;
      setResolvedParamsKey(paramsKeyRef.current);
    }
  }, [dataUpdatedAt]);
  const isStale = resolvedParamsKey !== null && resolvedParamsKey !== paramsKey;

  // Hold the most recent non-empty rows so a background re-fetch (e.g. a
  // `sitrep_mode` query-param flip that doesn't change the fetch key) keeps
  // the widget mounted with stale data instead of unmounting to the
  // "Loading..." placeholder. Skip the sticky write while `isStale` is true
  // — those rows belong to the previous params.
  const [stickyRows, setStickyRows] = useState<JSONRecord[] | undefined>(undefined);
  useEffect(() => {
    if (!isStale && trackedRows && trackedRows.length > 0) setStickyRows(trackedRows);
  }, [trackedRows, isStale]);
  // While stale, drop both fresh and sticky rows so widgets render the empty
  // /loading state until the new fetch resolves.
  const renderRows = isStale ? undefined : (trackedRows ?? stickyRows);

  // Cache the primary-keys array reference so any descendant Field with
  // `nav_field` can pull them from context as `extraParamKeys` and surface the
  // active row's identity in the URL on navigation — same behavior as the
  // row-level on_select navs in Cards / FlowBoard / Item.
  // Depend on `dataTable?.primary_keys` directly so the fallback `[]` keeps a
  // stable reference (otherwise every render before dataTable arrives builds a
  // new array, churns the context, and re-renders every descendant Field).
  const dgCtx = useMemo(
    () => ({
      primaryKeys: dataTable?.primary_keys ?? EMPTY_KEYS,
      fieldConfig: normalizedDataGroup.field_config as Record<string, FieldConfig> | undefined,
    }),
    [dataTable?.primary_keys, normalizedDataGroup.field_config],
  );

  if ((isInitialLoading || isStale) && !renderRows) return <DataGroupLoading />;
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
