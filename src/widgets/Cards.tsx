import { useState, useCallback } from 'react';
import type { DataGroup } from '@s-flex/xfw-ui';
import type { DataTable, JSONRecord, JSONValue } from '@s-flex/xfw-data';
import type { NavItem, ResolvedField } from '@s-flex/xfw-ui';
import { useNavItemAction } from '@s-flex/xfw-ui';
import { useNavigate } from '@s-flex/xfw-url';
import { resolve } from './resolve';
import { Content } from './Content';
import { Field } from '../controls/Field';

import type { FieldNav } from './flow/types';

type CardField = ResolvedField & { order?: number; class_name?: string; nav?: FieldNav; };

function resolveFields(dataGroup: DataGroup): { fields: CardField[]; class_name?: string; } {
  const fc = dataGroup.field_config;
  if (!fc) return { fields: [] };
  const class_name = (fc as Record<string, unknown>).class_name as string | undefined;
  const fields = Object.entries(fc)
    .filter(([key, config]) => {
      if (key === 'class_name') return false;
      const ui = config.ui;
      return !ui?.hidden && !ui?.table?.hidden;
    })
    .map(([key, config]) => {
      const ui = config.ui as Record<string, unknown> | undefined;
      return {
        key,
        i18n: config.ui?.i18n,
        control: config.ui?.control,
        input_data: config.input_data,
        order: config.ui?.order,
        class_name: (config as Record<string, unknown>).class_name as string | undefined
          ?? ui?.class_name as string | undefined
          ?? config.ui?.group?.class_name,
        nav: (config as Record<string, unknown>).nav as FieldNav | undefined,
      } as CardField;
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return { fields, class_name };
}

function buildRowKey(row: Record<string, unknown>, primaryKeys: string[]): string {
  return primaryKeys.map(k => String(row[k] ?? '')).join('||');
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r} ${g} ${b} / ${Math.round(alpha * 100)}%)`;
}

function cardBackground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  if (r > 200 && g < 80) return hexToRgba(hex, 0.48);
  if (r > 200 && g < 180) return hexToRgba(hex, 0.48);
  return hexToRgba(hex, 0.20);
}

function Card({ row, fields, class_name, selectable, isSelected, onSelect }: {
  row: JSONRecord;
  fields: CardField[];
  class_name?: string;
  selectable?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const stateColor = resolve(row, 'state.color') as string | null;

  return (
    <div
      className={`flow-card-section${selectable ? ' flow-selectable' : ''}${isSelected ? ' flow-selected' : ''}`}
      style={stateColor ? { backgroundColor: cardBackground(stateColor) } : undefined}
      onClick={selectable ? onSelect : undefined}
    >
      <div className="flow-card-header">
        <div className={class_name || undefined}>
          {fields.map((f, i) => {
            const val = resolve(row, f.key) as JSONValue;
            if (f.control === 'content') {
              return (
                <div key={`${f.key}-${i}`} className={f.class_name || undefined}>
                  <Content data={val} />
                </div>
              );
            }
            const noLabel = f.control === 'badge' || f.control === 'icon-map' || (f as any).aggregate;
            return (
              <div key={`${f.key}-${i}`} className={`${f.class_name || ''}${noLabel ? ' field-no-label' : ''}`.trim() || undefined}>
                <Field field={f} value={val} showLabel row={row} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Cards({ dataGroup, data, dataTable }: { dataGroup: DataGroup; data: JSONRecord[]; dataTable?: DataTable; }) {
  if (!data || data.length === 0) return null;

  const { fields, class_name } = resolveFields(dataGroup);
  const rowOptions = (dataGroup as Record<string, unknown>).row_options as Record<string, unknown> | undefined;
  const selectable = rowOptions?.selectable as boolean | undefined;
  const onSelectNavItem = (rowOptions?.nav as Record<string, unknown> | undefined)?.on_select;
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
    const key = buildRowKey(row, primaryKeys);
    const newKey = key === selectedKey ? null : key;
    setSelectedKey(newKey);

    if (onSelectNavItem && newKey) {
      navAction(row, onSelectNavItem as NavItem, true);
    } else {
      const keyValues = primaryKeys.map(k => ({ key: k, val: (newKey ? row[k] : null) as JSONValue }));
      navigate({ queryParams: keyValues });
    }
  }, [primaryKeys, selectedKey, onSelectNavItem, navAction, navigate]);

  return (
    <div className="flow-card-list">
      {data.map((row, i) => {
        const key = (row.id as string | number) ?? i;
        const rowKey = primaryKeys.length > 0 ? buildRowKey(row, primaryKeys) : null;
        return (
          <Card
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
