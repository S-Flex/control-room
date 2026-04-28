import { useState, useCallback } from 'react';
import { useNavItemAction, type DataGroup, type NavItem, type ResolvedField } from '@s-flex/xfw-ui';
import type { DataTable, JSONRecord, JSONValue } from '@s-flex/xfw-data';
import { useNavigate } from '@s-flex/xfw-url';
import { resolve, isFieldVisible } from './resolve';
import { Content } from './Content';
import { Field } from '../controls/Field';
import type { FieldNav } from './flow/types';

type ItemField = ResolvedField & { order?: number; class_name?: string; nav?: FieldNav; hidden_when?: unknown; no_label?: boolean; color_field?: string; scale?: number; };

function resolveFields(dataGroup: DataGroup): { fields: ItemField[]; class_name?: string; no_label?: boolean; } {
  const fc = dataGroup.field_config;
  if (!fc) return { fields: [] };
  const fcAny = fc as Record<string, unknown>;
  const class_name = fcAny.class_name as string | undefined;
  const groupNoLabel = fcAny.no_label as boolean | undefined;
  const fields = Object.entries(fc)
    .filter(([key, config]) => {
      if (key === 'class_name' || key === 'no_label') return false;
      const ui = config.ui;
      return !ui?.hidden && !ui?.table?.hidden;
    })
    .map(([key, config]) => {
      const ui = config.ui as Record<string, unknown> | undefined;
      const cfgRaw = config as Record<string, unknown>;
      const fieldNoLabel = ui?.no_label as boolean | undefined;
      return {
        key,
        i18n: config.ui?.i18n,
        control: config.ui?.control,
        input_data: config.input_data,
        order: config.ui?.order,
        class_name: cfgRaw.class_name as string | undefined
          ?? ui?.class_name as string | undefined
          ?? config.ui?.group?.class_name,
        nav: cfgRaw.nav as FieldNav | undefined,
        hidden_when: config.ui?.hidden_when,
        no_label: fieldNoLabel ?? groupNoLabel,
        color_field: ui?.color_field as string | undefined,
        scale: (cfgRaw.scale as number | undefined) ?? (ui?.scale as number | undefined),
      } as ItemField;
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return { fields, class_name, no_label: groupNoLabel };
}

function buildRowKey(row: Record<string, unknown>, primaryKeys: string[]): string {
  return primaryKeys.map(k => String(row[k] ?? '')).join('||');
}

function ItemRow({ row, fields, class_name, selectable, isSelected, onSelect }: {
  row: JSONRecord;
  fields: ItemField[];
  class_name?: string;
  selectable?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div
      className={`${class_name || ''}${selectable ? ' item-selectable' : ''}${isSelected ? ' item-selected' : ''}`.trim() || undefined}
      onClick={selectable ? onSelect : undefined}
    >
      {fields.map((f, i) => {
        if (!isFieldVisible({ hidden_when: f.hidden_when }, row)) return null;
        const val = resolve(row, f.key) as JSONValue;
        if (f.control === 'content') {
          return (
            <div key={`${f.key}-${i}`} className={f.class_name || undefined}>
              <Content data={val} />
            </div>
          );
        }
        return (
          <div key={`${f.key}-${i}`} className={f.class_name || undefined}>
            <Field field={f} value={val} row={row} />
          </div>
        );
      })}
    </div>
  );
}

export function Item({ dataGroup, data, dataTable }: { dataGroup: DataGroup; data: JSONRecord[]; dataTable?: DataTable; }) {
  if (!data || data.length === 0) return null;

  const { fields, class_name } = resolveFields(dataGroup);
  const dg = dataGroup as Record<string, unknown>;
  const rowOptions = dg.row_options as Record<string, unknown> | undefined;
  const onSelectNavItem = (rowOptions?.nav as Record<string, unknown> | undefined)?.on_select as Record<string, unknown> | undefined;
  const selectable = !!(rowOptions?.selectable) || !!onSelectNavItem;
  const primaryKeys = dataTable?.primary_keys ?? [];
  const navigate = useNavigate();
  const navAction = useNavItemAction(undefined, undefined, { extraParamKeys: primaryKeys });

  const [selectedKey, setSelectedKey] = useState<string | null>(() => {
    if (primaryKeys.length === 0) return null;
    const params = new URLSearchParams(window.location.search);
    const values = primaryKeys.map(k => params.get(k));
    if (values.some(v => v === null)) return null;
    return values.join('||');
  });

  const handleSelect = useCallback((row: JSONRecord) => {
    if (onSelectNavItem) {
      navAction(row, onSelectNavItem as NavItem, true);
      return;
    }
    const key = buildRowKey(row, primaryKeys);
    const newKey = key === selectedKey ? null : key;
    setSelectedKey(newKey);
    const keyValues = primaryKeys.map(k => ({ key: k, val: (newKey ? row[k] : null) as JSONValue }));
    navigate({ queryParams: keyValues });
  }, [primaryKeys, selectedKey, onSelectNavItem, navAction, navigate]);

  return (
    <div className="item-list">
      {data.map((row, i) => {
        const key = (row.id as string | number) ?? i;
        const rowKey = primaryKeys.length > 0 ? buildRowKey(row, primaryKeys) : null;
        return (
          <ItemRow
            key={key}
            row={row}
            fields={fields}
            class_name={class_name}
            selectable={selectable}
            isSelected={selectable && selectedKey != null && rowKey === selectedKey}
            onSelect={() => handleSelect(row)}
          />
        );
      })}
    </div>
  );
}
