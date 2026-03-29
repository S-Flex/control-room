import { useDataGroups, useDataGeneric, type DataGroup } from 'xfw-data';

const DATA_GROUP_NAME = 'production_line_overview';

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
  const {
    dataTable,
    dataRows,
    metaDataTable,
    metaData,
    isLoading,
    isInitialLoading,
    error,
  } = useDataGeneric(dataGroup);

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

      {isLoading && <p>Loading…</p>}
      {error instanceof Error && <p style={{ color: '#ff5c5c' }}>Error: {error.message}</p>}

      <h3 style={{ marginTop: 16 }}>DataTable (schema)</h3>
      <pre style={preStyle}>{JSON.stringify(dataTable, null, 2) ?? 'null'}</pre>

      <h3 style={{ marginTop: 16 }}>Data Rows ({dataRows?.length ?? 0})</h3>
      <pre style={preStyle}>{JSON.stringify(dataRows, null, 2) ?? 'null'}</pre>

      {metaSrc && (
        <>
          <h3 style={{ marginTop: 16 }}>Meta DataTable</h3>
          <pre style={preStyle}>{JSON.stringify(metaDataTable, null, 2) ?? 'null'}</pre>

          <h3 style={{ marginTop: 16 }}>Meta Data ({metaData?.length ?? 0})</h3>
          <pre style={preStyle}>{JSON.stringify(metaData, null, 2) ?? 'null'}</pre>
        </>
      )}
    </div>
  );
}

export function DataGroupPage() {
  const { data: dataGroups, isLoading, error } = useDataGroups(DATA_GROUP_NAME);

  console.log('DataGroupPage render', { dataGroups, isLoading, error });

  return (
    <div style={{ padding: 32, color: '#e0e0e0' }}>
      <h1>DataGroup Debug — {DATA_GROUP_NAME}</h1>
      {isLoading && <p>Loading data groups…</p>}
      {error instanceof Error && <p style={{ color: '#ff5c5c' }}>Error: {error.message}</p>}
      {dataGroups?.map((dg: DataGroup, i: number) => (
        <DataGroupSection key={dg.widget_id || i} dataGroup={dg} />
      ))}
    </div>
  );
}
