import type { TickerData } from './types';

export function Ticker({ type, data }: { type: 'highlight' | 'alert'; data: TickerData }) {
  const contentMap: Record<string, string> = {};
  data.content.forEach(c => { contentMap[c.code] = c.block.title; });

  const entries = type === 'highlight' ? data.highlight : data.alert;
  const items = entries.map(e => contentMap[e.code] || e.code);
  // Duplicate for seamless scrolling
  const all = [...items, ...items];

  return (
    <div className={`ticker ticker-${type}`}>
      <div className="ticker-track">
        <div className="ticker-content">
          {all.map((text, i) => (
            <span key={i}>
              {i > 0 && <span className="ticker-dot" />}
              <span>{text}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
