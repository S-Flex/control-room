import { useCallback, useState } from 'react';
import { getBlock, setLanguage, getLanguage, languages } from 'xfw-get-block';
import { DropdownMenu } from './widgets/DropdownMenu';
import type { LineConfig, UiLabel } from './types';

type PageHeaderProps = {
  allLines: LineConfig[];
  activeLineId: string;
  switchLine: (id: string) => void;
  uiLabels: UiLabel[];
  onLanguageChange?: () => void;
  children?: React.ReactNode;
  actions?: React.ReactNode;
};

export function PageHeader({ allLines, activeLineId, switchLine, uiLabels, onLanguageChange, children, actions }: PageHeaderProps) {
  const [dark, setDark] = useState(() => document.body.classList.contains('dark'));
  const [lang, setLang] = useState(() => getLanguage());
  const [modelOpen, setModelOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const handleSwitchLine = useCallback((id: string) => {
    switchLine(id);
    setModelOpen(false);
  }, [switchLine]);

  const handleSwitchLang = useCallback((l: string) => {
    setLanguage(l);
    setLang(l);
    setLangOpen(false);
    onLanguageChange?.();
  }, [onLanguageChange]);

  const modelLabel = getBlock(allLines, activeLineId, 'title');

  return (
    <header className="planning-header">
      <div className="planning-header-left">
        <a href="/" className="planning-home-btn" title="Home">
          <img src="/img/probo.svg" alt="Home" className="planning-home-logo" />
        </a>
        <DropdownMenu
          label={modelLabel}
          open={modelOpen}
          onToggle={() => setModelOpen(o => !o)}
          onClose={() => setModelOpen(false)}
          fullWidth={false}
        >
          <div className="dropdown-menu-list">
            {allLines.map(line => (
              <button
                key={line.code}
                className={`dropdown-menu-item${line.code === activeLineId ? ' active' : ''}`}
                onClick={() => handleSwitchLine(line.code)}
              >
                {getBlock(allLines, line.code, 'title')}
              </button>
            ))}
          </div>
        </DropdownMenu>
        {children}
      </div>
      <div className="planning-header-actions">
        {actions}
        <DropdownMenu
          label={lang.toUpperCase()}
          open={langOpen}
          onToggle={() => setLangOpen(o => !o)}
          onClose={() => setLangOpen(false)}
          fullWidth={false}
        >
          <div className="dropdown-menu-list">
            {languages.map(l => (
              <button
                key={l}
                className={`dropdown-menu-item${l === lang ? ' active' : ''}`}
                onClick={() => handleSwitchLang(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </DropdownMenu>
        <button
          className="planning-icon-btn"
          title={dark ? 'Light mode' : 'Dark mode'}
          onClick={() => { setDark(d => { document.body.classList.toggle('dark', !d); return !d; }); }}
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
