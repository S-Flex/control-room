import { useEffect, useState } from 'react';
import type { JSONRecord } from '@s-flex/xfw-data';
import { useQueryParams } from '@s-flex/xfw-url';
import { useTheme } from '@s-flex/xfw-ui';
import { setLanguage, getLanguage } from 'xfw-get-block';
import { Menu } from './widgets/Menu';
import type { LineConfig, MenuConfig, UiLabel } from './types';

type PageHeaderProps = {
  allLines: LineConfig[];
  uiLabels: UiLabel[];
  children?: React.ReactNode;
  actions?: React.ReactNode;
};

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

const LANGUAGE_MENU_CONFIG: MenuConfig = {
  value_field: 'code',
  text_field: 'block.i18n',
  query_param_field: 'lang',
  control: 'i18n-text',
};

export function PageHeader({ allLines, uiLabels: _uiLabels, children, actions }: PageHeaderProps) {
  const { theme, setTheme } = useTheme();
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [languages, setLanguages] = useState<JSONRecord[]>([]);
  // Tick state to re-render after `setLanguage` is called (xfw-get-block keeps
  //  its own module-level language; we have to force a render for Menu/Field
  //  to pick up the new locale).
  const [, setLangTick] = useState(0);

  useEffect(() => {
    fetch('/data/languages.json')
      .then(r => r.json())
      .then(setLanguages);
  }, []);

  // Keep xfw-get-block's language in sync with `?lang=`.
  const langParams = useQueryParams([{ key: 'lang', is_query_param: true, is_optional: true }]);
  const urlLang = langParams.find(p => p.key === 'lang')?.val as string | undefined;
  useEffect(() => {
    if (urlLang && urlLang !== getLanguage()) {
      setLanguage(urlLang);
      setLangTick(t => t + 1);
    }
  }, [urlLang]);

  return (
    <header className="planning-header">
      <div className="planning-header-left">
        <a href="/" className="planning-home-btn" title="Home">
          <img src="/img/probo.svg" alt="Home" className="planning-home-logo" />
        </a>
        <Menu menu={allLines as unknown as JSONRecord[]} menu_config={MODEL_MENU_CONFIG} />
        {children}
      </div>
      <div className="planning-header-actions">
        {actions}
        <Menu menu={languages} menu_config={LANGUAGE_MENU_CONFIG} />
        <button
          className="planning-icon-btn"
          title={dark ? 'Light mode' : 'Dark mode'}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
        >
          {dark ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M10 2V4M10 16V18M2 10H4M16 10H18M4.93 4.93L6.34 6.34M13.66 13.66L15.07 15.07M15.07 4.93L13.66 6.34M6.34 13.66L4.93 15.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M17.39 11.39A7.5 7.5 0 118.61 2.61 5.5 5.5 0 0017.39 11.39z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </button>
      </div>
    </header>
  );
}
