import type { JSONRecord, JSONValue } from 'xfw-data';

export type InkGaugeConfig = {
  ink_field: string;
  level_field: string;
  color_field: string;
  expiration_date_field?: string;
  level_relative_to: 'total' | 'full';
};

function resolve(row: JSONRecord, path: string | undefined): JSONValue {
  if (!path) return null;
  let val: JSONValue = row;
  for (const seg of path.split('.')) {
    if (val === null || typeof val !== 'object' || Array.isArray(val)) return null;
    val = (val as JSONRecord)[seg] ?? null;
  }
  return val;
}

type InkEntry = {
  name: string;
  level: number;
  color: string;
  expiration: string | null;
  pct: number;
};

export function InkGauge({ widgetConfig, data }: { widgetConfig: InkGaugeConfig; data: JSONRecord[] }) {
  if (!data || data.length === 0) return null;

  const isFull = widgetConfig.level_relative_to === 'full';
  const totalLevel = isFull ? 100 : data.reduce((s, row) => s + Number(resolve(row, widgetConfig.level_field) ?? 0), 0);
  if (totalLevel <= 0) return null;

  const entries: InkEntry[] = data.map(row => {
    const level = Number(resolve(row, widgetConfig.level_field) ?? 0);
    const expField = widgetConfig.expiration_date_field;
    const expVal = expField ? resolve(row, expField) : null;
    return {
      name: String(resolve(row, widgetConfig.ink_field) ?? ''),
      level,
      color: String(resolve(row, widgetConfig.color_field) ?? '#888'),
      expiration: expVal && typeof expVal === 'string' ? expVal : null,
      pct: isFull ? level : (totalLevel > 0 ? Math.round((level / totalLevel) * 100) : 0),
    };
  });

  const now = new Date();

  return (
    <div className="ink-gauge-wrap">
      {entries.map((ink, i) => {
        const daysLeft = ink.expiration
          ? Math.ceil((new Date(ink.expiration).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        const isExpiring = daysLeft !== null && daysLeft <= 5;

        return (
          <div key={i} className="ink-gauge-row">
            <div className="ink-gauge-header">
              <span className="ink-gauge-dot" style={{ background: ink.color }} />
              <span className="ink-gauge-name">{ink.name}</span>
              {ink.expiration && (
                <span className={`ink-gauge-expires${isExpiring ? ' expiring' : ''}`}>
                  {isExpiring ? `${daysLeft}d left` : ink.expiration}
                </span>
              )}
            </div>
            <div className="ink-gauge-bar">
              <div className="ink-gauge-fill" style={{ width: `${ink.pct}%`, background: ink.color }} />
            </div>
            <div className="ink-gauge-pct">{ink.pct}%</div>
          </div>
        );
      })}
    </div>
  );
}
