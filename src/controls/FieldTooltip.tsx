import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { JSONRecord, JSONValue } from '@s-flex/xfw-data';
import type { FieldConfig, ResolvedField } from '@s-flex/xfw-ui';
import { getLanguage } from 'xfw-get-block';
import { resolve, isFieldVisible } from '../widgets/resolve';
import { localizeI18n, resolveI18nLabel } from '../widgets/flow/utils';
import { resolveGroupItems, relativeKey, type FieldGroupConfig } from '../widgets/groupUtils';
import { Field } from './Field';

export type TooltipFieldConfigEntry = FieldConfig & {
  ui?: FieldConfig['ui'] & {
    order?: number;
    title?: string;
    scale?: number;
    hidden?: boolean;
    hidden_when?: unknown;
    i18n?: Record<string, Record<string, string>>;
  };
};

export type TooltipSectionConfig = {
  field_config?: Record<string, TooltipFieldConfigEntry>;
  /** Render an array/record at `group.data_field` as repeated rows using the
   *  sub-fields defined in `group.field_config`. See `groupUtils.ts`. */
  group?: FieldGroupConfig<TooltipFieldConfigEntry>;
};

export type TooltipConfig = {
  sections?: TooltipSectionConfig[];
  /** Legacy flat shape — equivalent to `{ sections: [{ field_config }] }`. */
  field_config?: Record<string, TooltipFieldConfigEntry>;
  /** Row-level predicate. When it matches, the entire tooltip is suppressed. */
  hidden_when?: unknown;
};

type FieldEntry = {
  key: string;
  order: number;
  control?: string;
  scale?: number;
  i18n?: Record<string, Record<string, string>>;
  hidden_when?: unknown;
  class_name?: string;
};

function resolveControl(fc: TooltipFieldConfigEntry | undefined): string | undefined {
  if (!fc) return undefined;
  const raw = fc as Record<string, unknown>;
  const ui = fc.ui as Record<string, unknown> | undefined;
  return (raw.control as string | undefined)
    ?? (raw.type as string | undefined)
    ?? (ui?.control as string | undefined)
    ?? (ui?.type as string | undefined);
}

function mergeEntry(
  base: TooltipFieldConfigEntry | undefined,
  override: TooltipFieldConfigEntry | undefined,
): TooltipFieldConfigEntry {
  const baseUi = (base?.ui ?? {}) as Record<string, unknown>;
  const overUi = (override?.ui ?? {}) as Record<string, unknown>;
  return {
    ...base,
    ...override,
    ui: { ...baseUi, ...overUi },
  } as TooltipFieldConfigEntry;
}

function buildEntries(
  fieldConfig: Record<string, TooltipFieldConfigEntry> | undefined,
  tooltipConfig: Record<string, TooltipFieldConfigEntry> | undefined,
): FieldEntry[] {
  // Only keys present in tooltipConfig are rendered; fieldConfig supplies labels/controls.
  const source = tooltipConfig ?? fieldConfig ?? {};
  const entries: FieldEntry[] = [];
  for (const [key, raw] of Object.entries(source)) {
    const merged = mergeEntry(fieldConfig?.[key], raw);
    const mergedRaw = merged as Record<string, unknown>;
    const ui = (merged.ui ?? {}) as Record<string, unknown>;
    if (ui.hidden) continue;
    entries.push({
      key,
      order: (ui.order as number | undefined) ?? 999,
      control: resolveControl(merged),
      // `scale` may live under ui.scale (FieldConfig override) or at the entry/PgField
      // top level (schema-derived). Accept either so PgField.scale flows through.
      scale: (ui.scale as number | undefined) ?? (mergedRaw.scale as number | undefined),
      i18n: ui.i18n as Record<string, Record<string, string>> | undefined,
      hidden_when: ui.hidden_when,
      class_name: (mergedRaw.class_name as string | undefined)
        ?? (ui.class_name as string | undefined),
    });
  }
  entries.sort((a, b) => a.order - b.order);
  return entries;
}

function resolveHeaderText(
  title: ReactNode | undefined,
  row: JSONRecord | null,
  titleField: string | undefined,
  fieldConfig: Record<string, TooltipFieldConfigEntry> | undefined,
  lang: string,
): ReactNode {
  if (title !== undefined) return title;
  if (!row || !titleField) return null;
  const val = resolve(row, titleField);
  const localized = localizeI18n(val, lang);
  if (localized) return localized;
  if (val != null && typeof val !== 'object') return String(val);
  return localizeI18n((fieldConfig?.[titleField]?.ui as Record<string, unknown> | undefined)?.i18n, lang) ?? null;
}

