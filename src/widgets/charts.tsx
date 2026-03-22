// Reusable chart components matching the legacy dashboard

export function ProgressCircle({ value, label }: { value: number; label: string }) {
  const circ = 2 * Math.PI * 42;
  const offset = circ * (1 - Math.min(value, 100) / 100);
  return (
    <div className="progress-circle-wrap">
      <div className="progress-circle">
        <svg viewBox="0 0 100 100">
          <circle className="bg" cx="50" cy="50" r="42" />
          <circle className="fg" cx="50" cy="50" r="42" strokeDasharray={circ} strokeDashoffset={offset} />
        </svg>
        <div className="progress-label">
          <span className="value">{value}%</span>
          <span className="label">{label}</span>
        </div>
      </div>
    </div>
  );
}

export function ProgressCircleRaw({ value, total, label }: { value: number; total: number; label: string }) {
  const circ = 2 * Math.PI * 42;
  const pct = total > 0 ? value / total : 0;
  const offset = circ * (1 - pct);
  return (
    <div className="progress-circle-wrap">
      <div className="progress-circle">
        <svg viewBox="0 0 100 100">
          <circle className="bg" cx="50" cy="50" r="42" />
          <circle className="fg" cx="50" cy="50" r="42" strokeDasharray={circ} strokeDashoffset={offset} />
        </svg>
        <div className="progress-label">
          <span className="value">{value}</span>
          <span className="label">{label}</span>
        </div>
      </div>
    </div>
  );
}

export function Gauge({ pct, label }: { pct: number; label: string }) {
  const circumHalf = Math.PI * 45;
  const offset = circumHalf * (1 - pct / 100);
  return (
    <div className="gauge-wrap">
      <div className="gauge">
        <svg viewBox="0 0 100 65">
          <path className="gauge-bg" d="M 5 55 A 45 45 0 0 1 95 55" />
          <path className="gauge-fg" d="M 5 55 A 45 45 0 0 1 95 55" strokeDasharray={circumHalf} strokeDashoffset={offset} />
        </svg>
        <div className="gauge-label">
          <span className="value">{Math.round(pct)}%</span>
          <span className="label">{label}</span>
        </div>
      </div>
    </div>
  );
}

export function BarList({ items, color }: { items: { name: string; value: number }[]; color?: string }) {
  const max = Math.max(...items.map(d => d.value), 1);
  return (
    <div className="bar-list">
      {items.map((d, i) => (
        <div className="bar-item" key={i}>
          <span className="name" title={d.name}>{d.name.split(';')[0]}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(d.value / max * 100).toFixed(1)}%`, ...(color ? { background: color } : {}) }} />
          </div>
          <span className="count">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ segments, colors }: { segments: { name: string; value: number }[]; colors: string[] }) {
  const total = segments.reduce((s, d) => s + d.value, 0) || 1;
  const r = 20, circ = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={r} fill="none" stroke="var(--bar-bg)" strokeWidth="10" />
          {segments.map((seg, i) => {
            const dash = (seg.value / total) * circ;
            const o = acc;
            acc += dash;
            return (
              <circle key={i} cx="28" cy="28" r={r} fill="none" stroke={colors[i]} strokeWidth="10"
                strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-o} />
            );
          })}
        </svg>
      </div>
      <div className="donut-legend">
        {segments.map((seg, i) => (
          <div className="donut-legend-item" key={i}>
            <span className="donut-legend-dot" style={{ background: colors[i] }} />
            <span className="donut-legend-pct">{((seg.value / total) * 100).toFixed(0)}%</span>
            <span>{seg.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VBars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="vbar-chart">
      {data.map((d, i) => (
        <div className="vbar-col" key={i}>
          <div className="vbar" style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }} />
          <span className="vbar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const w = 200, h = 50, pad = 2;
  const max = Math.max(...values, 1);
  const step = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => `${pad + i * step},${h - pad - (v / max) * (h - pad * 2)}`);
  const line = pts.join(' ');
  const first = `${pad},${h - pad}`;
  const last = `${pad + (values.length - 1) * step},${h - pad}`;

  return (
    <div className="sparkline-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <polygon className="sparkline-area" points={`${first} ${line} ${last}`} />
        <polyline className="sparkline-line" points={line} />
      </svg>
    </div>
  );
}

export function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

export function Card({ icon, title, subtitle, children, iconClass }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  iconClass?: string;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div className={`card-icon ${iconClass || ''}`}>{icon}</div>
        <div>
          <div className="card-title">{title}</div>
          {subtitle && <div className="card-subtitle">{subtitle}</div>}
        </div>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}
