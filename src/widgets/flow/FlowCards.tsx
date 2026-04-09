import type { FlowLayoutProps } from './types';
import { Field } from '../../controls/Field';

export function FlowCards({ groups }: FlowLayoutProps) {
  return (
    <div className="flow-cards">
      {groups.map(g => (
        <div key={g.key} className="flow-card">
          <div className="flow-card-header">
            {g.data.map(d => (
              <span key={d.label} className={d.class_name ? `flow-card-header-value ${d.class_name}` : 'flow-card-header-value'}>
                <Field field={d.field} value={d.value} />
              </span>
            ))}
          </div>
          {g.children}
        </div>
      ))}
    </div>
  );
}