function normalizeSections(
  tooltipConfig: TooltipConfig | undefined,
  fieldConfig: Record<string, TooltipFieldConfigEntry> | undefined,
): TooltipSectionConfig[] {
  if (tooltipConfig?.sections) return tooltipConfig.sections;
  if (tooltipConfig?.field_config) return [{ field_config: tooltipConfig.field_config }];
  if (fieldConfig) return [{ field_config: fieldConfig }];
  return [];
}

// Module-scoped Shift tracking. Listeners install eagerly at module load so
// state is already being tracked when the first FieldTooltip mounts — we
// never miss a shift press because the component wasn't there yet.
// We also sample `shiftKey` from mouse/wheel events so focus quirks that
// swallow keydown on some OSes can't desync us.
let _shiftHeld = false;
const _shiftSubs = new Set<() => void>();

if (typeof window !== 'undefined') {
  const notify = () => _shiftSubs.forEach(fn => fn());
  const setHeld = (v: boolean) => {
    if (_shiftHeld === v) return;
    _shiftHeld = v;
    notify();
  };
  window.addEventListener('keydown', e => {
    if (e.key === 'Shift' || e.shiftKey) setHeld(true);
  }, { capture: true });
  window.addEventListener('keyup', e => {
    if (e.key === 'Shift') setHeld(false);
  }, { capture: true });
  window.addEventListener('blur', () => setHeld(false));
  // Defensive sync: any mouse-family or wheel event carries the current
  // shiftKey flag. This catches the case where the user was already holding
  // Shift before any keyboard event could reach the window.
  const syncFromEvent = (e: MouseEvent | WheelEvent) => setHeld(e.shiftKey);
  window.addEventListener('mousemove', syncFromEvent, { capture: true, passive: true });
  window.addEventListener('mousedown', syncFromEvent, { capture: true, passive: true });
  window.addEventListener('wheel', syncFromEvent, { capture: true, passive: true });
}

function subscribeShift(fn: () => void) {
  _shiftSubs.add(fn);
  return () => { _shiftSubs.delete(fn); };
}

function getShiftSnapshot() {
  return _shiftHeld;
}

function useShiftHeld() {
  return useSyncExternalStore(subscribeShift, getShiftSnapshot, () => false);
}

