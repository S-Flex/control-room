import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { JSONRecord, JSONValue, ParamDefinition } from '@s-flex/xfw-data';
import type { DataGroup, FieldConfig } from '@s-flex/xfw-ui';
import { useNavigate } from '@s-flex/xfw-url';
import { resolve } from './resolve';
import { localizeI18n } from './flow/utils';
import type { FieldNav } from './flow/types';
import { FieldTooltip, type TooltipConfig, type TooltipFieldConfigEntry } from '../controls/FieldTooltip';

export type TimelineBarConfig = {
  offset_field: string;
  duration_field: string;
  color_field: string;
  title_field?: string;
  group_field?: string;
  set_field?: string;
  /** Field path whose value is the set's display title (string or i18n object). */
  set_title?: string;
  /** Field path whose value is the set's sort order among sibling sets. */
  set_order?: string;
  /** Legacy alias for `set_order`. */
  set_order_field?: string;
  nav?: FieldNav;
  tooltip?: TooltipConfig;
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

function resolveSetTitle(row: JSONRecord, setTitleField: string | undefined, fallback: string): string {
  if (!setTitleField) return fallback;
  const val = resolve(row, setTitleField);
  if (val == null) return fallback;
  if (typeof val === 'string') return val;
  return localizeI18n(val) ?? fallback;
}

function buildGroups(data: JSONRecord[], config: TimelineBarConfig): GroupBlock[] {
  const { group_field, set_field, title_field, set_title } = config;
  const setOrderField = config.set_order ?? config.set_order_field;

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
          const title = resolveSetTitle(row, set_title, key);
          const order = setOrderField ? Number(resolve(row, setOrderField) ?? 0) : 0;
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
  showPlanLabel?: boolean;
  onSegHover?: (seg: Segment, x: number, y: number) => void;
  onSegLeave?: () => void;
  onSegClick?: (seg: Segment) => void;
};

function formatSegmentTime(raw: unknown): string {
  if (raw == null) return '';
  const d = new Date(raw as string | number);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function renderTimelineSvg({
  segments, totalSeconds, startHour, barHeight, svgWidth, svgHeight, fontSize,
  showAxis = true, interactive = false, showPlanLabel = false,
  onSegHover, onSegLeave, onSegClick,
}: TimelineSvgOptions) {
  const totalHours = totalSeconds / 3600;
  const MIN_LABEL_W = 24;

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
        const batchName = showPlanLabel ? String(resolve(seg.row, 'batch_name') ?? '') : '';
        const startTime = showPlanLabel ? formatSegmentTime(seg.row.start_at) : '';
        return (
          <g key={i}>
            <rect
              x={x}
              y={0}
              width={w}
              height={barHeight}
              fill={seg.color}
              onMouseEnter={interactive && onSegHover ? e => onSegHover(seg, e.clientX, e.clientY) : undefined}
              onMouseMove={interactive && onSegHover ? e => onSegHover(seg, e.clientX, e.clientY) : undefined}
              onMouseLeave={interactive && onSegLeave ? onSegLeave : undefined}
              onClick={interactive && onSegClick ? e => { e.stopPropagation(); onSegClick(seg); } : undefined}
              style={{ cursor: interactive && onSegClick ? 'pointer' : 'default' }}
            />
            {showPlanLabel && w >= MIN_LABEL_W && (batchName || startTime) && (
              <foreignObject x={x} y={0} width={w} height={barHeight} style={{ pointerEvents: 'none' }}>
                <div className="timeline-bar-rect-label" style={{ fontSize: fontSize + 1 }}>
                  {batchName && <div className="timeline-bar-rect-label-name">{batchName}</div>}
                  {startTime && <div className="timeline-bar-rect-label-time">{startTime}</div>}
                </div>
              </foreignObject>
            )}
          </g>
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
  fieldConfig,
  tooltip,
  nav,
  onClose,
}: {
  group: GroupBlock;
  totalSeconds: number;
  startHour: number;
  fieldConfig?: Record<string, TooltipFieldConfigEntry>;
  tooltip?: TooltipConfig;
  nav?: FieldNav;
  onClose: () => void;
}) {
  const [container, setContainer] = useState<Element | null>(null);
  const [hover, setHover] = useState<{ seg: Segment; x: number; y: number; } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setContainer(document.querySelector('.planning-viewer'));
  }, []);

  if (totalSeconds <= 0 || !container) return null;
  const hasSets = group.sets.length > 1 || !!group.sets[0]?.title;

  const onSelect = nav?.on_select as { path?: string; params?: ParamDefinition[] } | undefined;
  const handleSegClick = onSelect?.path
    ? (seg: Segment) => {
        const queryParams = (onSelect.params ?? [])
          .filter(p => p.is_query_param)
          .map(p => ({ key: p.key, val: resolve(seg.row, p.key) as JSONValue }));
        navigate({ partialPath: onSelect.path, queryParams });
      }
    : undefined;

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
                    showPlanLabel: set.key === 'plan',
                    onSegHover: (seg, x, y) => setHover({ seg, x, y }),
                    onSegLeave: () => setHover(null),
                    onSegClick: handleSegClick,
                  })}
                </div>
              </div>
            );
          })}
        </div>,
        container
      )}
      <FieldTooltip
        row={hover?.seg.row ?? null}
        x={hover?.x ?? 0}
        y={hover?.y ?? 0}
        fieldConfig={fieldConfig}
        tooltipConfig={tooltip}
      />
    </>
  );
}

export function TimelineBar({ widgetConfig, dataGroup, data }: {
  widgetConfig: TimelineBarConfig;
  dataGroup?: DataGroup;
  data: JSONRecord[];
}) {
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
  const fieldConfig = dataGroup?.field_config as Record<string, FieldConfig> | undefined;

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
          fieldConfig={fieldConfig as Record<string, TooltipFieldConfigEntry> | undefined}
          tooltip={widgetConfig.tooltip}
          nav={widgetConfig.nav}
          onClose={() => setEnlargedGroup(null)}
        />
      )}
    </div>
  );
}
