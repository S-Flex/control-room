import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { JSONRecord } from '@s-flex/xfw-data';
import { resolve } from './resolve';

export type TimelineBarConfig = {
  offset_field: string;
  duration_field: string;
  color_field: string;
  title_field?: string;
  group_field?: string;
  set_field?: string;
  set_title?: string;
  set_order_field?: string;
};

type Segment = {
  offset: number;
  duration: number;
  color: string;
  row: JSONRecord;
};

type SetRow = {
  key: string;
  title: string;
  order: number;
  segments: Segment[];
};

type GroupBlock = {
  key: string;
  title: string;
  sets: SetRow[];
};

/** Build segments from data rows. Gaps between rows are left empty — the
 *  track background shows through — rather than filled with synthetic idle
 *  segments. */
function buildSegments(data: JSONRecord[], config: TimelineBarConfig): Segment[] {
  const raw = data.map(row => ({
    offset: Number(resolve(row, config.offset_field) ?? 0),
    duration: resolve(row, config.duration_field),
    color: String(resolve(row, config.color_field) ?? '#888'),
    row,
  }));

  raw.sort((a, b) => a.offset - b.offset);

  const segments = raw.map((r, i) => {
    let dur = r.duration !== null && r.duration !== undefined ? Number(r.duration) : 0;
    if (dur <= 0) {
      dur = i + 1 < raw.length ? raw[i + 1].offset - r.offset : 300;
    }
    return { offset: r.offset, duration: Math.max(dur, 1), color: r.color, row: r.row };
  });

  // Paint order: state.order ascending (null/missing treated as 0), so higher
  // order segments render on top of lower order ones where they overlap.
  segments.sort((a, b) =>
    Number(resolve(a.row, 'state.order') ?? 0) - Number(resolve(b.row, 'state.order') ?? 0)
  );

  return segments;
}

function buildGroups(data: JSONRecord[], config: TimelineBarConfig): GroupBlock[] {
  const { group_field, set_field, title_field, set_title, set_order_field } = config;

  type GroupAcc = { rows: JSONRecord[]; title: string; };
  const groupMap = new Map<string, GroupAcc>();
  if (group_field) {
    for (const row of data) {
      const key = String(resolve(row, group_field) ?? 'unknown');
      if (!groupMap.has(key)) {
        const title = title_field ? String(resolve(row, title_field) ?? key) : key;
        groupMap.set(key, { rows: [], title });
      }
      groupMap.get(key)!.rows.push(row);
    }
  } else {
    groupMap.set('_all', { rows: data, title: '' });
  }

  const groups: GroupBlock[] = [];
  for (const [gKey, g] of groupMap) {
    let sets: SetRow[];
    if (set_field) {
      type SetAcc = { rows: JSONRecord[]; title: string; order: number; };
      const setMap = new Map<string, SetAcc>();
      for (const row of g.rows) {
        const key = String(resolve(row, set_field) ?? 'unknown');
        if (!setMap.has(key)) {
          const title = set_title ? String(resolve(row, set_title) ?? key) : key;
          const order = set_order_field ? Number(resolve(row, set_order_field) ?? 0) : 0;
          setMap.set(key, { rows: [], title, order });
        }
        setMap.get(key)!.rows.push(row);
      }
      sets = Array.from(setMap.entries())
        .map(([key, s]) => ({
          key,
          title: s.title,
          order: s.order,
          segments: buildSegments(s.rows, config),
        }))
        .sort((a, b) => a.order - b.order);
    } else {
      sets = [{
        key: '_all',
        title: '',
        order: 0,
        segments: buildSegments(g.rows, config),
      }];
    }
    groups.push({ key: gKey, title: g.title, sets });
  }
  return groups;
}

function maxSecondsOfGroups(groups: GroupBlock[]): number {
  let max = 0;
  for (const g of groups) {
    for (const s of g.sets) {
      for (const seg of s.segments) {
        const end = seg.offset + seg.duration;
        if (end > max) max = end;
      }
    }
  }
  return max;
}

type TimelineSvgOptions = {
  segments: Segment[];
  totalSeconds: number;
  startHour: number;
  barHeight: number;
  svgWidth: number;
  svgHeight: number;
  fontSize: number;
  showAxis?: boolean;
  interactive?: boolean;
  onSegHover?: (seg: Segment, x: number, y: number) => void;
  onSegLeave?: () => void;
};

function renderTimelineSvg({
  segments, totalSeconds, startHour, barHeight, svgWidth, svgHeight, fontSize,
  showAxis = true, interactive = false, onSegHover, onSegLeave,
}: TimelineSvgOptions) {
  const totalHours = totalSeconds / 3600;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      preserveAspectRatio="xMinYMin meet"
      className="timeline-bar-svg"
    >
      {showAxis && Array.from({ length: Math.floor(totalHours) + 1 }, (_, i) => {
        const hourSec = i * 3600;
        const x = (hourSec / totalSeconds) * svgWidth;
        const h = (startHour + i) % 24;
        return (
          <g key={i}>
            <line x1={x} y1={barHeight} x2={x} y2={barHeight + 4} stroke="var(--text-muted)" strokeWidth="0.5" />
            <text x={x} y={barHeight + fontSize + 6} fill="var(--text-muted)" fontSize={fontSize} textAnchor="middle">
              {h}:00
            </text>
          </g>
        );
      })}
      {segments.map((seg, i) => {
        const x = (seg.offset / totalSeconds) * svgWidth;
        const w = Math.max(1, (seg.duration / totalSeconds) * svgWidth);
        return (
          <rect
            key={i}
            x={x}
            y={0}
            width={w}
            height={barHeight}
            fill={seg.color}
            onMouseEnter={interactive && onSegHover ? e => onSegHover(seg, e.clientX, e.clientY) : undefined}
            onMouseMove={interactive && onSegHover ? e => onSegHover(seg, e.clientX, e.clientY) : undefined}
            onMouseLeave={interactive && onSegLeave ? onSegLeave : undefined}
            style={{ cursor: interactive ? 'pointer' : 'default' }}
          />
        );
      })}
    </svg>
  );
}

