import { useState } from 'react';
import type { FlowLayoutProps } from './types';
import { Field } from '../../controls/Field';
import { Checkbox, useGroupCheck } from '../../controls/Checkbox';
import { useFlowContext } from './FlowContext';

export function FlowContainer({ groups }: FlowLayoutProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { toggleCheckedAll } = useFlowContext();

  return (
    <div className="flow-container">
      {groups.map(g => {
        const isCollapsed = collapsed[g.key] ?? true;
        const { allChecked, someChecked } = useGroupCheck(g.rows);

        return (
          <div key={g.key} className="flow-container-section">
            <div className="flow-container-header">
              <div className="grid grid-cols-1 gap-1">
                <div className="col-span-1">
                  <Checkbox
                    checked={allChecked}
                    indeterminate={someChecked && !allChecked}
                    onChange={() => toggleCheckedAll(g.rows)}
                  />
                </div>
                <div className="col-span-1">
                  <button className="flow-collapse-btn" onClick={() => setCollapsed(prev => ({ ...prev, [g.key]: !isCollapsed }))}>
                    <svg className={`flow-collapse-icon${isCollapsed ? ' collapsed' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className={g.class_name || undefined}>
                {g.data.map(d => (
                  <div key={d.field.key} className={d.class_name || undefined}>
                    <Field field={d.field} value={d.value} />
                  </div>
                ))}
              </div>
            </div>
            {!isCollapsed && (
              <div className="flow-container-body">
                {g.children}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
