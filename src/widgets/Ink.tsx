import { useEffect, useState } from 'react';
import { getBlock } from 'xfw-get-block';

type InkColor = {
  code: string;
  block: { title?: string; i18n?: Record<string, Record<string, string>> };
  color: string;
  level: number;
  capacity: number;
  expiration_date: string | null;
};

type InkUsage = {
  code: string;
  block: { title?: string; i18n?: Record<string, Record<string, string>> };
  color: string;
  status_report: number;
  print_production: number;
};

type InkStock = {
  code: string;
  block: { title?: string; i18n?: Record<string, Record<string, string>> };
  color: string;
  expiration_date: string;
};

type Label = {
  code: string;
  block: { title?: string; i18n?: Record<string, Record<string, string>> };
};

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

function CollapseButton({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button className="datagroup-title" onClick={onToggle}>
      <svg className={`datagroup-collapse-icon${open ? '' : ' collapsed'}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}

function InkLevels({ colors, labels }: { colors: InkColor[]; labels: Label[] }) {
  const ml = getBlock(labels, 'ml', 'title');
  return (
    <div className="ink-section">
      {colors.map(ink => {
        const pct = Math.round((ink.level / ink.capacity) * 100);
        const days = ink.expiration_date ? daysUntil(ink.expiration_date) : null;
        const isExpiring = days !== null && days <= 7;
        const name = getBlock(colors, ink.code, 'title');

        return (
          <div key={ink.code} className="ink-row">
            <div className="ink-row-header">
              <span className="ink-dot" style={{ background: ink.color }} />
              <span className="ink-name">{name}</span>
              <span className="ink-ml">{ink.level} / {ink.capacity} {ml}</span>
            </div>
            <div className="ink-bar">
              <div className="ink-bar-fill" style={{ width: `${pct}%`, background: ink.color }} />
            </div>
            {ink.expiration_date && (
              <div className={`ink-expiration-banner${isExpiring ? ' expiring' : ''}`}>
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                  <path d="M10 6v4m0 4h.01M3.07 16h13.86c1.1 0 1.8-1.2 1.27-2.14L11.27 3.43a1.47 1.47 0 00-2.54 0L1.8 13.86C1.27 14.8 1.97 16 3.07 16z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {fmt(getBlock(labels, 'expires', 'title'), { date: ink.expiration_date })}
                {isExpiring && <> — {fmt(getBlock(labels, 'days_left', 'title'), { n: days! })}</>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InkUsageTable({ usage, labels }: { usage: InkUsage[]; labels: Label[] }) {
  const ml = getBlock(labels, 'ml', 'title');
  return (
    <div className="ink-section">
      <div className="ink-usage-header-row">
        <span className="ink-usage-col-name" />
        <span className="ink-usage-col">{getBlock(labels, 'status', 'title')}</span>
        <span className="ink-usage-col">{getBlock(labels, 'print', 'title')}</span>
        <span className="ink-usage-col">{getBlock(labels, 'diff', 'title')}</span>
      </div>
      {usage.map(ink => {
        const diff = ink.status_report - ink.print_production;
        const name = getBlock(usage, ink.code, 'title');
        return (
          <div key={ink.code} className="ink-usage-row">
            <span className="ink-usage-col-name">
              <span className="ink-dot" style={{ background: ink.color }} />
              {name}
            </span>
            <span className="ink-usage-col">{ink.status_report} {ml}</span>
            <span className="ink-usage-col">{ink.print_production} {ml}</span>
            <span className="ink-usage-col ink-usage-diff">{diff} {ml}</span>
          </div>
        );
      })}
      <div className="ink-usage-total">
        <span className="ink-usage-col-name">{getBlock(labels, 'total_purge_errors', 'title')}</span>
        <span className="ink-usage-col" />
        <span className="ink-usage-col" />
        <span className="ink-usage-col ink-usage-diff">
          {usage.reduce((s, i) => s + (i.status_report - i.print_production), 0)} {ml}
        </span>
      </div>
    </div>
  );
}

function InkStockExpiring({ stock, labels }: { stock: InkStock[]; labels: Label[] }) {
  return (
    <div className="ink-section">
      {stock.map(ink => {
        const days = daysUntil(ink.expiration_date);
        const name = getBlock(stock, ink.code, 'title');
        return (
          <div key={ink.code} className="ink-stock-row">
            <span className="ink-dot" style={{ background: ink.color }} />
            <span className="ink-name">{name}</span>
            <span className="ink-stock-expires">
              {ink.expiration_date} — {fmt(getBlock(labels, 'days', 'title'), { n: days })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Ink() {
  const [colors, setColors] = useState<InkColor[]>([]);
  const [usage, setUsage] = useState<InkUsage[]>([]);
  const [stock, setStock] = useState<InkStock[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [levelsOpen, setLevelsOpen] = useState(true);
  const [usageOpen, setUsageOpen] = useState(true);
  const [stockOpen, setStockOpen] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/data/ink_colors.json').then(r => r.json()),
      fetch('/data/ink_usage.json').then(r => r.json()),
      fetch('/data/ink_stock.json').then(r => r.json()),
      fetch('/data/ink_labels.json').then(r => r.json()),
    ]).then(([c, u, s, l]) => {
      setColors(c);
      setUsage(u);
      setStock(s);
      setLabels(l);
    });
  }, []);

  if (!labels.length) return null;

  return (
    <div className="ink-widget">
      <CollapseButton label={getBlock(labels, 'ink_levels', 'title')} open={levelsOpen} onToggle={() => setLevelsOpen(v => !v)} />
      {levelsOpen && <InkLevels colors={colors} labels={labels} />}

      <div className="ink-divider" />

      <CollapseButton label={getBlock(labels, 'ink_usage_today', 'title')} open={usageOpen} onToggle={() => setUsageOpen(v => !v)} />
      {usageOpen && <InkUsageTable usage={usage} labels={labels} />}

      <div className="ink-divider" />

      <CollapseButton label={getBlock(labels, 'stock_near_expiration', 'title')} open={stockOpen} onToggle={() => setStockOpen(v => !v)} />
      {stockOpen && <InkStockExpiring stock={stock} labels={labels} />}
    </div>
  );
}
