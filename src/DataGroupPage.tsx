import { useDataGroups, useDataGeneric, type DataGroup, type ParamValue } from 'xfw-data';
import { useMemo } from 'react';

const DATA_GROUP_NAME = 'production_line_overview';

function useUrlQueryParams(): Record<string, string> {
  return useMemo(() => {
    const params: Record<string, string> = {};
    new URLSearchParams(window.location.search).forEach((v, k) => { params[k] = v; });
    return params;
  }, []);
}

const preStyle: React.CSSProperties = {
  background: '#1e2433',
  border: '1px solid #4a4f5a',
  borderRadius: 8,
  padding: 16,
  overflow: 'auto',
  maxHeight: '60vh',
  fontSize: 13,
  lineHeight: 1.5,
};

function DataGroupSection({ dataGroup, queryParams }: { dataGroup: DataGroup; queryParams: Record<string, string> }) {
  // Build params: all data group params filled with query param values, then defaults
  const params = useMemo<ParamValue[]>(() => {
    const result: ParamValue[] = dataGroup.params.map(p => ({
      key: p.key,
      val: p.key in queryParams ? queryParams[p.key] : (p.default_value ?? p.val ?? null),
    }));
    // Add extra query params not in the data group definition
    for (const [key, val] of Object.entries(queryParams)) {
      if (!result.some(p => p.key === key)) result.push({ key, val });
    }
    return result;
  }, [dataGroup.params, queryParams]);

  const {
    dataTable,
    dataRows,
    metaDataTable,
    metaData,
    isLoading,
    isInitialLoading,
    error,
  } = useDataGeneric(dataGroup, params);

  const primarySrc = Array.isArray(dataGroup.src) ? dataGroup.src[0] : dataGroup.src;
  const metaSrc = Array.isArray(dataGroup.src) ? dataGroup.src[1] : null;

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ marginBottom: 8 }}>
        {dataGroup.title?.text ?? dataGroup.widget_id}
        <span style={{ fontSize: 12, color: '#85888e', marginLeft: 8 }}>
          layout: {dataGroup.layout} | src: {primarySrc}{metaSrc ? `, ${metaSrc}` : ''}
        </span>
      </h2>

      {isInitialLoading && <p>Loading data...</p>}
      {error instanceof Error && <p style={{ color: '#d92d20' }}>Error: {error.message}</p>}

      {dataTable ? (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', marginBottom: 4, fontSize: 14 }}>DataTable schema ({primarySrc})</summary>
          <pre style={preStyle}>{JSON.stringify(dataTable, null, 2)}</pre>
        </details>
      ) : (
        <h3 style={{ marginTop: 12, marginBottom: 4, fontSize: 14 }}>DataTable schema ({primarySrc})
          <p style={{ color: '#85888e', fontWeight: 'normal' }}>{isLoading ? 'Loading...' : 'No schema'}</p>
        </h3>
      )}

      <h3 style={{ marginTop: 12, marginBottom: 4, fontSize: 14 }}>
        Data rows ({dataRows?.length ?? 0} rows)
      </h3>
      {dataRows && dataRows.length > 0 ? (
        <pre style={preStyle}>{JSON.stringify(dataRows, null, 2)}</pre>
      ) : (
        <p style={{ color: '#85888e' }}>{isLoading ? 'Loading...' : 'No data'}</p>
      )}

      {metaSrc && (
        <>
          {metaDataTable ? (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', marginBottom: 4, fontSize: 14 }}>Meta DataTable ({metaSrc})</summary>
              <pre style={preStyle}>{JSON.stringify(metaDataTable, null, 2)}</pre>
            </details>
          ) : (
            <p style={{ color: '#85888e', marginTop: 12 }}>{isLoading ? 'Loading...' : 'No meta schema'}</p>
          )}

          <h3 style={{ marginTop: 12, marginBottom: 4, fontSize: 14 }}>
            Meta rows ({metaData?.length ?? 0} rows)
          </h3>
          {metaData && metaData.length > 0 ? (
            <pre style={preStyle}>{JSON.stringify(metaData, null, 2)}</pre>
          ) : (
            <p style={{ color: '#85888e' }}>{isLoading ? 'Loading...' : 'No meta data'}</p>
          )}
        </>
      )}
    </div>
  );
}

export function DataGroupPage() {
  const queryParams = useUrlQueryParams();
  const { data: dataGroups, isLoading, error } = useDataGroups(DATA_GROUP_NAME);

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', color: '#f5f5f6', background: '#0e1117', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 16 }}>DataGroup: {DATA_GROUP_NAME}</h1>

      {isLoading && <p>Loading data groups...</p>}
      {error && <p style={{ color: '#d92d20' }}>Error: {(error as Error).message}</p>}

      {dataGroups && (
        <>
          <h2 style={{ marginBottom: 8, fontSize: 14, color: '#85888e' }}>
            {dataGroups.length} data group(s) found
          </h2>

          <details style={{ marginBottom: 24 }}>
            <summary style={{ cursor: 'pointer', marginBottom: 8 }}>Raw data_group definition</summary>
            <pre style={preStyle}>{JSON.stringify(dataGroups, null, 2)}</pre>
          </details>

          {dataGroups.map(dg => (
            <DataGroupSection key={dg.widget_id} dataGroup={dg} queryParams={queryParams} />
          ))}
        </>
      )}
    </div>
  );
}
