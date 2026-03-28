import type { Resource } from './types';

function oeeColor(v: number) {
  if (v >= 75) return '#079455';
  if (v >= 50) return '#eab308';
  return '#d92d20';
}

function makePie(producing: number, stopped: number, inactive: number) {
  const total = producing + stopped + inactive || 1;
  const p1 = (producing / total) * 360;
  const p2 = (stopped / total) * 360;
  return `conic-gradient(#079455 0deg ${p1}deg, #d92d20 ${p1}deg ${p1 + p2}deg, #94969c ${p1 + p2}deg 360deg)`;
}

const stateColorMap: Record<string, string> = {
  producing: '#4ade80',
  starved: '#22c55e',
  'starved.operator': '#16a34a',
  blocked: '#15803d',
  idle: '#a16207',
  breakdown: '#dc2626',
  offline: '#d1d5db',
  stock: '#a8856c',
  queue: '#78604e',
};

function stateToColor(state: string): string {
  return stateColorMap[state] || '#888';
}

function stateToBorderClass(state: string): string {
  if (state === 'breakdown') return 'border-red';
  if (state === 'idle') return 'border-yellow';
  if (state === 'offline') return 'border-purple';
  return 'border-green';
}

function statusClass(s: string) {
  return 'st-' + (s || 'idle').replace(/\s+/g, '-');
}

function StockQueueCard({ eq }: { eq: Resource }) {
  const isQueue = eq.type === 'queue';
  const total = eq.materials?.reduce((s, m) => s + m.quantity, 0) ?? 0;
  const maxQty = Math.max(...(eq.materials?.map(m => m.quantity) ?? [1]));

  return (
    <div className="stock-card-3d" style={{ borderColor: stateToColor(eq.oee_group?.state ?? 'offline') }}>
      <div className="equip-header">
        <div className="equip-header-left">
          <span className="equip-dot" style={{ background: stateToColor(eq.oee_group?.state ?? 'offline') }} />
          <span className="equip-card-name">{eq.name}</span>
        </div>
        <span className="stock-type-badge" style={{ background: stateToColor(eq.oee_group?.state ?? 'offline') }}>
          {isQueue ? 'queue' : 'stock'}
        </span>
      </div>
      <div className="stock-total">
        <span className="stock-total-value">{total}</span>
        <span className="stock-total-label">items</span>
      </div>
      <div className="stock-materials">
        {eq.materials?.map((m, i) => (
          <div key={i} className="stock-mat-row">
            <span className="stock-mat-name" title={m.name}>{m.name}</span>
            <div className="stock-mat-bar-track">
              <div
                className="stock-mat-bar-fill"
                style={{ width: `${(m.quantity / maxQty) * 100}%`, background: stateToColor(eq.oee_group?.state ?? 'offline') }}
              />
            </div>
            <span className="stock-mat-qty">{m.quantity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MachineCard({ eq }: { eq: Resource }) {
  const oee = eq.oee_group?.oee || 0;
  const st = eq.status || eq.oee_group?.state || eq.type;

  return (
    <div className={`equip-card-3d ${stateToBorderClass(eq.oee_group?.state ?? 'offline')}`}>
      <div className="equip-header">
        <div className="equip-header-left">
          <span className="equip-dot" style={{ background: stateToColor(eq.oee_group?.state ?? 'offline') }} />
          <span className="equip-card-name">{eq.name}</span>
        </div>
        <span className={`equip-status-badge ${statusClass(st)}`}>{st}</span>
      </div>
      <div className="equip-col">
        <div className="equip-col-label">OEE</div>
        <div className="equip-oee-row">
          <div style={{ textAlign: 'center' }}>
            <div className="equip-oee-val" style={{ color: oeeColor(oee) }}>{oee}%</div>
            <div className="equip-oee-label">overall</div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div className="equip-oee-bar">
              <div className="equip-oee-fill" style={{ width: `${oee}%`, background: oeeColor(oee) }} />
            </div>
          </div>
        </div>
        <div className="equip-pie">
          <div className="equip-pie-chart" style={{ background: makePie(eq.oee_group?.producing || 0, eq.oee_group?.stopped || 0, eq.oee_group?.inactive || 0) }} />
          <div className="equip-pie-legend">
            <div className="equip-pie-item"><span className="equip-pie-dot" style={{ background: '#079455' }} />{eq.oee_group?.producing || 0}% prod</div>
            <div className="equip-pie-item"><span className="equip-pie-dot" style={{ background: '#d92d20' }} />{eq.oee_group?.stopped || 0}% stop</div>
            <div className="equip-pie-item"><span className="equip-pie-dot" style={{ background: '#94969c' }} />{eq.oee_group?.inactive || 0}% idle</div>
          </div>
        </div>
      </div>
      <div className="equip-col">
        <div className="equip-col-label">Production</div>
        <div className="equip-stat-row"><span className="equip-stat-label">Errors</span><span className={`equip-stat-val${(eq.oee_group?.errors || 0) > 15 ? ' val-red' : ''}`}>{eq.oee_group?.errors || 0}</span></div>
        <div className="equip-stat-row"><span className="equip-stat-label">Downtime</span><span className="equip-stat-val">{eq.oee_group?.downtime || '—'}</span></div>
        <div className="equip-stat-row"><span className="equip-stat-label">Jobs today</span><span className="equip-stat-val">{eq.oee_group?.jobsToday || 0}</span></div>
        <div className="equip-stat-row"><span className="equip-stat-label">Material</span><span className="equip-stat-val">{eq.oee_group?.material || '—'}</span></div>
      </div>
    </div>
  );
}

export function EquipCard({ eq }: { eq: Resource }) {
  if (eq.type === 'queue' || eq.type === 'stock') {
    return <StockQueueCard eq={eq} />;
  }
  return <MachineCard eq={eq} />;
}
