import type { ReactNode } from 'react';
import { Fragment } from 'react';
import type { DataGroup, ResolvedField } from '@s-flex/xfw-ui';
import type { DataTable, JSONRecord, JSONValue } from '@s-flex/xfw-data';
import { resolve, isFieldVisible } from './resolve';
import { Content } from './Content';
import { Field } from '../controls/Field';
import { resolveGroupItems, relativeKey, type FieldGroupConfig } from './groupUtils';
import type { FieldNav } from './flow/types';

type StatusBarField = ResolvedField & { order?: number; class_name?: string; nav?: FieldNav; hidden_when?: unknown; no_label?: boolean; };

type StatusBarGroup = FieldGroupConfig<Record<string, unknown>>;

type StatusBarItem =
  | { kind: 'field'; field: StatusBarField }
  | { kind: 'group'; field: StatusBarField; subFields: StatusBarField[]; dataField: string };

function buildField(key: string, config: Record<string, unknown>, groupNoLabel: boolean): StatusBarField {
  const ui = config.ui as Record<string, unknown> | undefined;
  const fieldNoLabel = ui?.no_label as boolean | undefined;
  return {
    key,
    i18n: ui?.i18n as ResolvedField['i18n'],
    control: ui?.control as string | undefined,
    input_data: config.input_data as ResolvedField['input_data'],
    order: ui?.order as number | undefined,
    class_name: (config.class_name as string)
      ?? (ui?.class_name as string)
      ?? (ui?.group as Record<string, unknown> | undefined)?.class_name as string | undefined,
    nav: config.nav as FieldNav | undefined,
    hidden_when: ui?.hidden_when,
    no_label: fieldNoLabel ?? groupNoLabel,
  } as StatusBarField;
}

function mergeFieldConfig(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const baseUi = (base.ui ?? {}) as Record<string, unknown>;
  const overrideUi = (override.ui ?? {}) as Record<string, unknown>;
  return {
    ...base,
    ...override,
    ui: { ...baseUi, ...overrideUi },
  };
}

function resolveItems(
  widgetConfig: Record<string, unknown>,
  dataGroup: DataGroup,
): { items: StatusBarItem[]; class_name?: string; } {
  const fc = (widgetConfig.field_config ?? dataGroup.field_config) as Record<string, Record<string, unknown>> | undefined;
  if (!fc) return { items: [] };
  const fcAny = fc as Record<string, unknown>;
  const class_name = fcAny.class_name as string | undefined;
  const configNoLabel = (widgetConfig.no_label as boolean | undefined) ?? (fcAny.no_label as boolean | undefined);
  const groupNoLabel = configNoLabel ?? true;

  const sbc = (widgetConfig.status_bar_config
    ?? (dataGroup as unknown as Record<string, unknown>).status_bar_config) as { group?: StatusBarGroup } | undefined;
  const group = sbc?.group;

  const items = Object.entries(fc)
    .filter(([key, config]) => {
      if (key === 'class_name' || key === 'no_label') return false;
      const ui = (config as Record<string, unknown>).ui as Record<string, unknown> | undefined;
      return !ui?.hidden;
    })
    .map(([key, config]): StatusBarItem => {
      const entry = config as Record<string, unknown>;
      if (group && group.data_field === key) {
        const subFieldOverrides = group.field_config ?? {};
        const subFields = Object.entries(subFieldOverrides).map(([subKey, override]) => {
          const baseSub = (entry[subKey] ?? {}) as Record<string, unknown>;
          const merged = mergeFieldConfig(baseSub, (override ?? {}) as Record<string, unknown>);
          return buildField(subKey, merged, true);
        }).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        return {
          kind: 'group',
          field: buildField(key, entry, true),
          subFields,
          dataField: key,
        };
      }
      return { kind: 'field', field: buildField(key, entry, groupNoLabel) };
    })
    .sort((a, b) => (a.field.order ?? 999) - (b.field.order ?? 999));

  return { items, class_name };
}

function renderField(f: StatusBarField, row: JSONRecord, key: string): ReactNode {
  if (!isFieldVisible({ hidden_when: f.hidden_when }, row)) return null;
  const val = resolve(row, f.key) as JSONValue;
  if (f.control === 'content') {
    return (
      <div key={key} className={f.class_name || undefined}>
        <Content data={val} />
      </div>
    );
  }
  return (
    <div key={key} className={f.class_name || undefined}>
      <Field field={f} value={val} row={row} />
    </div>
  );
}

function renderGroupItem(
  item: JSONRecord,
  subFields: StatusBarField[],
  parentPath: string,
  groupClass: string | undefined,
  key: string,
): ReactNode {
  return (
    <div key={key} className={groupClass || undefined}>
      {subFields.map((sf, i) => {
        if (!isFieldVisible({ hidden_when: sf.hidden_when }, item)) return null;
        const val = resolve(item, relativeKey(parentPath, sf.key)) as JSONValue;
        if (sf.control === 'content') {
          return <Content key={`${sf.key}-${i}`} data={val} />;
        }
        return <Field key={`${sf.key}-${i}`} field={sf} value={val} row={item} />;
      })}
    </div>
  );
}

export function StatusBar({ widgetConfig, dataGroup, data }: {
  widgetConfig: Record<string, unknown>;
  dataGroup: DataGroup;
  data: JSONRecord[];
  dataTable?: DataTable;
}) {
  if (!data || data.length === 0) return null;

  const { items, class_name } = resolveItems(widgetConfig, dataGroup);
  const row = data[0];

  return (
    <div className={`statusbar ${class_name ?? ''}`}>
      {items.map((item, i) => {
        if (item.kind === 'field') {
          return <Fragment key={`${item.field.key}-${i}`}>{renderField(item.field, row, `${item.field.key}-${i}`)}</Fragment>;
        }
        const groupItems = resolveGroupItems(row, item.dataField);
        if (groupItems.length === 0) return null;
        return (
          <Fragment key={`${item.field.key}-${i}`}>
            {groupItems.map((gi, j) =>
              renderGroupItem(gi, item.subFields, item.dataField, item.field.class_name, `${item.field.key}-${i}-${j}`)
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
