import { useState } from 'react';
import type { FlowLayoutProps } from './types';
import { Field } from '../../controls/Field';

export function FlowContainer({ groups }: FlowLayoutProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  console.log('FlowContainer render', groups);   

  return (
    <div className="flow-container">
      {groups.map(g => {
        const isCollapsed = collapsed[g.key] ?? true;
        return (
          <div key={g.key} className="flow-container-section">
            <div className="flow-container-header">
              <button
                className="flow-collapse-btn"
                onClick={() => setCollapsed(prev => ({ ...prev, [g.key]: !isCollapsed }))}
              >
                <svg className={`flow-collapse-icon${isCollapsed ? ' collapsed' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className={g.class_name || undefined}>
                {g.data.map(d => (
                  <div key={d.label} className={d.class_name || undefined}>
                    <Field
                      value={d.value}
                      label={d.label}
                      control={d.field?.control}
                      aggregate={d.field?.aggregate}
                      inputData={d.field?.input_data}
                    />
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
