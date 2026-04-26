import { useEffect, useState } from 'react';
import type { DataGroup, FieldConfig } from '@s-flex/xfw-ui';
import { Toggle } from '../controls/Toggle';
import { WIDTH_OPTIONS, CONTROL_OPTIONS } from './options';
import type { EditorLang } from './types';
import { EDITOR_LANGS } from './types';

type AnyRec = Record<string, unknown>;

function getFieldConfig(dg: DataGroup): Record<string, FieldConfig> {
  return ((dg as unknown as AnyRec).field_config as Record<string, FieldConfig> | undefined) ?? {};
}

function setFieldConfig(dg: DataGroup, fc: Record<string, FieldConfig>): DataGroup {
  return { ...(dg as unknown as AnyRec), field_config: fc } as unknown as DataGroup;
}

function getUi(entry: FieldConfig | undefined): AnyRec {
  return ((entry as unknown as AnyRec)?.ui as AnyRec | undefined) ?? {};
}

function setUiProp(entry: FieldConfig | undefined, prop: string, value: unknown): FieldConfig {
  const base = (entry as unknown as AnyRec) ?? {};
  const ui = { ...((base.ui as AnyRec | undefined) ?? {}) };
  if (value === '' || value === undefined || value === null) {
    delete ui[prop];
  } else {
    ui[prop] = value;
  }
  return { ...base, ui } as FieldConfig;
}

function setEntryProp(entry: FieldConfig | undefined, prop: string, value: unknown): FieldConfig {
  const base = { ...((entry as unknown as AnyRec) ?? {}) };
  if (value === '' || value === undefined || value === null) {
    delete base[prop];
  } else {
    base[prop] = value;
  }
  return base as FieldConfig;
}

function getI18nTitle(entry: FieldConfig | undefined, lang: EditorLang): string {
  const i18n = (getUi(entry).i18n as Record<string, { title?: string }> | undefined) ?? {};
  return i18n[lang]?.title ?? '';
}

function setI18nTitle(entry: FieldConfig | undefined, lang: EditorLang, title: string): FieldConfig {
  const ui = getUi(entry);
  const i18n: Record<string, { title?: string }> = { ...((ui.i18n as Record<string, { title?: string }> | undefined) ?? {}) };
  if (title) {
    i18n[lang] = { ...(i18n[lang] ?? {}), title };
  } else if (i18n[lang]) {
    const next = { ...i18n[lang] };
    delete next.title;
    if (Object.keys(next).length === 0) delete i18n[lang];
    else i18n[lang] = next;
  }
  return setUiProp(entry, 'i18n', Object.keys(i18n).length === 0 ? undefined : i18n);
}

function sortKeysByOrder(fc: Record<string, FieldConfig>): string[] {
  return Object.keys(fc).sort((a, b) => {
    const oa = (getUi(fc[a]).order as number | undefined) ?? 999;
    const ob = (getUi(fc[b]).order as number | undefined) ?? 999;
    return oa - ob;
  });
}

/** Reassign sequential 1..N order values to all fields in the given key order. */
function reorderKeys(fc: Record<string, FieldConfig>, keys: string[]): Record<string, FieldConfig> {
  const next: Record<string, FieldConfig> = {};
  keys.forEach((k, i) => {
    next[k] = setUiProp(fc[k], 'order', i + 1);
  });
  return next;
}

