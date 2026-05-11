import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { JSONRecord } from '@s-flex/xfw-data';
import { useNavigate, useQueryParams, useAuxOutlet } from '@s-flex/xfw-url';
import { Checkbox } from '@s-flex/xfw-ui';
import { getBlock, setLanguage, getLanguage } from 'xfw-get-block';
import { Menu } from './widgets/Menu';
import { DropdownMenu } from './widgets/DropdownMenu';
import { useAllLines } from './hooks/useAllLines';
import { useAppNav } from './hooks/useAppNav';
import { useLanguages } from './hooks/useLanguages';
import { usePages } from './hooks/usePages';
import { useViewParams } from './hooks/useViewParams';
import { syncQueryParams } from './lib/urlSync';
import { localizeI18n } from './widgets/flow/utils';
import { buildViewUrl } from './lib/pages';
import type { AppNavAccount, AppNavItem, AppNavMenu, AppNavPageList } from './types';

type AppHeaderProps = {
  /** Page-specific menu items (e.g. Material / Locations on Inflow).
   *  Rendered inline next to the data-driven nav clusters so they read
   *  as part of the app menu bar. Use `<DropdownMenu variant="inline">`
   *  or `<Menu variant="inline">` to match the surrounding triggers. */
  extras?: React.ReactNode;
};

function navLabel(item: AppNavItem): string {
  return localizeI18n(item.block.i18n) ?? item.block.title;
}

function NavDropdown({
  item,
  openTrigger,
  setOpenTrigger,
  children,
}: {
  item: AppNavItem;
  openTrigger: string | null;
  setOpenTrigger: (next: string | null) => void;
  children: React.ReactNode;
}) {
  const open = openTrigger === item.code;
  return (
    <DropdownMenu
      variant="inline"
      label={navLabel(item)}
      open={open}
      onToggle={() => setOpenTrigger(open ? null : item.code)}
      onClose={() => setOpenTrigger(null)}
      fullWidth={false}
    >
      {children}
    </DropdownMenu>
  );
}

