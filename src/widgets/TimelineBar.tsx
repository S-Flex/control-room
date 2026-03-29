import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { JSONRecord, JSONValue } from 'xfw-data';

export type TimelineBarConfig = {
  offset_field: string;
  duration_field: string;
  color_field: string;
  group_field?: string;
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

type Segment = {
  offset: number;
  duration: number;
  color: string;
  row: JSONRecord;
  idle?: boolean;
};

/** Build segments from data, inserting idle gaps from 0 to first offset and between segments. */
function buildSegments(data: JSONRecord[], widgetConfig: TimelineBarConfig): Segment[] {
  const raw = data.map(row => ({
    offset: Number(resolve(row, widgetConfig.offset_field) ?? 0),
    duration: resolve(row, widgetConfig.duration_field),
    color: String(resolve(row, widgetConfig.color_field) ?? '#888'),
    row,
  }));

  raw.sort((a, b) => a.offset - b.offset);

  const dataSegments: Segment[] = raw.map((r, i) => {
    let dur = r.duration !== null && r.duration !== undefined ? Number(r.duration) : 0;
    if (dur <= 0) {
      dur = i + 1 < raw.length ? raw[i + 1].offset - r.offset : 300;
    }
    return { offset: r.offset, duration: Math.max(dur, 1), color: r.color, row: r.row };
  });

  // Insert idle segments for gaps
  const segments: Segment[] = [];
  let cursor = 0;
  for (const seg of dataSegments) {
    if (seg.offset > cursor) {
      segments.push({
        offset: cursor,
        duration: seg.offset - cursor,
        color: 'var(--bg-idle, #e0e0e0)',
        row: {} as JSONRecord,
        idle: true,
      });
    }
    segments.push(seg);
    cursor = seg.offset + seg.duration;
  }

  return segments;
}

/** Compute totalSeconds: always starts from 0. */
function getTotalSeconds(segments: Segment[]): number {
  return segments.reduce((max, s) => Math.max(max, s.offset + s.duration), 0);
}

function renderTimelineSvg(
  segments: Segment[],
  totalSeconds: number,
  barHeight: number,
  svgWidth: number,
  svgHeight: number,
  fontSize: number,
  interactive: boolean,
  onSegHover?: (seg: Segment, x: number, y: number) => void,
  onSegLeave?: () => void,
) {
  const totalHours = totalSeconds / 3600;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      preserveAspectRatio="xMinYMin meet"
      className="timeline-bar-svg"
    >
      {Array.from({ length: Math.floor(totalHours) + 1 }, (_, i) => {
        const hourSec = i * 3600;
        const x = (hourSec / totalSeconds) * svgWidth;
        return (
          <g key={i}>
            <line x1={x} y1={barHeight} x2={x} y2={barHeight + 4} stroke="var(--text-muted)" strokeWidth="0.5" />
            <text x={x} y={barHeight + fontSize + 6} fill="var(--text-muted)" fontSize={fontSize} textAnchor="middle">
              {i}:00
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
            opacity={seg.idle ? 0.3 : 1}
            onMouseEnter={interactive && !seg.idle && onSegHover ? e => onSegHover(seg, e.clientX, e.clientY) : undefined}
            onMouseMove={interactive && !seg.idle && onSegHover ? e => onSegHover(seg, e.clientX, e.clientY) : undefined}
            onMouseLeave={interactive && !seg.idle && onSegLeave ? onSegLeave : undefined}
            style={{ cursor: interactive && !seg.idle ? 'pointer' : 'default' }}
          />
        );
      })}
    </svg>
  );
}

