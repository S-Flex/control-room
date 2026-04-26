import { Component, useMemo, type ReactNode } from 'react';
import type { DataGroup } from '@s-flex/xfw-ui';
import type { DataTable, JSONRecord } from '@s-flex/xfw-data';
import { WidgetRenderer } from '../widgets/WidgetRenderer';
import { normalizeDataGroup } from '../widgets/normalizeDataGroup';

type AnyRec = Record<string, unknown>;

/** Synthesize a minimal DataTable from the mock rows + field_config so widgets
 *  that rely on `dataTable.schema` / `dataTable.primary_keys` keep working
 *  without an API. Picks the first field as primary key by default. */
function synthesizeDataTable(dataGroup: DataGroup, rows: JSONRecord[]): DataTable {
  const fc = (dataGroup as unknown as AnyRec).field_config as AnyRec | undefined;
  const fieldKeys = fc ? Object.keys(fc) : [];
  const rowKeys = rows[0] ? Object.keys(rows[0]) : [];
  const allKeys = [...new Set([...fieldKeys, ...rowKeys])];

  const schema: AnyRec = {};
  for (const k of allKeys) {
    schema[k] = { type: 'string' };
  }

  const primary = fieldKeys[0] ?? rowKeys[0];
  return {
    schema,
    primary_keys: primary ? [primary] : [],
    params: [],
  } as unknown as DataTable;
}

export function EditorPreview({ dataGroup, mockRows }: {
  dataGroup: DataGroup;
  mockRows: JSONRecord[];
}) {
  const layout = (dataGroup as unknown as AnyRec).layout as string | undefined;
  const normalized = useMemo(() => normalizeDataGroup(dataGroup), [dataGroup]);
  const dataTable = useMemo(() => synthesizeDataTable(dataGroup, mockRows), [dataGroup, mockRows]);

  const dg = normalized as unknown as AnyRec;
  const configKey = (layout ?? '').replace(/-/g, '_') + '_config';
  const widgetConfig = (dg[configKey] as AnyRec | undefined) ?? {};

  if (!layout) {
    return <p className="datagroup-error">DataGroup is missing a `layout`</p>;
  }

  return (
    <div className="dge-preview-body">
      <div className="dge-preview-meta">
        <span><b>layout:</b> {layout}</span>
        <span><b>rows:</b> {mockRows.length}</span>
      </div>
      {mockRows.length === 0 ? (
        <p className="datagroup-empty">No mock rows. Add some in the Mock data panel.</p>
      ) : (
        <PreviewBoundary>
          <WidgetRenderer
            layout={layout}
            widgetConfig={widgetConfig}
            dataGroup={normalized}
            data={mockRows}
            dataTable={dataTable}
          />
        </PreviewBoundary>
      )}
    </div>
  );
}

class PreviewBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prevProps: { children: ReactNode }) {
    // Reset on any prop change so editor edits get a fresh chance to render.
    if (prevProps.children !== this.props.children && this.state.error) {
      this.setState({ error: null });
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="datagroup-error">
          <p><b>Preview crashed:</b> {this.state.error.message}</p>
          <p style={{ fontSize: 12, opacity: 0.8 }}>Fix the config and the preview will retry.</p>
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}
