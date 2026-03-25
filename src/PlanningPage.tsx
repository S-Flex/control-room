import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThreeModelView, type CameraState, type JSONRecord } from 'xfw-three';
import {
  useNavigate,
  useQueryParams,
  useAuxOutlet,
  AuxRouteProvider,
} from 'xfw-url';
import type { Resource, StateLogEntry } from './viewer/types';
import './app.css';

type LineConfig = {
  id: string;
  name: string;
  glb: string;
  camera?: CameraState;
};

type ModelsData = { lines: LineConfig[]; };

type ResourceStateEntry = {
  code: string;
  color: string;
  oee_set?: string;
  block: {
    title: string;
    i18n?: Record<string, { title: string; }>;
  };
};
type StateSet = {
  code: string;
  states: { code: string }[];
};
type ResourceStatesData = {
  content: ResourceStateEntry[];
  states: { code: string; }[];
  state_sets?: StateSet[];
};

function buildStateMap(data: ResourceStatesData): Map<string, ResourceStateEntry> {
  const map = new Map<string, ResourceStateEntry>();
  for (const entry of data.content) map.set(entry.code, entry);
  return map;
}

const inkColorMap: Record<string, string> = {
  cyan: '#00bcd4',
  magenta: '#e91e63',
  yellow: '#ffeb3b',
  black: '#333333',
};

