import type { FlowLayoutProps } from './types';
import { Field } from '../../controls/Field';
import { Checkbox, useGroupCheck } from '../../controls/Checkbox';
import { useFlowContext } from './FlowContext';

export function FlowCards({ groups }: FlowLayoutProps) {
  const { toggleCheckedAll } = useFlowContext();

  return (
    <div className="flow-cards">
      {groups.map(g => {
        const { allChecked, someChecked } = useGroupCheck(g.rows);

        return (
          <div key={g.key} className="flow-card">
            <div className="flow-card-header">
              <Checkbox
                checked={allChecked}
                indeterminate={someChecked && !allChecked}
                onChange={() => toggleCheckedAll(g.rows)}
              />
              <div className={g.class_name || undefined}>
                {g.data.map(d => (
                  <div key={d.field.key} className={d.class_name || undefined}>
                    <Field field={d.field} value={d.value} />
                  </div>
                ))}
              </div>
            </div>
            {g.children}
          </div>
        );
      })}
    </div>
  );
}
