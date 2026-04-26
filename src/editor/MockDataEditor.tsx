import { useMemo, useState } from 'react';
import type { DataGroup } from '@s-flex/xfw-ui';
import type { JSONRecord, JSONValue } from '@s-flex/xfw-data';

type AnyRec = Record<string, unknown>;

function getFieldKeys(dg: DataGroup): string[] {
  const fc = (dg as unknown as AnyRec).field_config as AnyRec | undefined;
  return fc ? Object.keys(fc) : [];
}

function collectColumns(rows: JSONRecord[], dg: DataGroup): string[] {
  const seen = new Set<string>();
  for (const k of getFieldKeys(dg)) seen.add(k);
  for (const r of rows) for (const k of Object.keys(r)) seen.add(k);
  return [...seen];
}

/** Try to coerce a string back to number/bool/null/JSON — fall back to string. */
function coerce(raw: string): JSONValue {
  if (raw === '') return '';
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
    try { return JSON.parse(raw) as JSONValue; } catch { /* fallthrough */ }
  }
  return raw;
}

function display(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export function MockDataEditor({ dataGroup, rows, onChange }: {
  dataGroup: DataGroup;
  rows: JSONRecord[];
  onChange: (next: JSONRecord[]) => void;
}) {
  const columns = useMemo(() => collectColumns(rows, dataGroup), [rows, dataGroup]);
  const [newCol, setNewCol] = useState('');

  function setCell(rowIdx: number, col: string, raw: string) {
    const next = rows.map((r, i) => i === rowIdx ? { ...r, [col]: coerce(raw) } : r);
    onChange(next);
  }

  function addRow() {
    const blank: JSONRecord = {};
    for (const c of columns) blank[c] = '';
    onChange([...rows, blank]);
  }

  function deleteRow(idx: number) {
    onChange(rows.filter((_, i) => i !== idx));
  }

  function addColumn() {
    const name = newCol.trim();
    if (!name || columns.includes(name)) return;
    onChange(rows.map(r => ({ ...r, [name]: '' })));
    setNewCol('');
  }

  return (
    <div className="dge-section">
      <div className="dge-section-header">
        <h3 className="dge-section-title">Mock data ({rows.length} rows)</h3>
        <div className="dge-json-actions">
          <input
            placeholder="new column"
            value={newCol}
            onChange={e => setNewCol(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addColumn(); }}
            spellCheck={false}
            style={{ width: 140 }}
          />
          <button type="button" onClick={addColumn}>+ Column</button>
          <button type="button" onClick={addRow}>+ Row</button>
        </div>
      </div>

      <div className="dge-mock-scroll">
        <table className="dge-mock-table">
          <thead>
            <tr>
              <th className="dge-mock-rownum"></th>
              {columns.map(c => <th key={c}>{c}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="dge-mock-rownum">{i + 1}</td>
                {columns.map(c => (
                  <td key={c}>
                    <input
                      value={display(row[c])}
                      onChange={e => setCell(i, c, e.target.value)}
                      spellCheck={false}
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="dge-mock-delete"
                    onClick={() => deleteRow(i)}
                    title="Delete row"
                  >×</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="dge-empty" style={{ padding: 12 }}>
                  No rows. Click "+ Row" to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
