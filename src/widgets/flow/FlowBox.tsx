import { useState } from 'react';
import type { FlowGroupData, FlowLayoutProps, FlowNavItem } from './types';
import { Field } from '../../controls/Field';
import { Checkbox } from '@s-flex/xfw-ui';
import { useGroupCheck } from '../../controls/Checkbox';
import { resolveI18nLabel } from './utils';
import { useFlowContext } from './FlowContext';
import { ColumnGridPagerControls, useColumnGridPager, type ColumnGridPager } from '../useColumnGridPager';

function FlowBoxItem({ g, isGrid, pager }: { g: FlowGroupData; isGrid: boolean; pager?: ColumnGridPager; }) {
  const [isCollapsed, setCollapsed] = useState(g.colexp !== false);
  const { allChecked, someChecked } = useGroupCheck(g.rows);
  const { selectedGroupKey, toggleCheckedAll, selectItem, mergeData } = useFlowContext();

  const showCheckbox = g.checkable !== false;
  const showColexp = g.colexp === true;
  const isSelected = !!g.selectable && g.key === selectedGroupKey;

  const handleNavClick = (nav: FlowNavItem) => {
    if (!nav.data || nav.data.length === 0) return;
    mergeData(g.rows, nav.data);
  };

  const hasChecked = g.rows.some(r => r.checked);

  const handleSelect = g.selectable ? (e: React.MouseEvent) => {
    // Stop propagation so clicks on a deeper selectable group don't also
    // fire the ancestor's select handler — deepest level wins.
    e.stopPropagation();
    selectItem(g.rows[0], g.key, g.on_select);
  } : undefined;

  const handleColexp = (e: React.MouseEvent) => {
    // Toggling collapse must never double as a selection change.
    e.stopPropagation();
    setCollapsed(c => !c);
  };

  return (
    <div
      className={`${isGrid ? 'column-grid-column' : 'flow-card-section'}${g.selectable ? ' flow-selectable' : ''}${isSelected ? ' flow-selected' : ''}`}
      onClick={handleSelect}
    >
      <div className={`${isGrid ? 'column-grid-column-header' : 'flow-card-header'}${(showCheckbox || showColexp) ? ' has-controls' : ''}`}>
        {(showCheckbox || showColexp) && (
          <div className="flow-card-controls">
            {showCheckbox && (
              <Checkbox
                isSelected={allChecked}
                isIndeterminate={someChecked && !allChecked}
                onChange={() => toggleCheckedAll(g.rows)}
              />
            )}
            {showColexp && (
              <button className="flow-collapse-btn" onClick={handleColexp}>
                <svg className={`flow-collapse-icon${isCollapsed ? ' collapsed' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className={g.class_name || undefined}>
          {g.i18n
            ? <span className="flow-box-title">{resolveI18nLabel(g.i18n, g.key)}</span>
            : g.data.map((d, i) => (
              <div key={d.field?.key ? `${d.field.key}-${i}` : i} className={d.class_name || undefined}>
                <Field field={d.field} value={d.value} showLabel row={g.rows.length === 1 ? g.rows[0] : undefined} />
              </div>
            ))
          }
        </div>
        {pager && <ColumnGridPagerControls pager={pager} />}
      </div>
      {g.navs && g.navs.length > 0 && (
        <div className={isGrid ? 'column-grid-column-nav' : undefined}>
          <div className="flow-nav">
            {g.navs.map(nav => (
              <button
                key={nav.nav_item_id}
                className="flow-nav-btn"
                disabled={!hasChecked || !nav.data}
                onClick={() => handleNavClick(nav)}
              >
                {resolveI18nLabel(nav.i18n, nav.nav_item_id)}
              </button>
            ))}
          </div>
        </div>
      )}
      {!isCollapsed && g.children && (
        <div className={isGrid ? 'column-grid-column-body' : 'flow-card-body'}>
          {g.children}
        </div>
      )}
    </div>
  );
}

export function FlowBox({ layout, groups }: FlowLayoutProps) {
  const isGrid = layout === 'flow-grid';
  const { gridRef, pager, handleScroll, isNarrow } = useColumnGridPager(groups.length);

  if (!isGrid) {
    return (
      <div className="flow-card-list">
        {groups.map(g => <FlowBoxItem key={g.key} g={g} isGrid={false} />)}
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className={`column-grid column-grid--aligned${isNarrow ? ' is-narrow' : ''}`}
      onScroll={handleScroll}
    >
      {groups.map(g => <FlowBoxItem key={g.key} g={g} isGrid pager={pager} />)}
    </div>
  );
}
