import type { JSONRecord } from '@s-flex/xfw-data';
import type { FlowNavItem } from './types';
import { useFlowContext } from './FlowContext';
import { resolveI18nLabel } from './utils';

export function FlowNavigation({ navs, rows }: {
  navs: FlowNavItem[];
  rows: JSONRecord[];
}) {
  const { mergeData } = useFlowContext();

  const handleClick = (nav: FlowNavItem) => {
    console.log('FlowNavigation click', JSON.parse(JSON.stringify(nav)));
    if (!nav.data || nav.data.length === 0) return;
    mergeData(rows, nav.data);
  };

  const hasChecked = rows.some(r => r.checked);

  return (
    <div className="flow-nav">
      {navs.map(nav => (
        <button
          key={nav.nav_item_id}
          className="flow-nav-btn"
          disabled={!hasChecked || !nav.data}
          onClick={() => handleClick(nav)}
        >
          {resolveI18nLabel(nav.i18n, nav.nav_item_id)}
        </button>
      ))}
    </div>
  );
}