export function FieldConfigEditor({ dataGroup, onChange }: {
  dataGroup: DataGroup;
  onChange: (next: DataGroup) => void;
}) {
  const fc = getFieldConfig(dataGroup);
  const keys = sortKeysByOrder(fc);
  const [lang, setLang] = useState<EditorLang>('en');
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [newFieldName, setNewFieldName] = useState('');

  const update = (nextFc: Record<string, FieldConfig>) => onChange(setFieldConfig(dataGroup, nextFc));

  function updateField(key: string, mutator: (entry: FieldConfig | undefined) => FieldConfig) {
    update({ ...fc, [key]: mutator(fc[key]) });
  }

  function renameField(oldKey: string, newKey: string) {
    if (!newKey || newKey === oldKey || fc[newKey]) return;
    const next: Record<string, FieldConfig> = {};
    for (const k of keys) {
      next[k === oldKey ? newKey : k] = fc[k];
    }
    update(next);
  }

  function deleteField(key: string) {
    const next = { ...fc };
    delete next[key];
    update(reorderKeys(next, sortKeysByOrder(next)));
  }

  function addField() {
    const name = newFieldName.trim();
    if (!name || fc[name]) return;
    const next = { ...fc, [name]: { ui: { order: keys.length + 1, i18n: { en: { title: name } } } } as FieldConfig };
    update(next);
    setNewFieldName('');
  }

  function handleDrop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return;
    const without = keys.filter(k => k !== dragKey);
    const targetIdx = without.indexOf(targetKey);
    without.splice(targetIdx, 0, dragKey);
    update(reorderKeys(fc, without));
    setDragKey(null);
  }

  return (
    <div className="dge-section">
      <div className="dge-section-header">
        <h3 className="dge-section-title">field_config</h3>
        <label className="dge-lang-picker">
          Label lang
          <select value={lang} onChange={e => setLang(e.target.value as EditorLang)}>
            {EDITOR_LANGS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      </div>

      <div className="dge-field-list">
        {keys.length === 0 && <p className="dge-empty">No fields. Add one below.</p>}
        {keys.map(key => {
          const entry = fc[key];
          const ui = getUi(entry);
          const hidden = !!ui.hidden;
          const noLabel = !!ui.no_label;
          const control = (ui.control as string | undefined) ?? ((entry as unknown as AnyRec)?.control as string | undefined) ?? '';
          const className = (ui.class_name as string | undefined) ?? '';
          const scaleVal = (entry as unknown as AnyRec)?.scale ?? ui.scale;
          const scale = typeof scaleVal === 'number' ? String(scaleVal) : '';

          return (
            <div
              key={key}
              className={`dge-field-row${dragKey === key ? ' dge-field-row--dragging' : ''}`}
              draggable
              onDragStart={() => setDragKey(key)}
              onDragOver={e => { e.preventDefault(); }}
              onDrop={() => handleDrop(key)}
              onDragEnd={() => setDragKey(null)}
            >
              <div className="dge-field-row-head">
                <span className="dge-drag-handle" title="Drag to reorder">⋮⋮</span>
                <FieldKeyInput originalKey={key} onCommit={renameField} />
                <input
                  className="dge-field-label"
                  placeholder={`Title (${lang})`}
                  value={getI18nTitle(entry, lang)}
                  onChange={e => updateField(key, ent => setI18nTitle(ent, lang, e.target.value))}
                />
                <button
                  className="dge-field-delete"
                  onClick={() => deleteField(key)}
                  title="Delete field"
                  type="button"
                >×</button>
              </div>

              <div className="dge-field-row-controls">
                <label className="dge-control">
                  <span>Control</span>
                  <select
                    value={control}
                    onChange={e => updateField(key, ent => setUiProp(ent, 'control', e.target.value))}
                  >
                    {CONTROL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>

                <label className="dge-control">
                  <span>Width</span>
                  <select
                    value={className}
                    onChange={e => updateField(key, ent => setUiProp(ent, 'class_name', e.target.value))}
                  >
                    {WIDTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>

                <label className="dge-control">
                  <span>Scale</span>
                  <input
                    type="number"
                    value={scale}
                    placeholder="–"
                    onChange={e => {
                      const v = e.target.value;
                      const n = v === '' ? undefined : Number(v);
                      updateField(key, ent => setEntryProp(ent, 'scale', n));
                    }}
                  />
                </label>

                <Toggle
                  isSelected={!hidden}
                  onChange={selected => updateField(key, ent => setUiProp(ent, 'hidden', selected ? undefined : true))}
                  label="Visible"
                />

                <Toggle
                  isSelected={!noLabel}
                  onChange={selected => updateField(key, ent => setUiProp(ent, 'no_label', selected ? undefined : true))}
                  label="Label"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="dge-add-field">
        <input
          placeholder="new_field_name"
          value={newFieldName}
          onChange={e => setNewFieldName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addField(); }}
          spellCheck={false}
        />
        <button onClick={addField} type="button">+ Add field</button>
      </div>
    </div>
  );
}

/** Edits a field name locally and only commits the rename on blur or Enter,
 *  so per-keystroke key changes don't remount the row and drop focus. */
function FieldKeyInput({ originalKey, onCommit }: {
  originalKey: string;
  onCommit: (oldKey: string, newKey: string) => void;
}) {
  const [draft, setDraft] = useState(originalKey);
  // Re-sync if the source-of-truth key changes (e.g. via JSON edit or rename succeeded).
  useEffect(() => { setDraft(originalKey); }, [originalKey]);

  return (
    <input
      className="dge-field-key"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== originalKey) onCommit(originalKey, draft.trim());
        else setDraft(originalKey);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setDraft(originalKey); (e.target as HTMLInputElement).blur(); }
      }}
      spellCheck={false}
    />
  );
}
