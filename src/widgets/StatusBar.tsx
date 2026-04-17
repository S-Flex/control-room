import type { DataGroup, ResolvedField } from '@s-flex/xfw-ui';
import type { DataTable, JSONRecord, JSONValue } from '@s-flex/xfw-data';
import { resolve, isFieldVisible } from './resolve';
import { Content } from './Content';
import { Field } from '../controls/Field';
import type { FieldNav } from './flow/types';

type StatusBarField = ResolvedField & { order?: number; class_name?: string; nav?: FieldNav; hidden_when?: unknown; no_label?: boolean; };

function resolveFields(widgetConfig: Record<string, unknown>, dataGroup: DataGroup): { fields: StatusBarField[]; class_name?: string; no_label?: boolean; } {
  const fc = (widgetConfig.field_config ?? dataGroup.field_config) as Record<string, Record<string, unknown>> | undefined;
  if (!fc) return { fields: [] };
  const fcAny = fc as Record<string, unknown>;
  const class_name = fcAny.class_name as string | undefined;
  const configNoLabel = (widgetConfig.no_label as boolean | undefined) ?? (fcAny.no_label as boolean | undefined);
  const groupNoLabel = configNoLabel ?? true;
  const fields = Object.entries(fc)
    .filter(([key, config]) => {
      if (key === 'class_name' || key === 'no_label') return false;
      const ui = (config as Record<string, unknown>).ui as Record<string, unknown> | undefined;
      return !ui?.hidden;
    })
    .map(([key, config]) => {
      const entry = config as Record<string, unknown>;
      const ui = entry.ui as Record<string, unknown> | undefined;
      const fieldNoLabel = ui?.no_label as boolean | undefined;
      return {
        key,
        i18n: ui?.i18n as ResolvedField['i18n'],
        control: ui?.control as string | undefined,
        input_data: entry.input_data as ResolvedField['input_data'],
        order: ui?.order as number | undefined,
        class_name: (entry.class_name as string)
          ?? (ui?.class_name as string)
          ?? (ui?.group as Record<string, unknown> | undefined)?.class_name as string | undefined,
        nav: entry.nav as FieldNav | undefined,
        hidden_when: ui?.hidden_when,
        no_label: fieldNoLabel ?? groupNoLabel,
      } as StatusBarField;
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return { fields, class_name, no_label: groupNoLabel };
}

export function StatusBar({ widgetConfig, dataGroup, data }: {
  widgetConfig: Record<string, unknown>;
  dataGroup: DataGroup;
  data: JSONRecord[];
  dataTable?: DataTable;
}) {
  if (!data || data.length === 0) return null;

  const { fields, class_name } = resolveFields(widgetConfig, dataGroup);
  const row = data[0];

  return (
    <div className={`statusbar ${class_name ?? ''}`}>
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
