import type { JSONValue } from '@s-flex/xfw-data';
import type { FlowTableProps } from './types';
import { Field } from '../../controls/Field';
import { resolveLabel } from './utils';

export function FlowTable({ rows, fields, fieldMap }: FlowTableProps) {
  if (rows.length === 0) return null;

  return (
    <table className="flow-table">
      <thead>
        <tr>
          {fields.map(f => (
            <th key={f.key}>{fieldMap ? resolveLabel(fieldMap, f.key) : f.key}</th>
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
                  <Field
                    value={val}
                    label={f.key}
                    control={f.control}
                    aggregate={f.aggregate}
                    inputData={f.input_data}
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
