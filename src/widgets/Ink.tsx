import { useState } from 'react';

type InkColor = {
  name: string;
  color: string;
  level: number;
  capacity: number;
  expiration_date: string | null;
};

type InkUsage = {
  name: string;
  color: string;
  status_report: number;
  print_production: number;
};

type InkStock = {
  name: string;
  color: string;
  expiration_date: string;
};

const INK_COLORS: InkColor[] = [
  { name: 'Cyan',          color: '#00bcd4', level: 820,  capacity: 1000, expiration_date: null },
  { name: 'Magenta',       color: '#e91e63', level: 640,  capacity: 1000, expiration_date: '2026-04-02' },
  { name: 'Yellow',        color: '#ffc107', level: 910,  capacity: 1000, expiration_date: null },
  { name: 'Black',         color: '#333333', level: 450,  capacity: 1000, expiration_date: '2026-04-02' },
  { name: 'Light Cyan',    color: '#80deea', level: 780,  capacity: 1000, expiration_date: null },
  { name: 'Light Magenta', color: '#f48fb1', level: 550,  capacity: 1000, expiration_date: null },
];

const INK_USAGE: InkUsage[] = [
  { name: 'Cyan',          color: '#00bcd4', status_report: 295, print_production: 280 },
  { name: 'Magenta',       color: '#e91e63', status_report: 372, print_production: 350 },
  { name: 'Yellow',        color: '#ffc107', status_report: 248, print_production: 230 },
  { name: 'Black',         color: '#333333', status_report: 485, print_production: 460 },
  { name: 'Light Cyan',    color: '#80deea', status_report: 152, print_production: 140 },
  { name: 'Light Magenta', color: '#f48fb1', status_report: 208, print_production: 190 },
];

const INK_STOCK: InkStock[] = [
  { name: 'Cyan',    color: '#00bcd4', expiration_date: '2026-04-28' },
  { name: 'Magenta', color: '#e91e63', expiration_date: '2026-04-25' },
  { name: 'Black',   color: '#333333', expiration_date: '2026-04-30' },
];

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function CollapseButton({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button className="sidebar-section-title" onClick={onToggle}>
      <svg className={`sidebar-collapse-icon${open ? '' : ' collapsed'}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}

function InkLevels() {
  return (
    <div className="ink-section">
      {INK_COLORS.map(ink => {
        const pct = Math.round((ink.level / ink.capacity) * 100);
        const days = ink.expiration_date ? daysUntil(ink.expiration_date) : null;
        const isExpiring = days !== null && days <= 7;

        return (
          <div key={ink.name} className="ink-row">
            <div className="ink-row-header">
              <span className="ink-dot" style={{ background: ink.color }} />
              <span className="ink-name">{ink.name}</span>
              <span className="ink-ml">{ink.level} / {ink.capacity} ml</span>
            </div>
            <div className="ink-bar">
              <div className="ink-bar-fill" style={{ width: `${pct}%`, background: ink.color }} />
            </div>
            {ink.expiration_date && (
              <div className={`ink-expiration-banner${isExpiring ? ' expiring' : ''}`}>
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                  <path d="M10 6v4m0 4h.01M3.07 16h13.86c1.1 0 1.8-1.2 1.27-2.14L11.27 3.43a1.47 1.47 0 00-2.54 0L1.8 13.86C1.27 14.8 1.97 16 3.07 16z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Expires {ink.expiration_date}{isExpiring ? ` — ${days} days left` : ''}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InkUsageTable() {
  return (
    <div className="ink-section">
      <div className="ink-usage-header-row">
        <span className="ink-usage-col-name" />
        <span className="ink-usage-col">Status</span>
        <span className="ink-usage-col">Print</span>
        <span className="ink-usage-col">Diff</span>
      </div>
      {INK_USAGE.map(ink => {
        const diff = ink.status_report - ink.print_production;
        return (
          <div key={ink.name} className="ink-usage-row">
            <span className="ink-usage-col-name">
              <span className="ink-dot" style={{ background: ink.color }} />
              {ink.name}
            </span>
            <span className="ink-usage-col">{ink.status_report} ml</span>
            <span className="ink-usage-col">{ink.print_production} ml</span>
            <span className="ink-usage-col ink-usage-diff">{diff} ml</span>
          </div>
        );
      })}
      <div className="ink-usage-total">
        <span className="ink-usage-col-name">Total purge/errors</span>
        <span className="ink-usage-col" />
        <span className="ink-usage-col" />
        <span className="ink-usage-col ink-usage-diff">
          {INK_USAGE.reduce((s, i) => s + (i.status_report - i.print_production), 0)} ml
        </span>
      </div>
    </div>
  );
}

function InkStockExpiring() {
  return (
    <div className="ink-section">
      {INK_STOCK.map(ink => {
        const days = daysUntil(ink.expiration_date);
        return (
          <div key={ink.name} className="ink-stock-row">
            <span className="ink-dot" style={{ background: ink.color }} />
            <span className="ink-name">{ink.name}</span>
            <span className="ink-stock-expires">
              {ink.expiration_date} — {days} days
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Ink() {
  const [levelsOpen, setLevelsOpen] = useState(true);
  const [usageOpen, setUsageOpen] = useState(true);
  const [stockOpen, setStockOpen] = useState(true);

  return (
    <div className="ink-widget">
      <CollapseButton label="Ink Levels" open={levelsOpen} onToggle={() => setLevelsOpen(v => !v)} />
      {levelsOpen && <InkLevels />}

      <div className="ink-divider" />

      <CollapseButton label="Ink Usage Today" open={usageOpen} onToggle={() => setUsageOpen(v => !v)} />
      {usageOpen && <InkUsageTable />}

      <div className="ink-divider" />

      <CollapseButton label="Stock, near expiration" open={stockOpen} onToggle={() => setStockOpen(v => !v)} />
      {stockOpen && <InkStockExpiring />}
    </div>
  );
}
