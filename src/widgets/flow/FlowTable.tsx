import type { JSONValue } from '@s-flex/xfw-data';
import type { FlowTableProps, FlowResolvedField } from './types';
import { Field } from '../../controls/Field';
import { toDisplayLabel } from '@s-flex/xfw-ui';
import { getLanguage } from 'xfw-get-block';

function resolveColumnLabel(field: FlowResolvedField): string {
  if (field.i18n) {
    const lang = getLanguage();
    const entry = (field.i18n as Record<string, Record<string, string> | undefined>)[lang];
    if (entry?.title) return entry.title;
    if (entry?.label) return entry.label;
    for (const v of Object.values(field.i18n as Record<string, Record<string, string> | undefined>)) {
      if (v?.title) return v.title;
      if (v?.label) return v.label;
    }
  }
  return toDisplayLabel(field.key);
}

export function FlowTable({ rows, fields }: FlowTableProps) {
  if (rows.length === 0) return null;

  return (
    <table className="flow-table">
      <thead>
        <tr>
          {fields.map(f => (
            <th key={f.key}>{resolveColumnLabel(f)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={(row.id as string | number) ?? i}>
            {fields.map(f => {
              const val = row[f.key] as JSONValue;
              const isNum = typeof val === 'number';
              return (
                <td key={f.key} className={isNum ? 'flow-table-num' : undefined}>
                  <Field field={f} value={val} />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
