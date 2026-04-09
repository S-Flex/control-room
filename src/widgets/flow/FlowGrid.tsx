import type { FlowLayoutProps } from './types';
import { Field } from '../../controls/Field';
import { FlowNavigation } from './FlowNavigation';

export function FlowGrid({ groups }: FlowLayoutProps) {
  return (
    <div className="flow-grid">
      {groups.map(g => (
        <div key={g.key} className="flow-grid-column">
          <div className="flow-grid-column-header">
            {g.data.map((d, i) => (
              <span key={`${d.field.key}-${i}`} className="flow-grid-header-value">
                <Field field={d.field} value={d.value} />
              </span>
            ))}
          </div>
          <div className="flow-grid-column-nav">
            {g.navs && g.navs.length > 0 && (
              <FlowNavigation navs={g.navs} rows={g.rows} />
            )}
          </div>
          <div className="flow-grid-column-body">
            {g.children}
          </div>
        </div>
      ))}
    </div>
  );
}
