import { useState } from 'react';
import { getBlock, setLanguage, getLanguage, languages } from 'xfw-get-block';
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

  return (
    <header className="planning-header">
      <div className="planning-header-left">
        <a href="/" className="planning-icon-btn planning-home-btn" title="Home">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 10l7-7 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 8.5V16a1 1 0 001 1h3v-4h2v4h3a1 1 0 001-1V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <select
          className="planning-select planning-model-select"
          value={activeLineId}
          onChange={e => switchLine(e.target.value)}
        >
          {allLines.map(line => (
            <option key={line.code} value={line.code}>{getBlock(allLines, line.code, 'title')}</option>
          ))}
        </select>
        {children}
      </div>
      <div className="planning-header-actions">
        {actions}
        <select
          className="planning-select"
          value={lang}
          onChange={e => { setLanguage(e.target.value); setLang(e.target.value); onLanguageChange?.(); }}
        >
          {languages.map(l => (
            <option key={l} value={l}>{l.toUpperCase()}</option>
          ))}
        </select>
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