export function AppHeader({ extras }: AppHeaderProps = {}) {
  const navItems = useAppNav();
  const allLines = useAllLines();
  const languages = useLanguages();
  const { content } = usePages();
  const viewParams = useViewParams();
  // body.dark is the single source of truth for theme — index.html ships
  // with `<body class="dark">` and ControlRoomPage's dblclick handler also
  // toggles the body class. Aligning here keeps the two in sync.
  const [dark, setDark] = useState(() => document.body.classList.contains('dark'));
  // Tick to re-render after `setLanguage` (xfw-get-block keeps its own
  // module-level language; we need a render to pick up the new locale).
  const [, setLangTick] = useState(0);
  const [openTrigger, setOpenTrigger] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  // The Nester sidebar is currently inflow-only. When more pages adopt it,
  // promote this from a page check to a per-page registry similar to
  // `visible_on` on app-nav items.
  const isInflow = location.pathname === '/inflow-manual' || location.pathname === '/inflow-auto';
  const sidebarPath = useAuxOutlet({ outlet: 'sidebar' });
  const nesterOpen = sidebarPath === '/nester';

  const langParams = useQueryParams([{ key: 'lang', is_query_param: true, is_optional: true }]);
  const urlLang = langParams.find(p => p.key === 'lang')?.val as string | undefined;
  useEffect(() => {
    if (urlLang && urlLang !== getLanguage()) {
      setLanguage(urlLang);
      setLangTick(t => t + 1);
    }
  }, [urlLang]);

  const currentLang = (urlLang ?? getLanguage()) as string;

  const handlePickLanguage = (code: string) => {
    setOpenTrigger(null);
    // Apply the language synchronously *before* writing the URL: the
    // useQueryParams subscription fires immediately on syncQueryParams, so
    // every consumer re-renders straight away — and they all read
    // `getLanguage()` at render time. If we let the useEffect below apply
    // the language, that re-render lands one step behind the URL change
    // (Dutch → click English → renders in Dutch → click German →
    //  renders in English).
    setLanguage(code);
    syncQueryParams({ lang: code });
  };
  const handleToggleTheme = () => {
    setOpenTrigger(null);
    const next = !dark;
    document.body.classList.toggle('dark', next);
    setDark(next);
  };

  const renderPageList = (item: AppNavPageList) => (
    <NavDropdown key={item.code} item={item} openTrigger={openTrigger} setOpenTrigger={setOpenTrigger}>
      <div className="dropdown-menu-list">
        {item.pages.map(p => {
          const isActive = location.pathname === p.path;
          const label = getBlock(content, p.code, 'title') || p.code;
          // `useLocation().search` doesn't track URL writes that come
          // through xfw-url's syncQueryParams (it bypasses React
          // Router's history). Read window.location.search at render
          // (and again on click below) so we always see the live URL.
          const target = buildViewUrl({ path: p.path, label }, window.location.search, viewParams);
          return (
            <Link
              key={p.path}
              to={target}
              className={`dropdown-menu-item${isActive ? ' active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                setOpenTrigger(null);
                // Use xfw-url's navigate (not react-router's) so the
                // current URL's `//` aux-route separator doesn't get
                // collapsed by React Router's resolveTo on the way
                // through. Bare main path also clears any aux routes
                // — sidebars are page-specific.
                navigate(buildViewUrl({ path: p.path, label }, window.location.search, viewParams));
              }}
            >
              {label}
            </Link>
          );
        })}
        {isInflow && (
          <>
            <div className="dropdown-menu-divider" />
            <div className={`dropdown-menu-item dropdown-menu-check${nesterOpen ? ' active' : ''}`}>
              <Checkbox
                isSelected={nesterOpen}
                onChange={() => navigate(nesterOpen ? '(sidebar:)' : '(sidebar:nester)')}
                label="Nester"
              />
            </div>
          </>
        )}
      </div>
    </NavDropdown>
  );

  const renderMenu = (item: AppNavMenu) => {
    if (item.visible_on && !item.visible_on.includes(location.pathname)) return null;
    // Today only `models.json` is wired as a menu source — already
    // loaded by `useAllLines`. When more nav menus need different
    // sources, route on `item.src` here.
    const items = item.src === 'models.json' ? (allLines as unknown as JSONRecord[]) : [];
    if (items.length === 0) return null;
    return (
      <Menu
        key={item.code}
        menu={items}
        menu_config={item.menu_config}
        variant="inline"
        triggerLabel={navLabel(item)}
      />
    );
  };

  const renderAccount = (item: AppNavAccount) => (
    <NavDropdown key={item.code} item={item} openTrigger={openTrigger} setOpenTrigger={setOpenTrigger}>
      <div className="dropdown-menu-list">
        {languages.length > 0 && (
          <>
            <div className="dropdown-menu-section-label">Language</div>
            {languages.map(lang => {
              const code = lang.code as string;
              const i18n = (lang.block as { i18n?: unknown; title?: string } | undefined)?.i18n;
              const fallback = (lang.block as { title?: string } | undefined)?.title ?? code;
              // Show each language in its OWN native name (pass the
              // entry's code as the locale, not the current UI lang).
              const label = localizeI18n(i18n, code) ?? fallback;
              return (
                <button
                  type="button"
                  key={code}
                  className={`dropdown-menu-item${code === currentLang ? ' active' : ''}`}
                  onClick={() => handlePickLanguage(code)}
                >
                  {label}
                </button>
              );
            })}
            <div className="dropdown-menu-divider" />
          </>
        )}
        <div className="dropdown-menu-section-label">Theme</div>
        <button type="button" className="dropdown-menu-item" onClick={handleToggleTheme}>
          {dark ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </NavDropdown>
  );

  const renderItem = (item: AppNavItem) => {
    if (item.type === 'page-list') return renderPageList(item);
    if (item.type === 'menu') return renderMenu(item);
    if (item.type === 'account') return renderAccount(item);
    return null;
  };

  const [leftItems, rightItems] = useMemo(() => {
    const left: AppNavItem[] = [];
    const right: AppNavItem[] = [];
    for (const item of navItems) (item.align === 'right' ? right : left).push(item);
    return [left, right];
  }, [navItems]);

  return (
    <header className="app-header">
      <div className="app-header-left">
        <a href="/" className="planning-home-btn" title="Home">
          <img src="/img/probo.svg" alt="Home" className="planning-home-logo" />
        </a>
        {leftItems.map(renderItem)}
        {extras}
      </div>
      <div className="app-header-actions">
        {rightItems.map(renderItem)}
      </div>
    </header>
  );
}
