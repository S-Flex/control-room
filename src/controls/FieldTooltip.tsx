import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { JSONRecord, JSONValue } from '@s-flex/xfw-data';
import type { FieldConfig, ResolvedField } from '@s-flex/xfw-ui';
import { getLanguage } from 'xfw-get-block';
import { resolve, isFieldVisible } from '../widgets/resolve';
import { localizeI18n, resolveI18nLabel } from '../widgets/flow/utils';
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
};

export type TooltipConfig = {
  sections?: TooltipSectionConfig[];
  /** Legacy flat shape — equivalent to `{ sections: [{ field_config }] }`. */
  field_config?: Record<string, TooltipFieldConfigEntry>;
};

type FieldEntry = {
  key: string;
  order: number;
  control?: string;
  scale?: number;
  i18n?: Record<string, Record<string, string>>;
  hidden_when?: unknown;
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
    const ui = (merged.ui ?? {}) as Record<string, unknown>;
    if (ui.hidden) continue;
    entries.push({
      key,
      order: (ui.order as number | undefined) ?? 999,
      control: resolveControl(merged),
      scale: ui.scale as number | undefined,
      i18n: ui.i18n as Record<string, Record<string, string>> | undefined,
      hidden_when: ui.hidden_when,
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
}: {
  row: JSONRecord | null;
  x: number;
  y: number;
  fieldConfig?: Record<string, TooltipFieldConfigEntry>;
  tooltipConfig?: TooltipConfig;
  title?: ReactNode;
  titleField?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const shiftHeld = useShiftHeld();
  const lang = getLanguage();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x + 12;
    let top = y - 10;
    if (left + rect.width > vw - 8) left = Math.max(8, x - rect.width - 12);
    if (top + rect.height > vh - 8) top = Math.max(8, vh - rect.height - 8);
    if (top < 8) top = 8;
    setPos({ left, top });
  }, [x, y, row]);

  const sections = useMemo(
    () => normalizeSections(tooltipConfig, fieldConfig).map(s =>
      buildEntries(fieldConfig, s.field_config),
    ),
    [fieldConfig, tooltipConfig],
  );

  if (!row || shiftHeld || typeof document === 'undefined') return null;

  const header = resolveHeaderText(title, row, titleField, fieldConfig, lang);

  const renderEntry = (entry: FieldEntry) => {
    if (!isFieldVisible({ hidden_when: entry.hidden_when }, row)) return null;
    const value = resolve(row, entry.key) as JSONValue;
    if (value == null) return null;
    const label = resolveI18nLabel(entry.i18n, entry.key);
    const field: ResolvedField & { no_label?: boolean; scale?: number } = {
      key: entry.key,
      control: entry.control,
      i18n: entry.i18n,
      no_label: true,
      scale: entry.scale,
    } as ResolvedField & { no_label?: boolean; scale?: number };
    return (
      <div key={entry.key} className="field-tooltip-row">
        <span className="field-tooltip-label">{label}</span>
        <span className="field-tooltip-value">
          <Field field={field} value={value} row={row} />
        </span>
      </div>
    );
  };

  const body = (
    <div
      ref={ref}
      className={`field-tooltip${className ? ` ${className}` : ''}`}
      style={{ left: pos.left, top: pos.top }}
    >
      {header && <div className="field-tooltip-title">{header}</div>}
      {sections.flatMap((entries, i) => [
        i > 0 && <hr key={`div-${i}`} className="field-tooltip-divider" />,
        ...entries.map(renderEntry),
      ])}
    </div>
  );

  return createPortal(body, document.body);
}
