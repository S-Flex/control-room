import { useCallback } from 'react';
import { useQueryParams } from '@s-flex/xfw-url';
import { getLanguage } from 'xfw-get-block';
import { syncQueryParams } from '../lib/urlSync';

/** Header nav configuration as it appears on a `data_group.header.navs[]`
 *  entry — see `data/sitrep.json` for the canonical shape. */
type HeaderMenuItem = {
  nav_item_id?: string;
  type?: string;
  i18n?: Record<string, { text?: string; title?: string }>;
  params?: Array<{ key: string; val: unknown; is_query_param?: boolean }>;
};
type HeaderNav = {
  nav_item_id?: string;
  type?: string;
  menu?: HeaderMenuItem[];
};

/** Renders `data_group.header.navs` — currently `tabstrip` is the only
 *  supported `nav.type`. Each menu item is a button that, when clicked,
 *  applies its `params` to the URL query string via `syncQueryParams`.
 *  Selection state is derived live from `useQueryParams`, so buttons stay
 *  in sync with browser back/forward and external URL writes. */
export function DataGroupHeaderNavs({ navs }: { navs: HeaderNav[] }) {
  if (!navs || navs.length === 0) return null;
  return (
    <div className="datagroup-header-navs">
      {navs.map((nav, i) => {
        if (nav.type === 'tabstrip' && nav.menu && nav.menu.length > 0) {
          return <Tabstrip key={nav.nav_item_id ?? `n-${i}`} menu={nav.menu} />;
        }
        return null;
      })}
    </div>
  );
}

function Tabstrip({ menu }: { menu: HeaderMenuItem[] }) {
  // Collect every distinct query-param key the buttons might toggle. We
  // subscribe to all of them in one call so the active-state check stays in
  // sync with the URL (back/forward, external writes via syncQueryParams).
  const paramKeys = Array.from(new Set(
    menu.flatMap(item =>
      (item.params ?? [])
        .filter(p => p.is_query_param)
        .map(p => p.key)
    )
  ));
  const currentParams = useQueryParams(
    paramKeys.map(key => ({ key, is_query_param: true, is_optional: true })),
  );
  const currentMap = new Map(currentParams.map(p => [p.key, p.val]));

  return (
    <div className="datagroup-tabstrip">
      {menu.map((item, i) => (
        <TabButton
          key={item.nav_item_id ?? `i-${i}`}
          item={item}
          currentMap={currentMap}
        />
      ))}
    </div>
  );
}

function TabButton({ item, currentMap }: {
  item: HeaderMenuItem;
  currentMap: Map<string, unknown>;
}) {
  const lang = getLanguage();
  const i18nEntry = item.i18n?.[lang] ?? Object.values(item.i18n ?? {})[0];
  const label = i18nEntry?.text ?? i18nEntry?.title ?? item.nav_item_id ?? '';

  const queryParams = (item.params ?? []).filter(p => p.is_query_param);
  // A button is "active" when every one of its query params currently matches
  // the URL. Compare as strings — useQueryParams auto-coerces numeric values
  // to numbers, so "0" in the JSON matches `0` in the URL.
  const isSelected = queryParams.length > 0 && queryParams.every(p => {
    const cur = currentMap.get(p.key);
    return String(cur ?? '') === String(p.val ?? '');
  });

  const handleClick = useCallback(() => {
    const updates: Record<string, string | null> = {};
    for (const p of queryParams) {
      updates[p.key] = p.val == null ? null : String(p.val);
    }
    // The aux-route guard patches replaceState to dispatch a synthetic
    // `replaceState` DOM event, which `useQueryParams` subscribes to — the
    // selected-state recomputes automatically without a manual dispatch.
    syncQueryParams(updates);
  }, [queryParams]);

  return (
    <button
      type="button"
      className={`datagroup-tab${isSelected ? ' is-selected' : ''}`}
      aria-pressed={isSelected}
      onClick={handleClick}
    >
      {label}
    </button>
  );
}
