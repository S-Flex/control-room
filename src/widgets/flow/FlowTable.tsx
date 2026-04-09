import type { JSONValue } from '@s-flex/xfw-data';
import type { FlowTableProps } from './types';
import { Field } from '../../controls/Field';
import { Checkbox, useGroupCheck } from '../../controls/Checkbox';
import { resolveI18nLabel } from './utils';
import { useFlowContext } from './FlowContext';

export function FlowTable({ rows, fields }: FlowTableProps) {
  if (rows.length === 0) return null;

  const { toggleChecked, toggleCheckedAll } = useFlowContext();
  const { allChecked, someChecked } = useGroupCheck(rows);

  return (
    <table className="flow-table">
      <thead>
        <tr>
          <th className="flow-table-check">
            <Checkbox
              checked={allChecked}
              indeterminate={someChecked && !allChecked}
              onChange={() => toggleCheckedAll(rows)}
            />
          </th>
          {fields.map(f => (
            <th key={f.key}>{resolveI18nLabel(f.i18n, f.key)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const isChecked = !!row.checked;
          return (
            <tr key={i} className={isChecked ? 'flow-table-row-selected' : undefined}>
              <td className="flow-table-check">
                <Checkbox
                  checked={isChecked}
                  onChange={() => toggleChecked(row)}
                />
              </td>
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
          );
        })}
      </tbody>
    </table>
  );
}
