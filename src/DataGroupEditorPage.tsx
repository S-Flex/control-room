import { useCallback, useEffect, useState } from 'react';
import type { DataGroup } from '@s-flex/xfw-ui';
import type { JSONRecord } from '@s-flex/xfw-data';
import { FieldConfigEditor } from './editor/FieldConfigEditor';
import { JsonEditor } from './editor/JsonEditor';
import { MockDataEditor } from './editor/MockDataEditor';
import { EditorPreview } from './editor/EditorPreview';
import { TEMPLATES, blankTemplate } from './editor/templates';
import { LAYOUT_OPTIONS } from './editor/options';
import type { EditorState } from './editor/types';
import { loadEditorState, saveEditorState } from './editor/storage';

type AnyRec = Record<string, unknown>;
type Tab = 'visual' | 'json' | 'mock';

export function DataGroupEditorPage() {
  const [state, setState] = useState<EditorState>(() => loadEditorState());
  const [tab, setTab] = useState<Tab>('visual');
  const [previewWidth, setPreviewWidth] = useState(40); // percentage

  useEffect(() => {
    saveEditorState(state);
  }, [state]);

  const setDataGroup = useCallback((next: DataGroup) => {
    setState(s => ({ ...s, dataGroup: next }));
  }, []);

  const setMockRows = useCallback((next: JSONRecord[]) => {
    setState(s => ({ ...s, mockRows: next }));
  }, []);

  const layout = (state.dataGroup as unknown as AnyRec).layout as string | undefined;

  function handleLayoutChange(next: string) {
    setDataGroup({ ...(state.dataGroup as unknown as AnyRec), layout: next } as unknown as DataGroup);
  }

  function handleTemplate(id: string) {
    if (id === '') return;
    if (id === 'blank') {
      setState(blankTemplate(layout ?? 'flow-board'));
      return;
    }
    const tpl = TEMPLATES.find(t => t.id === id);
    if (tpl) setState(tpl.state);
  }

  async function handleCopyDataGroup() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(state.dataGroup, null, 2));
    } catch {
      /* clipboard blocked */
    }
  }

  function handleResizeStart(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = previewWidth;
    const vw = window.innerWidth;
    const onMove = (ev: PointerEvent) => {
      const delta = startX - ev.clientX;
      const next = Math.min(70, Math.max(20, startWidth + (delta / vw) * 100));
      setPreviewWidth(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return (
    <div className="dge-page">
      <div className="dge-editor" style={{ width: `${100 - previewWidth}%` }}>
        <div className="dge-toolbar">
          <h1 className="dge-toolbar-title">DataGroup editor</h1>

          <label className="dge-control">
            <span>Layout</span>
            <select value={layout ?? ''} onChange={e => handleLayoutChange(e.target.value)}>
              {LAYOUT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          <label className="dge-control">
            <span>Template</span>
            <select value="" onChange={e => handleTemplate(e.target.value)}>
              <option value="">Load template…</option>
              <option value="blank">Blank (current layout)</option>
              {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>

          <button type="button" onClick={handleCopyDataGroup}>Copy DataGroup JSON</button>
        </div>

        <div className="dge-tabs">
          <button
            type="button"
            className={`dge-tab${tab === 'visual' ? ' dge-tab--active' : ''}`}
            onClick={() => setTab('visual')}
          >Visual</button>
          <button
            type="button"
            className={`dge-tab${tab === 'json' ? ' dge-tab--active' : ''}`}
            onClick={() => setTab('json')}
          >JSON</button>
          <button
            type="button"
            className={`dge-tab${tab === 'mock' ? ' dge-tab--active' : ''}`}
            onClick={() => setTab('mock')}
          >Mock data</button>
        </div>

        <div className="dge-pane">
          {tab === 'visual' && (
            <FieldConfigEditor dataGroup={state.dataGroup} onChange={setDataGroup} />
          )}
          {tab === 'json' && (
            <JsonEditor<DataGroup>
              label="DataGroup JSON"
              value={state.dataGroup}
              onChange={setDataGroup}
            />
          )}
          {tab === 'mock' && (
            <MockDataEditor
              dataGroup={state.dataGroup}
              rows={state.mockRows}
              onChange={setMockRows}
            />
          )}
        </div>
      </div>

      <div className="sidebar dge-preview" style={{ width: `${previewWidth}%`, maxWidth: '70vw' }}>
        <div className="sidebar-resize-handle" onPointerDown={handleResizeStart} />
        <div className="sidebar-header">
          <h3 className="sidebar-title">Preview</h3>
        </div>
        <div className="sidebar-body">
          <EditorPreview dataGroup={state.dataGroup} mockRows={state.mockRows} />
        </div>
      </div>
    </div>
  );
}