export function FieldTooltip({
  row,
  x,
  y,
  fieldConfig,
  tooltipConfig,
  title,
  titleField,
  className,
  inline,
}: {
  row: JSONRecord | null;
  /** Required for the default portal-positioned tooltip. Ignored when `inline` is true. */
  x?: number;
  y?: number;
  fieldConfig?: Record<string, TooltipFieldConfigEntry>;
  tooltipConfig?: TooltipConfig;
  title?: ReactNode;
  titleField?: string;
  className?: string;
  /** When true: render inline (no portal, no absolute positioning, no shift-to-hide).
   *  Lets callers anchor the tooltip themselves — e.g. inside drei's <Html> for a 3D scene. */
  inline?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x ?? 0, top: y ?? 0 });
  const shiftHeld = useShiftHeld();
  const lang = getLanguage();

  useLayoutEffect(() => {
    if (inline) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = (x ?? 0) + 12;
    let top = (y ?? 0) - 10;
    if (left + rect.width > vw - 8) left = Math.max(8, (x ?? 0) - rect.width - 12);
    if (top + rect.height > vh - 8) top = Math.max(8, vh - rect.height - 8);
    if (top < 8) top = 8;
    setPos({ left, top });
  }, [x, y, row, inline]);

  const sections = useMemo(
    () => normalizeSections(tooltipConfig, fieldConfig),
    [fieldConfig, tooltipConfig],
  );

  if (!row) return null;
  if (!inline && (shiftHeld || typeof document === 'undefined')) return null;

  // Top-level hidden_when: suppress the entire tooltip when the predicate matches.
  if (tooltipConfig?.hidden_when && !isFieldVisible({ hidden_when: tooltipConfig.hidden_when }, row)) {
    return null;
  }

  const header = resolveHeaderText(title, row, titleField, fieldConfig, lang);

  const buildField = (entry: FieldEntry): ResolvedField & { no_label?: boolean; scale?: number } => ({
    key: entry.key,
    control: entry.control,
    i18n: entry.i18n,
    no_label: true,
    scale: entry.scale,
  } as ResolvedField & { no_label?: boolean; scale?: number });

  const renderValue = (entry: FieldEntry, value: JSONValue, source: JSONRecord) => {
    // Inline tooltips can be rendered inside contexts that don't have the
    // NavigationProvider (e.g. drei's <Html> inside an r3f Canvas). The Field
    // component calls useNavItemAction unconditionally and would crash there,
    // so render a simple text cell in inline mode.
    if (inline) {
      if (value == null) return null;
      if (entry.scale != null) {
        const n = typeof value === 'number' ? value : Number(value);
        if (!Number.isNaN(n)) return <>{n.toFixed(entry.scale)}</>;
      }
      return <>{String(value)}</>;
    }
    return <Field field={buildField(entry)} value={value} row={source} />;
  };

  const renderEntry = (entry: FieldEntry, source: JSONRecord, keySuffix: string, resolveKey: string) => {
    if (!isFieldVisible({ hidden_when: entry.hidden_when }, source)) return null;
    const value = resolve(source, resolveKey) as JSONValue;
    if (value == null) return null;
    const label = resolveI18nLabel(entry.i18n, entry.key);
    return (
      <div key={`${entry.key}-${keySuffix}`} className={`field-tooltip-row${entry.class_name ? ` ${entry.class_name}` : ''}`}>
        <span className="field-tooltip-label">{label}</span>
        <span className="field-tooltip-value">{renderValue(entry, value, source)}</span>
      </div>
    );
  };

  const renderSection = (section: TooltipSectionConfig, sectionIdx: number): ReactNode => {
    if (section.group) {
      const { data_field, field_config, class_name: groupClass } = section.group;
      const items = resolveGroupItems(row, data_field);
      if (items.length === 0) return null;
      const subEntries = buildEntries(fieldConfig, field_config);
      if (subEntries.length === 0) return null;
      // When the caller supplies their own grid classes (e.g. Tailwind
      // `grid grid-cols-6 gap-1`), skip our default `.field-tooltip-group`
      // styling so it doesn't override their layout. Their classes own the
      // wrapper; ours only kick in when no override is given.
      const wrapperClass = groupClass
        ? groupClass
        : 'field-tooltip-group';
      const wrapperStyle = groupClass
        ? undefined
        : { ['--field-tooltip-group-cols' as string]: subEntries.length };
      return (
        <div key={`group-${sectionIdx}`} className={wrapperClass} style={wrapperStyle}>
          {subEntries.map(entry => (
            <div
              key={`h-${entry.key}`}
              className={`field-tooltip-group-header-cell${entry.class_name ? ` ${entry.class_name}` : ''}`}
            >
              {resolveI18nLabel(entry.i18n, entry.key)}
            </div>
          ))}
          {items.flatMap((item, itemIdx) =>
            subEntries.map(entry => {
              const resolveKey = relativeKey(data_field, entry.key);
              const value = resolve(item, resolveKey) as JSONValue;
              return (
                <div key={`${itemIdx}-${entry.key}`} className={entry.class_name || undefined}>
                  {value == null ? '—' : renderValue(entry, value, item)}
                </div>
              );
            })
          )}
        </div>
      );
    }
    const entries = buildEntries(fieldConfig, section.field_config);
    return entries.map(entry => renderEntry(entry, row, `${sectionIdx}`, entry.key));
  };

  // Render each section eagerly so we can detect "no content" and skip rendering.
  const renderedSections: ReactNode[] = [];
  for (let i = 0; i < sections.length; i++) {
    const node = renderSection(sections[i], i);
    if (node == null) continue;
    if (Array.isArray(node) && node.every(n => n == null || n === false)) continue;
    renderedSections.push(node);
  }

  if (!header && renderedSections.length === 0) return null;

  const body = (
    <div
      ref={ref}
      className={`field-tooltip${inline ? ' field-tooltip-inline' : ''}${className ? ` ${className}` : ''}`}
      style={inline ? undefined : { left: pos.left, top: pos.top }}
    >
      {header && <div className="field-tooltip-title">{header}</div>}
      {renderedSections.flatMap((node, i) => [
        i > 0 && <hr key={`div-${i}`} className="field-tooltip-divider" />,
        node,
      ])}
    </div>
  );

  if (inline) return body;
  return createPortal(body, document.body);
}
