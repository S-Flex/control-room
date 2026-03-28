import type { JSONRecord, JSONValue } from 'xfw-data';
import { getBlock } from 'xfw-get-block';

export type DonutChartConfig = {
  group_field: string;
  title_field: string;
  color_field: string;
  aggregate_field: string;
  aggregate_fn?: string;
  show_legend?: boolean;
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

function groupKey(groupObj: JSONValue): string {
  if (typeof groupObj === 'object' && groupObj !== null && !Array.isArray(groupObj)) {
    return String((groupObj as JSONRecord).code ?? JSON.stringify(groupObj));
  }
  return String(groupObj ?? '');
}

type AggBucket = {
  key: string;
  title: string;
  color: string;
  values: number[];
};

function aggregate(values: number[], fn: string): number {
  if (values.length === 0) return 0;
  switch (fn) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'count': return values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    default: return values.reduce((a, b) => a + b, 0);
  }
}

type Group = {
  key: string;
  title: string;
  color: string;
  value: number;
  pct: number;
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function DonutChart({ widgetConfig, data }: { widgetConfig: DonutChartConfig; data: JSONRecord[] }) {
  if (!data || data.length === 0) return null;

  const fn = widgetConfig.aggregate_fn ?? 'sum';

  // Group rows by group_field
  const buckets = new Map<string, AggBucket>();
  for (const row of data) {
    const groupObj = resolve(row, widgetConfig.group_field);
    const code = groupKey(groupObj);
    const val = Number(resolve(row, widgetConfig.aggregate_field) ?? 0);

    if (!buckets.has(code)) {
      buckets.set(code, {
        key: code,
        title: getBlock(row.state ? [row.state as { code: string; block: Record<string, unknown> }] : [], code, 'title'),
        color: String(resolve(row, widgetConfig.color_field) ?? '#888'),
        values: [],
      });
    }
    buckets.get(code)!.values.push(val);
  }

  // Aggregate each bucket
  const groups: Group[] = [];
  let total = 0;
  for (const bucket of buckets.values()) {
    const value = aggregate(bucket.values, fn);
    if (value > 0) {
      total += value;
      groups.push({ key: bucket.key, title: bucket.title, color: bucket.color, value, pct: 0 });
    }
  }

  if (total <= 0) return null;

  for (const g of groups) {
    g.pct = Math.round((g.value / total) * 100);
  }

  // Sort by value descending
  groups.sort((a, b) => b.value - a.value);

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 76;
  const stroke = 22;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const producingGroup = groups.find(g => g.key === 'producing');

  return (
    <div className="donut-chart-wrap">
      <div className="donut-chart-ring">
        <svg width="100%" viewBox={`0 0 ${size} ${size}`}>
          {/* Background ring */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bar-bg)" strokeWidth={stroke} />
          {groups.map(g => {
            const dash = (g.pct / 100) * circumference;
            const gap = circumference - dash;
            const el = (
              <circle
                key={g.key}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={g.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}
              />
            );
            offset += dash;
            return el;
          })}
          <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" fontSize="28" fontWeight="800">
            {producingGroup?.pct ?? 0}%
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontWeight="500">
            OEE
          </text>
        </svg>
      </div>
      {widgetConfig.show_legend !== false && (
        <div className="donut-chart-legend">
          {groups.map(g => (
            <div key={g.key} className="donut-chart-legend-item">
              <span className="donut-chart-legend-dot" style={{ background: g.color }} />
              <span className="donut-chart-legend-label">{g.title}</span>
              <span className="donut-chart-legend-detail">{formatDuration(g.value)}</span>
              <span className="donut-chart-legend-pct">{g.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
