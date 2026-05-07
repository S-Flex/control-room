import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate as useRouterNavigate } from 'react-router-dom';
import type { JSONRecord } from '@s-flex/xfw-data';
import { useQueryParams } from '@s-flex/xfw-url';
import { setLanguage, getLanguage } from 'xfw-get-block';
import { Menu } from './widgets/Menu';
import { DropdownMenu } from './widgets/DropdownMenu';
import { useAllLines } from './hooks/useAllLines';
import { syncQueryParams } from './lib/urlSync';
import { localizeI18n } from './widgets/flow/utils';
import { VIEW_PAGES } from './lib/pages';
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

export function AppHeader() {
  const allLines = useAllLines();
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
  const routerNavigate = useRouterNavigate();

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
              return (
                <Link
                  key={p.path}
                  to={p.path}
                  className={`dropdown-menu-item${isActive ? ' active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setViewOpen(false);
                    routerNavigate(p.path);
                  }}
                >
                  {p.label}
                </Link>
              );
            })}
          </div>
        </DropdownMenu>
        {allLines.length > 0 && (
          <Menu
            menu={allLines as unknown as JSONRecord[]}
            menu_config={MODEL_MENU_CONFIG}
            variant="inline"
            triggerLabel="Model"
          />
        )}
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
