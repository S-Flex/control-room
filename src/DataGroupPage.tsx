import { useDataGroups, useDataGeneric, type DataGroup, type ParamValue } from 'xfw-data';
import { useMemo } from 'react';

const DATA_GROUP_NAME = 'productionLineThreeView2';

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

function DataGroupSection({ dataGroup }: { dataGroup: DataGroup }) {
  const params = useMemo<ParamValue[]>(() => {
    return dataGroup.params
      .filter(p => p.default_value !== undefined || p.val !== undefined)
      .map(p => ({ key: p.key, val: p.default_value ?? p.val ?? null }));
  }, [dataGroup.params]);

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

      <h3 style={{ marginTop: 12, marginBottom: 4, fontSize: 14 }}>DataTable schema ({primarySrc})</h3>
      {dataTable ? (
        <pre style={preStyle}>{JSON.stringify(dataTable, null, 2)}</pre>
      ) : (
        <p style={{ color: '#85888e' }}>{isLoading ? 'Loading...' : 'No schema'}</p>
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
          <h3 style={{ marginTop: 12, marginBottom: 4, fontSize: 14 }}>Meta DataTable ({metaSrc})</h3>
          {metaDataTable ? (
            <pre style={preStyle}>{JSON.stringify(metaDataTable, null, 2)}</pre>
          ) : (
            <p style={{ color: '#85888e' }}>{isLoading ? 'Loading...' : 'No meta schema'}</p>
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
            <DataGroupSection key={dg.widget_id} dataGroup={dg} />
          ))}
        </>
      )}
    </div>
  );
}