function SingleTimelineBar({
  segments,
  totalSeconds,
  label,
  onHoverStart,
  onHoverEnd,
}: {
  segments: Segment[];
  totalSeconds: number;
  label?: string;
  onHoverStart?: (e: React.MouseEvent) => void;
  onHoverEnd?: () => void;
}) {
  const [hover, setHover] = useState<{ seg: Segment; x: number; y: number } | null>(null);

  if (totalSeconds <= 0) return null;

  return (
    <div
      className="timeline-bar-wrap"
      onMouseEnter={onHoverStart}
      onMouseLeave={e => { setHover(null); onHoverEnd?.(); }}
    >
      {label && <div className="timeline-bar-label">{label}</div>}
      {renderTimelineSvg(
        segments, totalSeconds,
        28, 600, 48, 8,
        true,
        (seg, x, y) => setHover({ seg, x, y }),
        () => setHover(null),
      )}
      {hover && (
        <div className="timeline-bar-tooltip" style={{ left: hover.x + 12, top: hover.y - 10 }}>
          <div className="timeline-bar-tooltip-color" style={{ color: hover.seg.color }}>
            {String(resolve(hover.seg.row, 'state.block.title') ?? resolve(hover.seg.row, 'state.code') ?? '')}
          </div>
          <div className="timeline-bar-tooltip-dur">
            {Math.round(hover.seg.duration / 60)} min
          </div>
          {hover.seg.row.job_name && (
            <div className="timeline-bar-tooltip-job">{String(hover.seg.row.job_name)}</div>
          )}
        </div>
      )}
    </div>
  );
}

function EnlargedTimelineOverlay({
  segments,
  totalSeconds,
  label,
}: {
  segments: Segment[];
  totalSeconds: number;
  label?: string;
}) {
  const [container, setContainer] = useState<Element | null>(null);

  useEffect(() => {
    setContainer(document.querySelector('.planning-viewer'));
  }, []);

  if (totalSeconds <= 0 || !container) return null;

  return createPortal(
    <div className="timeline-overlay">
      {label && <div className="timeline-overlay-label">{label}</div>}
      {renderTimelineSvg(
        segments, totalSeconds,
        48, 1200, 80, 11,
        false,
      )}
    </div>,
    container
  );
}

export function TimelineBar({ widgetConfig, data }: { widgetConfig: TimelineBarConfig; data: JSONRecord[] }) {
  const [enlargedGroup, setEnlargedGroup] = useState<string | null>(null);

  if (!data || data.length === 0) return null;

  // Group data by group_field if specified
  const groupField = widgetConfig.group_field;
  const groups: { key: string; label: string; rows: JSONRecord[] }[] = [];

  if (groupField) {
    const map = new Map<string, JSONRecord[]>();
    for (const row of data) {
      const val = String(resolve(row, groupField) ?? 'unknown');
      if (!map.has(val)) map.set(val, []);
      map.get(val)!.push(row);
    }
    for (const [key, rows] of map) {
      groups.push({ key, label: key, rows });
    }
  } else {
    groups.push({ key: '_all', label: '', rows: data });
  }

  // Build segments per group and compute a shared totalSeconds across all groups
  const groupSegments = groups.map(g => {
    const segments = buildSegments(g.rows, widgetConfig);
    return { ...g, segments };
  });
  const globalTotalSeconds = groupSegments.reduce(
    (max, g) => Math.max(max, getTotalSeconds(g.segments)), 0
  );

  const enlarged = enlargedGroup != null
    ? groupSegments.find(g => g.key === enlargedGroup)
    : null;

  return (
    <div className="timeline-bar-groups">
      {groupSegments.map(g => (
        <SingleTimelineBar
          key={g.key}
          segments={g.segments}
          totalSeconds={globalTotalSeconds}
          label={groups.length > 1 ? g.label : undefined}
          onHoverStart={() => setEnlargedGroup(g.key)}
          onHoverEnd={() => setEnlargedGroup(null)}
        />
      ))}
      {enlarged && enlarged.segments.length > 0 && (
        <EnlargedTimelineOverlay
          segments={enlarged.segments}
          totalSeconds={globalTotalSeconds}
          label={enlarged.label}
        />
      )}
    </div>
  );
}