function GroupTimelineBar({
  group,
  totalSeconds,
  startHour,
  isEnlarged,
  onClick,
}: {
  group: GroupBlock;
  totalSeconds: number;
  startHour: number;
  isEnlarged?: boolean;
  onClick?: () => void;
}) {
  if (totalSeconds <= 0) return null;

  return (
    <div
      className={`timeline-bar-wrap${isEnlarged ? ' enlarged' : ''}`}
      onClick={onClick}
    >
      {group.sets.map((set, i) => {
        const isLast = i === group.sets.length - 1;
        return (
          <div key={set.key} className="timeline-set-row compact">
            <div className="timeline-set-bar">
              {renderTimelineSvg({
                segments: set.segments, totalSeconds, startHour,
                barHeight: 28, svgWidth: 600, svgHeight: isLast ? 48 : 32, fontSize: 8,
                showAxis: isLast,
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EnlargedGroupOverlay({
  group,
  totalSeconds,
  startHour,
  onClose,
}: {
  group: GroupBlock;
  totalSeconds: number;
  startHour: number;
  onClose: () => void;
}) {
  const [container, setContainer] = useState<Element | null>(null);
  const [hover, setHover] = useState<{ seg: Segment; x: number; y: number; } | null>(null);

  useEffect(() => {
    setContainer(document.querySelector('.planning-viewer'));
  }, []);

  if (totalSeconds <= 0 || !container) return null;
  const hasSets = group.sets.length > 1 || !!group.sets[0]?.title;

  return (
    <>
      {createPortal(
        <div className="timeline-overlay">
          <div className="timeline-overlay-header">
            {group.title && <div className="timeline-overlay-label">{group.title}</div>}
            <button className="timeline-overlay-close" onClick={onClose} title="Close">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {group.sets.map((set, i) => {
            const isLast = i === group.sets.length - 1;
            return (
              <div key={set.key} className="timeline-set-row">
                {hasSets && <div className="timeline-set-label">{set.title}</div>}
                <div className="timeline-set-bar">
                  {renderTimelineSvg({
                    segments: set.segments, totalSeconds, startHour,
                    barHeight: 48, svgWidth: 1200, svgHeight: isLast ? 80 : 56, fontSize: 11,
                    showAxis: isLast,
                    interactive: true,
                    onSegHover: (seg, x, y) => setHover({ seg, x, y }),
                    onSegLeave: () => setHover(null),
                  })}
                </div>
              </div>
            );
          })}
        </div>,
        container
      )}
      {hover && createPortal(
        <div className="timeline-bar-tooltip" style={{ left: hover.x + 12, top: hover.y - 10 }}>
          <div className="timeline-bar-tooltip-state" style={{ color: hover.seg.color }}>
            {String(resolve(hover.seg.row, 'state.block.title') ?? resolve(hover.seg.row, 'state.code') ?? '')}
          </div>
          {hover.seg.row.start_at && (
            <div className="timeline-bar-tooltip-time">
              {new Date(hover.seg.row.start_at as string).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          <div className="timeline-bar-tooltip-dur">
            {Math.round(hover.seg.duration / 60)} min
          </div>
          {hover.seg.row.job_name && (
            <div className="timeline-bar-tooltip-job">{String(hover.seg.row.job_name)}</div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

export function TimelineBar({ widgetConfig, data }: { widgetConfig: TimelineBarConfig; data: JSONRecord[]; }) {
  const [enlargedGroup, setEnlargedGroup] = useState<string | null>(null);

  if (!data || data.length === 0) return null;

  let startHour = 0;
  for (const row of data) {
    const startAt = row.start_at as string | undefined;
    if (startAt) {
      const d = new Date(startAt);
      if (!isNaN(d.getTime())) {
        startHour = d.getHours();
        break;
      }
    }
  }

  const groups = buildGroups(data, widgetConfig);
  const totalSeconds = maxSecondsOfGroups(groups);

  const enlarged = enlargedGroup != null ? groups.find(g => g.key === enlargedGroup) : null;

  return (
    <div className="timeline-bar-groups">
      {groups.map(g => (
        <GroupTimelineBar
          key={g.key}
          group={g}
          totalSeconds={totalSeconds}
          startHour={startHour}
          isEnlarged={enlargedGroup === g.key}
          onClick={() => setEnlargedGroup(prev => prev === g.key ? null : g.key)}
        />
      ))}
      {enlarged && enlarged.sets.some(s => s.segments.length > 0) && (
        <EnlargedGroupOverlay
          group={enlarged}
          totalSeconds={totalSeconds}
          startHour={startHour}
          onClose={() => setEnlargedGroup(null)}
        />
      )}
    </div>
  );
}