function getExpiringInks(res: Resource, days = 5): { color: string; amount: number; expires: string; }[] {
  if (!res.inks) return [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const result: { color: string; amount: number; expires: string; }[] = [];
  for (const [color, ink] of Object.entries(res.inks)) {
    const expDate = new Date(ink.expires);
    if (expDate <= cutoff) {
      result.push({ color, amount: ink.amount, expires: ink.expires });
    }
  }
  return result;
}

/* ---- State timeline SVG ---- */
type TimelineSegment = {
  state: string;
  color: string;
  startMin: number;
  endMin: number;
  label: string;
  jobName: string | null;
};

function buildTimeline(
  entries: StateLogEntry[],
  stateColorMap: Map<string, ResourceStateEntry>,
  dayStart: Date,
  dayEnd: Date,
): TimelineSegment[] {
  // Sort ascending by start_at
  const sorted = [...entries].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const startMs = dayStart.getTime();
  const endMs = dayEnd.getTime();
  const segments: TimelineSegment[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const entryStart = new Date(entry.start_at).getTime();
    const entryEnd = i + 1 < sorted.length ? new Date(sorted[i + 1].start_at).getTime() : endMs;
    // Clamp to day range
    const segStart = Math.max(entryStart, startMs);
    const segEnd = Math.min(entryEnd, endMs);
    if (segStart >= segEnd) continue;

    const stateEntry = stateColorMap.get(entry.state);
    segments.push({
      state: entry.state,
      color: stateEntry?.color ?? '#888',
      startMin: (segStart - startMs) / 60000,
      endMin: (segEnd - startMs) / 60000,
      label: stateEntry?.block.title ?? entry.state,
      jobName: entry.job_name,
    });
  }
  return segments;
}

function StateTimelineBar({ segments, totalMinutes, startHour, barHeight, svgWidth, svgHeight, fontSize }: {
  segments: TimelineSegment[];
  totalMinutes: number;
  startHour: number;
  barHeight: number;
  svgWidth: number;
  svgHeight: number;
  fontSize: number;
}) {
  const [hover, setHover] = useState<{ seg: TimelineSegment; x: number; y: number; } | null>(null);
  const hours = totalMinutes / 60;

  return (
    <>
      <svg
        width="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMinYMin meet"
        className="planning-timeline-svg"
      >
        {Array.from({ length: Math.floor(hours) + 1 }, (_, i) => {
          const x = (i * 60 / totalMinutes) * svgWidth;
          const hour = startHour + i;
          return (
            <g key={i}>
              <line x1={x} y1={barHeight} x2={x} y2={barHeight + 4} stroke="var(--text-muted)" strokeWidth="0.5" />
              <text x={x} y={barHeight + fontSize + 6} fill="var(--text-muted)" fontSize={fontSize} textAnchor="middle">{hour}:00</text>
            </g>
          );
        })}
        {segments.map((seg, i) => {
          const x = (seg.startMin / totalMinutes) * svgWidth;
          const w = Math.max(1, ((seg.endMin - seg.startMin) / totalMinutes) * svgWidth);
          return (
            <rect
              key={i}
              x={x}
              y={0}
              width={w}
              height={barHeight}
              fill={seg.color}
              onMouseEnter={e => setHover({ seg, x: e.clientX, y: e.clientY })}
              onMouseMove={e => setHover({ seg, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            />
          );
        })}
      </svg>
      {hover && (
        <div className="planning-timeline-tooltip" style={{ left: hover.x + 12, top: hover.y - 10 }}>
          <div className="planning-timeline-tooltip-state" style={{ color: hover.seg.color }}>{hover.seg.label}</div>
          <div className="planning-timeline-tooltip-dur">
            {Math.round(hover.seg.endMin - hover.seg.startMin)} min
          </div>
          {hover.seg.jobName && (
            <div className="planning-timeline-tooltip-job">{hover.seg.jobName}</div>
          )}
        </div>
      )}
    </>
  );
}

function StateTimelineSvg({ segments, totalMinutes, startHour, date, onHoverChange }: {
  segments: TimelineSegment[];
  totalMinutes: number;
  startHour: number;
  date: string;
  onHoverChange?: (data: { segments: TimelineSegment[]; date: string } | null) => void;
}) {
  return (
    <div
      className="planning-timeline-wrap"
      onMouseEnter={() => onHoverChange?.({ segments, date })}
      onMouseLeave={() => onHoverChange?.(null)}
    >
      <StateTimelineBar
        segments={segments}
        totalMinutes={totalMinutes}
        startHour={startHour}
        barHeight={28}
        svgWidth={600}
        svgHeight={48}
        fontSize={8}
      />
    </div>
  );
}

/* ---- Sidebar content component ---- */
type OeeGroupData = { key: string; title: string; color: string; minutes: number; pct: number };

function OeeDonutChart({ groups }: { groups: OeeGroupData[] }) {
  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const r = 44;
  const stroke = 14;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="planning-oee-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {groups.filter(g => g.minutes > 0).map(g => {
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
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text-primary)" fontSize="18" fontWeight="700">
          {groups.find(g => g.key === 'producing')?.pct ?? 0}%
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="500">
          OEE
        </text>
      </svg>
      <div className="planning-oee-donut-legend">
        {groups.filter(g => g.minutes > 0).map(g => (
          <div key={g.key} className="planning-oee-donut-legend-item">
            <span className="planning-oee-donut-legend-dot" style={{ background: g.color }} />
            <span className="planning-oee-donut-legend-label">{g.title}</span>
            <span className="planning-oee-donut-legend-pct">{g.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResourceSidebarContent({ resource, stateMap, menuItem, stateLog, selectedDates, onTimelineHover, stateSets }: {
  resource: Resource;
  stateMap: Map<string, ResourceStateEntry>;
  menuItem: string;
  stateLog: StateLogEntry[];
  selectedDates: string[];
  onTimelineHover: (data: { segments: TimelineSegment[]; date: string } | null) => void;
  stateSets: StateSet[];
}) {
  const state = stateMap.get(resource.state);
  if (!state) return null;

  // Filter state log for this resource
  const resourceEntries = resource.resource_uid
    ? stateLog.filter(e => e.resource_uid === resource.resource_uid)
    : [];

  return (
    <div className="planning-sidebar-content">
      <div className="planning-sidebar-title-row">
        <span className="planning-sidebar-dot" style={{ background: state.color }} />
        <h3 className="planning-sidebar-name">{resource.name}</h3>
      </div>
      <div className="planning-sidebar-status" style={{ background: state.color + '20', color: state.color }}>
        {state.block.title}
      </div>

      {menuItem === 'oee' && resourceEntries.length > 0 ? (() => {
        // Build all segments across selected dates
        const allSegments: TimelineSegment[] = [];
        selectedDates.forEach(date => {
          const dayStart = new Date(date + 'T06:00:00+00:00');
          const dayEnd = new Date(date + 'T24:00:00+00:00');
          allSegments.push(...buildTimeline(resourceEntries, stateMap, dayStart, dayEnd));
        });

        // Aggregate minutes per state
        const stateMins: Record<string, number> = {};
        allSegments.forEach(seg => {
          stateMins[seg.state] = (stateMins[seg.state] ?? 0) + (seg.endMin - seg.startMin);
        });
        const totalMins = Object.values(stateMins).reduce((s, v) => s + v, 0);

        // Aggregate by state_set using content entries for color/title
        const setGroups: OeeGroupData[] = stateSets.map(ss => {
          const minutes = ss.states.reduce((s, st) => s + (stateMins[st.code] ?? 0), 0);
          const setEntry = stateMap.get('set.' + ss.code);
          return {
            key: ss.code,
            title: setEntry?.block.title ?? ss.code,
            color: setEntry?.color ?? '#888',
            minutes,
            pct: totalMins > 0 ? Math.round((minutes / totalMins) * 100) : 0,
          };
        });

        return (
          <div className="planning-sidebar-section">
            <div className="planning-sidebar-section-title">State Timeline</div>
            {selectedDates.map(date => {
              const dayStart = new Date(date + 'T06:00:00+00:00');
              const dayEnd = new Date(date + 'T24:00:00+00:00');
              const segments = buildTimeline(resourceEntries, stateMap, dayStart, dayEnd);
              if (segments.length === 0) return null;
              return (
                <div key={date} className="planning-sidebar-timeline-day">
                  <div className="planning-sidebar-timeline-date">{date}</div>
                  <StateTimelineSvg segments={segments} totalMinutes={18 * 60} startHour={6} date={date} onHoverChange={onTimelineHover} />
                </div>
              );
            })}

            <div className="planning-sidebar-section-title" style={{ marginTop: 16 }}>OEE Breakdown</div>
            <OeeDonutChart groups={setGroups} />

            <div className="planning-sidebar-section-title" style={{ marginTop: 16 }}>State Duration</div>
            <table className="planning-oee-table">
              <thead>
                <tr><th>State</th><th>Duration</th><th>%</th></tr>
              </thead>
              <tbody>
                {Object.entries(stateMins)
                  .sort((a, b) => b[1] - a[1])
                  .map(([code, mins]) => {
                    const entry = stateMap.get(code);
                    const pct = totalMins > 0 ? Math.round((mins / totalMins) * 100) : 0;
                    const h = Math.floor(mins / 60);
                    const m = Math.round(mins % 60);
                    return (
                      <tr key={code}>
                        <td>
                          <span className="planning-oee-table-dot" style={{ background: entry?.color ?? '#888' }} />
                          {entry?.block.title ?? code}
                        </td>
                        <td>{h}h {m}m</td>
                        <td>{pct}%</td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>Total</strong></td>
                  <td><strong>{Math.floor(totalMins / 60)}h {Math.round(totalMins % 60)}m</strong></td>
                  <td><strong>100%</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })() : menuItem === 'inks' && resource.inks ? (
        <div className="planning-sidebar-section">
          <div className="planning-sidebar-section-title">Ink Levels</div>
          <div className="planning-sidebar-inks">
            {Object.entries(resource.inks).map(([color, ink]) => {
              const expDate = new Date(ink.expires);
              const now = new Date();
              const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const isExpiring = daysLeft <= 5;
              return (
                <div key={color} className="planning-sidebar-ink-row">
                  <div className="planning-sidebar-ink-header">
                    <span className="planning-sidebar-ink-color-dot" style={{ background: inkColorMap[color] || '#888' }} />
                    <span className="planning-sidebar-ink-name">{color.charAt(0).toUpperCase() + color.slice(1)}</span>
                    <span className={`planning-sidebar-ink-expires${isExpiring ? ' expiring' : ''}`}>
                      {isExpiring ? `${daysLeft}d left` : ink.expires}
                    </span>
                  </div>
                  <div className="planning-sidebar-ink-bar">
                    <div className="planning-sidebar-ink-fill" style={{ width: `${ink.amount}%`, background: inkColorMap[color] || '#888' }} />
                  </div>
                  <div className="planning-sidebar-ink-pct">{ink.amount}%</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="planning-sidebar-section">
            <div className="planning-sidebar-section-title">OEE</div>
            <div className="planning-sidebar-oee">
              <div className="planning-sidebar-oee-value">{resource.oee ?? '—'}%</div>
              <div className="planning-sidebar-oee-bar">
                <div className="planning-sidebar-oee-fill" style={{ width: `${resource.oee ?? 0}%`, background: state.color }} />
              </div>
            </div>
          </div>
          <div className="planning-sidebar-section">
            <div className="planning-sidebar-section-title">Performance</div>
            <div className="planning-sidebar-stats">
              <div className="planning-sidebar-stat"><span className="planning-sidebar-stat-label">Producing</span><span className="planning-sidebar-stat-value">{resource.producing ?? '—'}%</span></div>
              <div className="planning-sidebar-stat"><span className="planning-sidebar-stat-label">Stopped</span><span className="planning-sidebar-stat-value">{resource.stopped ?? '—'}%</span></div>
              <div className="planning-sidebar-stat"><span className="planning-sidebar-stat-label">Inactive</span><span className="planning-sidebar-stat-value">{resource.inactive ?? '—'}%</span></div>
            </div>
          </div>
          <div className="planning-sidebar-section">
            <div className="planning-sidebar-section-title">Details</div>
            <div className="planning-sidebar-stats">
              <div className="planning-sidebar-stat"><span className="planning-sidebar-stat-label">Type</span><span className="planning-sidebar-stat-value">{resource.type}</span></div>
              <div className="planning-sidebar-stat"><span className="planning-sidebar-stat-label">Errors</span><span className="planning-sidebar-stat-value planning-stat-red">{resource.errors ?? 0}</span></div>
              <div className="planning-sidebar-stat"><span className="planning-sidebar-stat-label">Downtime</span><span className="planning-sidebar-stat-value">{resource.downtime ?? '—'}</span></div>
              <div className="planning-sidebar-stat"><span className="planning-sidebar-stat-label">Jobs today</span><span className="planning-sidebar-stat-value">{resource.jobsToday ?? '—'}</span></div>
              {resource.material && (
                <div className="planning-sidebar-stat"><span className="planning-sidebar-stat-label">Material</span><span className="planning-sidebar-stat-value">{resource.material}</span></div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Sidebar panel: reads aux route + query param, renders directly ---- */
function PlanningResourceSidebarPanel({ resources, stateMap, stateLog, selectedDates, onTimelineHover, stateSets, selectedKeys }: {
  resources: Resource[];
  stateMap: Map<string, ResourceStateEntry>;
  stateLog: StateLogEntry[];
  selectedDates: string[];
  onTimelineHover: (data: { segments: TimelineSegment[]; date: string } | null) => void;
  stateSets: StateSet[];
  selectedKeys: Set<string>;
}) {
  const navigate = useNavigate();
  const menuItem = useAuxOutlet({ outlet: 'sidebar' });
  const params = useQueryParams([{ key: 'resource', isQueryParam: true }]);
  const resourceKey = params.find(p => p.key === 'resource')?.val as string | undefined;
  const resource = resourceKey ? resources.find(r => r.layout_name === resourceKey) : undefined;

  if (!menuItem || !resource) return null;

  // menuItem comes as "/oee" from useAuxOutlet, strip leading slash
  const item = menuItem.replace(/^\//, '');

  // For OEE: if multiple resources are selected, show all of them
  const oeeResources = item === 'oee' && selectedKeys.size > 1
    ? resources.filter(r => selectedKeys.has(r.layout_name))
    : [resource];

  const sidebarTitles: Record<string, string> = {
    machine: 'Machine',
    oee: 'OEE',
    inks: 'Inks',
    productie: 'Productie overzicht',
  };
  const sidebarTitle = sidebarTitles[item] ?? item;
  const titleName = oeeResources.length > 1 ? `${oeeResources.length} resources` : resource.name;

  return (
    <div className="planning-sidebar">
      <div className="planning-sidebar-header">
        <div className="planning-sidebar-title-row">
          <h3 className="planning-sidebar-name">{sidebarTitle} — {titleName}</h3>
        </div>
        <button className="planning-sidebar-close" onClick={() => navigate('(sidebar:)')}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {item === 'oee' && oeeResources.length > 1 ? (
        <OeeMultiResourceContent
          resources={oeeResources}
          stateMap={stateMap}
          stateLog={stateLog}
          selectedDates={selectedDates}
          onTimelineHover={onTimelineHover}
          stateSets={stateSets}
        />
      ) : (
        <ResourceSidebarContent resource={resource} stateMap={stateMap} menuItem={item} stateLog={stateLog} selectedDates={selectedDates} onTimelineHover={onTimelineHover} stateSets={stateSets} />
      )}
    </div>
  );
}

/** OEE sidebar for multiple selected resources: individual timelines + aggregated donut */
function OeeMultiResourceContent({ resources, stateMap, stateLog, selectedDates, onTimelineHover, stateSets }: {
  resources: Resource[];
  stateMap: Map<string, ResourceStateEntry>;
  stateLog: StateLogEntry[];
  selectedDates: string[];
  onTimelineHover: (data: { segments: TimelineSegment[]; date: string } | null) => void;
  stateSets: StateSet[];
}) {
  // Aggregate state minutes across all resources and dates
  const aggStateMins: Record<string, number> = {};

  return (
    <div className="planning-sidebar-content">
      {/* Per-resource timelines */}
      {resources.map(res => {
        const entries = res.resource_uid ? stateLog.filter(e => e.resource_uid === res.resource_uid) : [];
        const resState = stateMap.get(res.state);
        return (
          <div key={res.layout_name} className="planning-sidebar-section">
            <div className="planning-sidebar-title-row" style={{ marginBottom: 4 }}>
              <span className="planning-sidebar-dot" style={{ background: resState?.color ?? '#888' }} />
              <h3 className="planning-sidebar-name" style={{ fontSize: 13 }}>{res.name}</h3>
            </div>
            {selectedDates.map(date => {
              const dayStart = new Date(date + 'T06:00:00+00:00');
              const dayEnd = new Date(date + 'T24:00:00+00:00');
              const segments = buildTimeline(entries, stateMap, dayStart, dayEnd);
              // Accumulate into aggregation
              segments.forEach(seg => {
                aggStateMins[seg.state] = (aggStateMins[seg.state] ?? 0) + (seg.endMin - seg.startMin);
              });
              if (segments.length === 0) return null;
              return (
                <div key={date} className="planning-sidebar-timeline-day">
                  <div className="planning-sidebar-timeline-date">{date}</div>
                  <StateTimelineSvg segments={segments} totalMinutes={18 * 60} startHour={6} date={`${res.name} — ${date}`} onHoverChange={onTimelineHover} />
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Aggregated OEE donut + table */}
      {(() => {
        const totalMins = Object.values(aggStateMins).reduce((s, v) => s + v, 0);
        const setGroups: OeeGroupData[] = stateSets.map(ss => {
          const minutes = ss.states.reduce((s, st) => s + (aggStateMins[st.code] ?? 0), 0);
          const setEntry = stateMap.get('set.' + ss.code);
          return {
            key: ss.code,
            title: setEntry?.block.title ?? ss.code,
            color: setEntry?.color ?? '#888',
            minutes,
            pct: totalMins > 0 ? Math.round((minutes / totalMins) * 100) : 0,
          };
        });

        return (
          <>
            <div className="planning-sidebar-section">
              <div className="planning-sidebar-section-title">Aggregated OEE</div>
              <OeeDonutChart groups={setGroups} />
            </div>
            <div className="planning-sidebar-section">
              <div className="planning-sidebar-section-title">State Duration (all selected)</div>
              <table className="planning-oee-table">
                <thead>
                  <tr><th>State</th><th>Duration</th><th>%</th></tr>
                </thead>
                <tbody>
                  {Object.entries(aggStateMins)
                    .sort((a, b) => b[1] - a[1])
                    .map(([code, mins]) => {
                      const entry = stateMap.get(code);
                      const pct = totalMins > 0 ? Math.round((mins / totalMins) * 100) : 0;
                      const h = Math.floor(mins / 60);
                      const m = Math.round(mins % 60);
                      return (
                        <tr key={code}>
                          <td>
                            <span className="planning-oee-table-dot" style={{ background: entry?.color ?? '#888' }} />
                            {entry?.block.title ?? code}
                          </td>
                          <td>{h}h {m}m</td>
                          <td>{pct}%</td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>Total</strong></td>
                    <td><strong>{Math.floor(totalMins / 60)}h {Math.round(totalMins % 60)}m</strong></td>
                    <td><strong>100%</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        );
      })()}
    </div>
  );
}

function formatTimeSlot(slot: number): string {
  const totalMinutes = slot * 5;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* ---- Shift definitions ---- */
const SHIFTS = [
  { name: 'Shift 1', startHour: 6, endHour: 15 },
  { name: 'Shift 2', startHour: 15, endHour: 24 },
];


function shiftDurationHours(shift: typeof SHIFTS[0]) {
  if (shift.endHour > shift.startHour) return shift.endHour - shift.startHour;
  return 24 - shift.startHour + shift.endHour;
}

/** Nominal speed (sqm/hr) by equipment name pattern */
function getNominalSpeed(name: string): number {
  const n = name.toLowerCase();
  if (n.includes('q-line') || n.includes('qline')) return 160;
  if (n.includes('350')) return 186;
  if (n.includes('210-hs') || n.includes('210 hs')) return 130;
  if (n.includes('210')) return 70;
  if (n.includes('500')) return 186;
  if (n.includes('epson') || n.includes('sc-s') || n.includes('sc-g')) return 30;
  if (n.includes('hp')) return 30;
  if (n.includes('swissq') || n.includes('kudu') || n.includes('karibu')) return 160;
  if (n.includes('zünd') || n.includes('zund') || n.includes('bullmer') || n.includes('aristo') || n.includes('itotec')) return 60;
  if (n.includes('sei') || n.includes('laser') || n.includes('abg')) return 60;
  if (n.includes('tau')) return 50;
  if (n.includes('rho')) return 100;
  return 50; // default for other equipment (laminators, calanders, etc.)
}

/** Deterministic pseudo-random from string seed (0..1) */
function seedRand(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return ((Math.abs(h) * 2654435761) >>> 0) / 4294967296;
}

/**
 * Simulate time-dependent OEE for a shift.
 * Ramps up during first hour (startup), peaks mid-shift, slight dip at end.
 * Before shift start: shows the base OEE (projected).
 * After shift end: shows the final OEE (what was achieved).
 */
function timeBasedOee(baseOee: number, shift: typeof SHIFTS[0], h: number, seed: string): number {
  const shiftH = shiftDurationHours(shift);
  let elapsed: number;
  if (h < shift.startHour) {
    // Before this shift — show projected base OEE
    return baseOee;
  } else if (h >= shift.endHour) {
    // After shift — final OEE (slight random offset to feel "settled")
    elapsed = shiftH;
  } else {
    elapsed = h - shift.startHour;
  }

  const progress = elapsed / shiftH; // 0..1
  // Curve: ramp up in first 15%, peak at 40-70%, slight dip at end
  // Uses a smooth bell-ish shape centered around 55% of the shift
  let factor: number;
  if (progress < 0.15) {
    // Startup ramp: 70% → 100% of base
    factor = 0.70 + (progress / 0.15) * 0.30;
  } else if (progress < 0.75) {
    // Peak zone: 100-105% of base
    factor = 1.0 + 0.05 * Math.sin(((progress - 0.15) / 0.60) * Math.PI);
  } else {
    // End-of-shift dip: 100% → 92% of base
    factor = 1.0 - 0.08 * ((progress - 0.75) / 0.25);
  }

  // Add small per-resource deterministic jitter (±3%)
  const jitter = (seedRand(seed) - 0.5) * 0.06;
  const oee = Math.round(baseOee * (factor + jitter));
  return Math.max(0, Math.min(100, oee));
}

/** Compute per-resource capacity for both shifts, with time-dependent OEE */
function computeResourceShiftStats(resource: Resource, minutesFromMidnight: number) {
  const baseOee = resource.oee ?? 0;
  const h = minutesFromMidnight / 60;
  const speed = getNominalSpeed(resource.name);
  const isBreakdown = resource.state === 'breakdown' || resource.state === 'offline';
  const isIdle = resource.state === 'idle';

  return SHIFTS.map(shift => {
    const shiftH = shiftDurationHours(shift);
    let remainingH: number;
    if (h < shift.startHour) {
      remainingH = shiftH;
    } else if (h >= shift.endHour) {
      remainingH = 0;
    } else {
      remainingH = shift.endHour - h;
    }

    // Time-dependent OEE
    let shiftOee: number;
    if (isBreakdown) {
      shiftOee = 0;
    } else if (isIdle && remainingH > 0) {
      shiftOee = 100;
    } else {
      shiftOee = timeBasedOee(baseOee, shift, h, resource.layout_name + shift.name);
    }

    // Capacity: breakdown=0, otherwise full speed * remaining time
    const capacity = isBreakdown ? 0 : Math.round(speed * remainingH);

    // Planned: simulate as 60-85% of capacity (deterministic per resource+shift)
    const plannedRatio = 0.60 + seedRand(resource.layout_name + shift.name) * 0.25;
    const planned = isBreakdown ? 0 : Math.round(capacity * plannedRatio);

    const available = capacity - planned;

    return {
      name: shift.name,
      oee: shiftOee,
      capacity,
      planned,
      available,
      remainingH: Math.round(remainingH * 10) / 10,
    };
  });
}

/* ---- Main page ---- */
export function PlanningPage() {
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => document.body.classList.contains('dark'));
  const [lang, setLang] = useState('en');

  // Read dates and time from URL query params
  const urlParams = useQueryParams([
    { key: 'date', isQueryParam: true },
    { key: 'time', isQueryParam: true },
    { key: 'selected', isQueryParam: true },
  ]);
  const urlDateVal = urlParams.find(p => p.key === 'date')?.val;
  const urlTimeVal = urlParams.find(p => p.key === 'time')?.val;
  const urlSelectedVal = urlParams.find(p => p.key === 'selected')?.val;

  const [selectedDates, setSelectedDates] = useState<string[]>(() => {
    if (typeof urlDateVal === 'string' && urlDateVal) return urlDateVal.split(',');
    return [new Date().toISOString().slice(0, 10)];
  });
  const [timeSlot, setTimeSlot] = useState(() => {
    if (typeof urlTimeVal === 'number') return Math.max(72, Math.min(288, urlTimeVal));
    const now = new Date();
    const slot = Math.round((now.getHours() * 60 + now.getMinutes()) / 5);
    return Math.max(72, Math.min(288, slot));
  });
  const timeLabel = formatTimeSlot(timeSlot);

  const [allLines, setAllLines] = useState<LineConfig[]>([]);
  const [activeLineId, setActiveLineId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('line') || 'sheet-line';
  });
  const [lineConfig, setLineConfig] = useState<LineConfig | null>(null);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [lineResources, setLineResources] = useState<Resource[]>([]);
  const [stateMap, setStateMap] = useState<Map<string, ResourceStateEntry>>(new Map());
  const [stateLog, setStateLog] = useState<StateLogEntry[]>([]);
  const [stateSets, setStateSets] = useState<StateSet[]>([]);
  const modelsDataRef = useRef<ModelsData | null>(null);
  const lineResRef = useRef<Resource[]>([]);
  const stateMapRef = useRef<Map<string, ResourceStateEntry>>(new Map());
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const dismissPopoverRef = useRef<(() => void) | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => {
    if (typeof urlSelectedVal === 'string' && urlSelectedVal) {
      return new Set(urlSelectedVal.split(';').filter(Boolean));
    }
    return new Set();
  });
  const hadActiveRef = useRef(false);
  const [showCapacity, setShowCapacity] = useState(true);
  const [timelineOverlay, setTimelineOverlay] = useState<{ segments: TimelineSegment[]; date: string } | null>(null);

  // React to URL changes for selected param (browser back/forward, manual edit)
  useEffect(() => {
    const newSelected = typeof urlSelectedVal === 'string' && urlSelectedVal
      ? new Set(urlSelectedVal.split(';').filter(Boolean))
      : new Set<string>();
    setSelectedKeys(prev => {
      if (prev.size === newSelected.size && [...prev].every(k => newSelected.has(k))) return prev;
      return newSelected;
    });
  }, [urlSelectedVal]);

  // Sync dates, time, and selection to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('date', selectedDates.join(','));
    params.set('time', String(timeSlot));
    if (selectedKeys.size > 0) {
      params.set('selected', [...selectedKeys].join(';'));
    } else {
      params.delete('selected');
    }
    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, [selectedDates, timeSlot, selectedKeys]);

  // Fetch data
  useEffect(() => {
    Promise.all([
      fetch('/data/models.json').then(r => r.json()),
      fetch('/data/resource.json').then(r => r.json()),
      fetch('/data/resource_states.json').then(r => r.json()),
      fetch('/data/state.json').then(r => r.json()),
    ])
      .then(([modelsData, resData, statesData, stateLogData]) => {
        modelsDataRef.current = modelsData;
        setAllLines(modelsData.lines);
        const map = buildStateMap(statesData);
        setStateMap(map);
        stateMapRef.current = map;
        setStateSets(statesData.state_sets ?? []);
        setStateLog(stateLogData.entries ?? []);
        const line = modelsData.lines.find((l: LineConfig) => l.id === activeLineId);
        if (line) setLineConfig(line);
        setAllResources(resData.resources);
        const filtered = resData.resources.filter((r: Resource) => r.line === activeLineId);
        setLineResources(filtered);
        lineResRef.current = filtered;
        document.title = `Planning — ${line?.name || ''}`;
      });
  }, [activeLineId]);

  const minutesFromMidnight = timeSlot * 5;
  const resourceData: JSONRecord[] = lineResources.map(r => {
    const stateEntry = stateMap.get(r.state);
    const color = stateEntry?.color || '#888888';
    const isEquipment = r.type !== 'stock' && r.type !== 'queue';
    const shifts = isEquipment ? computeResourceShiftStats(r, minutesFromMidnight) : undefined;
    return {
      layout_name: r.layout_name,
      color,
      type: r.type,
      oee: r.oee ?? 0,
      selected: selectedKeys.has(r.layout_name),
      ...(shifts ? { _shifts: shifts as unknown as JSONRecord[] } : {}),
      ...(r.ink_expiration ? { ink_expiration: true, inks: r.inks } : {}),
    };
  });

  const handleSaveCamera = useCallback((state: CameraState) => {
    const models = modelsDataRef.current;
    if (!models) return;
    const line = models.lines.find(l => l.id === activeLineId);
    if (!line) return;
    line.camera = state;
    setLineConfig(prev => prev ? { ...prev, camera: state } : prev);
    fetch('/data/models.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(models, null, 2),
    }).catch(err => console.error('Failed to save camera:', err));
  }, [activeLineId]);

  const switchLine = useCallback((id: string) => {
    if (id === activeLineId) return;
    setActiveLineId(id);
    setSelectedKeys(new Set());
    const line = modelsDataRef.current?.lines.find(l => l.id === id);
    if (line) {
      setLineConfig(line);
      document.title = `Planning — ${line.name}`;
      const filtered = allResources.filter(r => r.line === id);
      setLineResources(filtered);
      lineResRef.current = filtered;
    }
  }, [activeLineId, allResources]);

  // When an object is clicked, set resource as query param and toggle selection
  const handleObjectClick = useCallback((data: Record<string, unknown> | null) => {
    if (!data) {
      // Clicked floor
      if (hadActiveRef.current || selectedKeys.size > 0) {
        // First floor click: deselect everything (dismiss menu / clear selection)
        setSelectedKeys(new Set());
        hadActiveRef.current = false;
      } else {
        // Second floor click: select all non-stock/queue
        const selectableKeys = lineResRef.current
          .filter(r => r.type !== 'stock' && r.type !== 'queue')
          .map(r => r.layout_name);
        setSelectedKeys(new Set(selectableKeys));
      }
      // Clear resource query param and close sidebar
      navigateRef.current({
        queryParams: [{ key: 'resource', val: '' }],
        partialPath: '(sidebar:)',
      });
      return;
    }

    // Clicked an object — mark as active (popover/menu will show)
    hadActiveRef.current = true;

    const nodeName = data.name as string;
    const key = nodeName?.includes('_') ? nodeName.split('_').slice(1).join('_') : nodeName;
    const res = lineResRef.current.find(r => r.layout_name === key);
    if (!res) return;

    // Toggle selection for equipment and layout_names (not stock/queue)
    if (res.type !== 'stock' && res.type !== 'queue') {
      setSelectedKeys(prev => {
        const next = new Set(prev);
        if (next.has(res.layout_name)) {
          next.delete(res.layout_name);
        } else {
          next.add(res.layout_name);
        }
        return next;
      });
    }

    // Set resource in query param (sidebar not opened yet — user picks from menu)
    navigateRef.current({
      queryParams: [{ key: 'resource', val: res.layout_name }],
    });
  }, [selectedKeys.size]);

  // renderPopover: shows the context menu at the clicked resource
  const renderPopover = useCallback((data: Record<string, unknown>) => {
    const nodeName = data.name as string;
    const key = nodeName?.includes('_') ? nodeName.split('_').slice(1).join('_') : nodeName;
    const res = lineResRef.current.find(r => r.layout_name === key);
    if (!res) return null;

    const isEquipment = res.type !== 'stock' && res.type !== 'queue';
    const expiringInks = getExpiringInks(res);

    const openMenuItem = (item: string) => {
      navigateRef.current({
        queryParams: [{ key: 'resource', val: res.layout_name }],
        partialPath: `(sidebar:${item})`,
      });
      dismissPopoverRef.current?.();
    };

    return (
      <div className="planning-menu-inner">
        <button className="planning-menu-item" onPointerDown={e => { e.stopPropagation(); openMenuItem('machine'); }}>
          <span className="planning-menu-label">{res.name}</span>
        </button>
        {isEquipment && (
          <button className="planning-menu-item" onPointerDown={e => { e.stopPropagation(); openMenuItem('oee'); }}>
            <span className="planning-menu-label">OEE</span>
          </button>
        )}
        {expiringInks.length > 0 && (
          <button className="planning-menu-item" onPointerDown={e => { e.stopPropagation(); openMenuItem('inks'); }}>
            <span className="planning-menu-label">Inks expiring</span>
          </button>
        )}
        <button className="planning-menu-item" onPointerDown={e => { e.stopPropagation(); openMenuItem('productie'); }}>
          <span className="planning-menu-label">Productie overzicht</span>
        </button>
      </div>
    );
  }, []);

  // Render capacity label on each equipment object in 3D scene
  const renderLabel = useCallback((data: Record<string, unknown>) => {
    if (!showCapacity) return null;
    if (data.type === 'stock' || data.type === 'queue') return null;
    const shifts = data._shifts as { name: string; oee: number; capacity: number; planned: number; available: number; }[] | undefined;
    if (!shifts) return null;
    return (
      <div className="planning-3d-label">
        {shifts.map((s, i) => {
          const oeeColor = s.oee >= 75 ? '#079455' : s.oee >= 50 ? '#eab308' : '#d92d20';
          return (
            <div key={s.name}>
              {i > 0 && <div className="planning-3d-label-hdivider" />}
              <div className="planning-3d-label-shift">{s.name}</div>
              <div className="planning-3d-label-oee" style={{ color: oeeColor }}>OEE {s.oee}%</div>
              <div className="planning-3d-label-cap">Capacity {s.capacity} m²</div>
              <div className="planning-3d-label-cap">Planned {s.planned} m²</div>
              <div className="planning-3d-label-avail">Available {s.available} m²</div>
            </div>
          );
        })}
      </div>
    );
  }, [showCapacity]);

  const offTrackCount = lineResources.filter(r => {
    const s = r.state;
    return s === 'breakdown' || s === 'starved' || s === 'starved.operator' || s === 'blocked';
  }).length;

  if (!lineConfig) {
    return (
      <div className="planning-page">
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-text">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <AuxRouteProvider>
      <div className="planning-page">
        <div className="planning-main">
        <header className="planning-header">
          <div className="planning-header-left">
            <div className="planning-dates">
              {selectedDates.map((d, i) => (
                <div key={i} className="planning-date-chip">
                  <input
                    type="date"
                    className="planning-date-picker"
                    value={d}
                    onChange={e => {
                      const next = [...selectedDates];
                      next[i] = e.target.value;
                      setSelectedDates(next);
                    }}
                  />
                  {selectedDates.length > 1 && (
                    <button
                      className="planning-date-remove"
                      onClick={() => setSelectedDates(selectedDates.filter((_, j) => j !== i))}
                    >&times;</button>
                  )}
                </div>
              ))}
              <button
                className="planning-date-add"
                onClick={() => setSelectedDates([...selectedDates, new Date().toISOString().slice(0, 10)])}
                title="Add date"
              >+</button>
            </div>
            <div className="planning-time-slider">
              <span className="planning-time-label">{timeLabel}</span>
              <input
                type="range"
                className="planning-time-range"
                min={72}
                max={288}
                value={timeSlot}
                onChange={e => setTimeSlot(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="planning-header-actions">
            <label className="planning-toggle" title="Show/hide capacity">
              <input
                type="checkbox"
                checked={showCapacity}
                onChange={e => setShowCapacity(e.target.checked)}
              />
              <span className="planning-toggle-slider" />
              <span className="planning-toggle-label">Capacity</span>
            </label>
            <select
              className="planning-select"
              value={lang}
              onChange={e => setLang(e.target.value)}
            >
              <option value="en">EN</option>
              <option value="nl">NL</option>
              <option value="uk">UK</option>
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


        <div className="planning-content">
          <div className="planning-viewer">
            <ThreeModelView
              key={lineConfig.id}
              url={lineConfig.glb}
              className="scene"
              data={resourceData}
              colorKey="color"
              renderPopover={renderPopover}
              renderLabel={renderLabel}
              initialCamera={lineConfig.camera}
              onSaveCamera={handleSaveCamera}
              onObjectClick={handleObjectClick}
              popoverRef={dismissPopoverRef}
            />
            {timelineOverlay && (
              <div className="planning-timeline-overlay">
                <div className="planning-timeline-overlay-header">{timelineOverlay.date}</div>
                <StateTimelineBar
                  segments={timelineOverlay.segments}
                  totalMinutes={18 * 60}
                  startHour={6}
                  barHeight={48}
                  svgWidth={1200}
                  svgHeight={72}
                  fontSize={11}
                />
              </div>
            )}
          </div>
        </div>

        <div className="planning-bottom">
          <div className="planning-bottom-inner">
            <div className="planning-off-track">
              Off track
              <span className="planning-badge">{offTrackCount}</span>
            </div>
            <div className="planning-thumbs">
              {allLines.map(line => (
                <button
                  key={line.id}
                  className={`planning-thumb${line.id === activeLineId ? ' active' : ''}`}
                  onClick={() => switchLine(line.id)}
                >
                  <span className="planning-thumb-name">{line.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        </div>{/* .planning-main */}

        <PlanningResourceSidebarPanel resources={lineResources} stateMap={stateMap} stateLog={stateLog} selectedDates={selectedDates} onTimelineHover={setTimelineOverlay} stateSets={stateSets} selectedKeys={selectedKeys} />
      </div>
    </AuxRouteProvider>
  );
}
