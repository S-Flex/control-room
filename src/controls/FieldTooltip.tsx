import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { JSONRecord, JSONValue } from '@s-flex/xfw-data';
import type { FieldConfig, ResolvedField } from '@s-flex/xfw-ui';
import { getLanguage } from 'xfw-get-block';
import { resolve, isFieldVisible } from '../widgets/resolve';
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

type FieldEntry = {
  key: string;
  order: number;
  control?: string;
  scale?: number;
  i18n?: Record<string, Record<string, string>>;
  hidden_when?: unknown;
  no_label: boolean;
};

function resolveControl(fc: TooltipFieldConfigEntry | undefined): string | undefined {
  if (!fc) return undefined;
  const top = (fc as Record<string, unknown>).control as string | undefined;
  const ui = fc.ui as Record<string, unknown> | undefined;
  return top ?? (ui?.control as string | undefined) ?? (ui?.type as string | undefined);
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
      no_label: false,
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
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    // i18n object
    const i18n = val as Record<string, Record<string, string>>;
    const localized = i18n[lang] ?? i18n[Object.keys(i18n)[0]];
    return localized?.title ?? localized?.text ?? null;
  }
  if (val != null) return String(val);
  const fc = fieldConfig?.[titleField];
  const i18n = (fc?.ui as Record<string, unknown> | undefined)?.i18n as
    Record<string, Record<string, string>> | undefined;
  return i18n?.[lang]?.title ?? null;
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
  tooltipConfig?: Record<string, TooltipFieldConfigEntry>;
  title?: ReactNode;
  titleField?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const lang = getLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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

  if (!row || !mounted) return null;

  const entries = buildEntries(fieldConfig, tooltipConfig);
  const header = resolveHeaderText(title, row, titleField, fieldConfig, lang);

  const body = (
    <div
      ref={ref}
      className={`field-tooltip${className ? ` ${className}` : ''}`}
      style={{ left: pos.left, top: pos.top }}
    >
      {header && <div className="field-tooltip-title">{header}</div>}
      {entries.map(entry => {
        if (!isFieldVisible({ hidden_when: entry.hidden_when }, row)) return null;
        const value = resolve(row, entry.key) as JSONValue;
        if (value == null) return null;
        const label = entry.i18n?.[lang]?.title
          ?? entry.i18n?.[Object.keys(entry.i18n ?? {})[0]]?.title
          ?? entry.key;
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
      })}
    </div>
  );

  return createPortal(body, document.body);
}
