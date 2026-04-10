import { useState } from 'react';
import type { FlowLayoutProps } from './types';
import { Field } from '../../controls/Field';
import { Checkbox, useGroupCheck } from '../../controls/Checkbox';
import { FlowNavigation } from './FlowNavigation';
import { useFlowContext } from './FlowContext';

export function FlowBox({ layout, groups }: FlowLayoutProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { toggleCheckedAll, selectItem } = useFlowContext();

  const isGrid = layout === 'flow-grid';

  return (
    <div
      className={isGrid ? 'flow-grid' : 'flow-card-list'}
      style={isGrid ? { gridTemplateColumns: `repeat(${groups.length}, 1fr)` } : undefined}
    >
      {groups.map(g => {
        const isCollapsed = g.colexp !== false ? (collapsed[g.key] ?? true) : false;
        const { allChecked, someChecked } = useGroupCheck(g.rows);
        const showCheckbox = g.checkable !== false;
        const showColexp = g.colexp !== false && !!g.children;

        return (
          <div
            key={g.key}
            className={`${isGrid ? 'flow-grid-column' : 'flow-card-section'}${g.selectable ? ' flow-selectable' : ''}`}
            onClick={g.selectable ? () => selectItem(g.rows[0]) : undefined}
          >
            <div className={isGrid ? 'flow-grid-column-header' : 'flow-card-header'}>
              {(showCheckbox || showColexp) && (
                <div className="flow-card-controls">
                  {showCheckbox && (
                    <Checkbox
                      checked={allChecked}
                      indeterminate={someChecked && !allChecked}
                      onChange={() => toggleCheckedAll(g.rows)}
                    />
                  )}
                  {showColexp && (
                    <button className="flow-collapse-btn" onClick={() => setCollapsed(prev => ({ ...prev, [g.key]: !isCollapsed }))}>
                      <svg className={`flow-collapse-icon${isCollapsed ? ' collapsed' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
              <div className={g.class_name || undefined}>
                {g.data.map((d, i) => (
                  <div key={d.field?.key ? `${d.field.key}-${i}` : i} className={d.class_name || undefined}>
                    <Field field={d.field} value={d.value} />
                  </div>
                ))}
              </div>
            </div>
            {g.navs && g.navs.length > 0 && (
              <div className={isGrid ? 'flow-grid-column-nav' : undefined}>
                <FlowNavigation navs={g.navs} rows={g.rows} />
              </div>
            )}
            {!isCollapsed && g.children && (
              <div className={isGrid ? 'flow-grid-column-body' : 'flow-card-body'}>
                {g.children}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
