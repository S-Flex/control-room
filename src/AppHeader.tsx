import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { JSONRecord } from '@s-flex/xfw-data';
import { useNavigate, useQueryParams, useAuxOutlet } from '@s-flex/xfw-url';
import { Checkbox } from '@s-flex/xfw-ui';
import { setLanguage, getLanguage } from 'xfw-get-block';
import { Menu } from './widgets/Menu';
import { DropdownMenu } from './widgets/DropdownMenu';
import { useAllLines } from './hooks/useAllLines';
import { useViewParams } from './hooks/useViewParams';
import { syncQueryParams } from './lib/urlSync';
import { localizeI18n } from './widgets/flow/utils';
import { VIEW_PAGES, PAGES_WITH_MODEL, buildViewUrl } from './lib/pages';
import type { MenuConfig } from './types';

const MODEL_MENU_CONFIG: MenuConfig = {
  value_field: 'code',
  text_field: 'block.i18n',
  query_param_field: 'model',
  control: 'i18n-text',
  items_field: 'production_lines',
  menu_config: {
    value_field: 'production_line_id',
    text_field: 'block.i18n',
    query_param_field: 'production_line_id',
    control: 'i18n-text',
  },
};

type AppHeaderProps = {
  /** Page-specific menu items (e.g. Material / Locations on Inflow).
   *  Rendered inline next to View / Model so they read as part of the
   *  app menu bar. Use `<DropdownMenu variant="inline">` or
   *  `<Menu variant="inline">` to match the surrounding triggers. */
  extras?: React.ReactNode;
};

export function AppHeader({ extras }: AppHeaderProps = {}) {
  const allLines = useAllLines();
  const viewParams = useViewParams();
  // body.dark is the single source of truth for theme — index.html ships
  // with `<body class="dark">` and ControlRoomPage's dblclick handler also
  // toggles the body class. Aligning here keeps the two in sync.
  const [dark, setDark] = useState(() => document.body.classList.contains('dark'));
  const [languages, setLanguages] = useState<JSONRecord[]>([]);
  // Tick to re-render after `setLanguage` (xfw-get-block keeps its own
  // module-level language; we need a render to pick up the new locale).
  const [, setLangTick] = useState(0);
  const [viewOpen, setViewOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  // The Nester sidebar is currently inflow-only. When more pages adopt it,
  // promote this from a page check to a per-page registry similar to
  // PAGES_WITH_MODEL.
  const isInflow = location.pathname === '/inflow-manual' || location.pathname === '/inflow-auto';
  const sidebarPath = useAuxOutlet({ outlet: 'sidebar' });
  const nesterOpen = sidebarPath === '/nester';

  useEffect(() => {
    fetch('/data/languages.json').then(r => r.json()).then(setLanguages);
  }, []);

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
    setAccountOpen(false);
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
    setAccountOpen(false);
    const next = !dark;
    document.body.classList.toggle('dark', next);
    setDark(next);
  };

  return (
    <header className="app-header">
      <div className="app-header-left">
        <a href="/" className="planning-home-btn" title="Home">
          <img src="/img/probo.svg" alt="Home" className="planning-home-logo" />
        </a>
        <DropdownMenu
          variant="inline"
          label="View"
          open={viewOpen}
          onToggle={() => setViewOpen(o => !o)}
          onClose={() => setViewOpen(false)}
          fullWidth={false}
        >
          <div className="dropdown-menu-list">
            {VIEW_PAGES.map(p => {
              const isActive = location.pathname === p.path;
              // `useLocation().search` doesn't track URL writes that come
              // through xfw-url's syncQueryParams (it bypasses React
              // Router's history). Read window.location.search at render
              // (and again on click below) so we always see the live URL.
              const liveSearch = typeof window !== 'undefined' ? window.location.search : '';
              const target = buildViewUrl(p, liveSearch, viewParams);
              return (
                <Link
                  key={p.path}
                  to={target}
                  className={`dropdown-menu-item${isActive ? ' active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setViewOpen(false);
                    // Use xfw-url's navigate (not react-router's) so the
                    // current URL's `//` aux-route separator doesn't get
                    // collapsed by React Router's resolveTo on the way
                    // through. Bare main path also clears any aux routes
                    // — sidebars are page-specific.
                    navigate(buildViewUrl(p, window.location.search, viewParams));
                  }}
                >
                  {p.label}
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
        </DropdownMenu>
        {PAGES_WITH_MODEL.has(location.pathname) && allLines.length > 0 && (
          <Menu
            menu={allLines as unknown as JSONRecord[]}
            menu_config={MODEL_MENU_CONFIG}
            variant="inline"
            triggerLabel="Model"
          />
        )}
        {extras}
      </div>
      <div className="app-header-actions">
        <DropdownMenu
          variant="inline"
          label="Account"
          open={accountOpen}
          onToggle={() => setAccountOpen(o => !o)}
          onClose={() => setAccountOpen(false)}
          fullWidth={false}
        >
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
        </DropdownMenu>
      </div>
    </header>
  );
}
