import { useState } from 'react';
import type { JSONRecord, JSONValue } from 'xfw-data';

export type TimelineBarConfig = {
  offset_field: string;
  duration_field: string;
  color_field: string;
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
};

export function TimelineBar({ widgetConfig, data }: { widgetConfig: TimelineBarConfig; data: JSONRecord[] }) {
  const [hover, setHover] = useState<{ seg: Segment; x: number; y: number } | null>(null);

  console.log('TimelineBar', { widgetConfig, data, dataLength: data?.length });

  if (!data || data.length === 0) { console.log('TimelineBar: no data'); return null; }

  const segments: Segment[] = data.map(row => ({
    offset: Number(resolve(row, widgetConfig.offset_field) ?? 0),
    duration: Number(resolve(row, widgetConfig.duration_field) ?? 0),
    color: String(resolve(row, widgetConfig.color_field) ?? '#888'),
    row,
  }));

  console.log('TimelineBar segments:', segments.slice(0, 3));

  const totalSeconds = segments.reduce((max, s) => Math.max(max, s.offset + s.duration), 0);
  if (totalSeconds <= 0) { console.log('TimelineBar: totalSeconds is 0'); return null; }

  const totalHours = totalSeconds / 3600;
  const startHour = Math.floor(segments.reduce((min, s) => Math.min(min, s.offset), Infinity) / 3600);
  const barHeight = 28;
  const svgWidth = 600;
  const svgHeight = 48;
  const fontSize = 8;

  return (
    <div className="timeline-bar-wrap">
      <svg
        width="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMinYMin meet"
        className="timeline-bar-svg"
      >
        {Array.from({ length: Math.floor(totalHours) + 1 }, (_, i) => {
          const hourSec = (startHour + i) * 3600;
          const x = (hourSec / totalSeconds) * svgWidth;
          return (
            <g key={i}>
              <line x1={x} y1={barHeight} x2={x} y2={barHeight + 4} stroke="var(--text-muted)" strokeWidth="0.5" />
              <text x={x} y={barHeight + fontSize + 6} fill="var(--text-muted)" fontSize={fontSize} textAnchor="middle">
                {startHour + i}:00
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
              onMouseEnter={e => setHover({ seg, x: e.clientX, y: e.clientY })}
              onMouseMove={e => setHover({ seg, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            />
          );
        })}
      </svg>
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
