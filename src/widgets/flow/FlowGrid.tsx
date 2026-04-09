import type { FlowLayoutProps } from './types';
import { Field } from '../../controls/Field';

export function FlowGrid({ groups }: FlowLayoutProps) {
  return (
    <div className="flow-grid">
      {groups.map(g => (
        <div key={g.key} className="flow-grid-column">
          <div className="flow-grid-column-header">
            {g.data.map(d => (
              <span key={d.label} className="flow-grid-header-value">
                <Field
                  value={d.value}
                  label={d.label}
                  control={d.field?.control}
                  aggregate={d.field?.aggregate}
                  inputData={d.field?.input_data}
                />
              </span>
            ))}
          </div>
          <div className="flow-grid-column-body">
            {g.children}
          </div>
        </div>
      ))}
    </div>
  );
}
