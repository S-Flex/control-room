import { useRef, useState, useEffect } from 'react';
import type { JSONValue, JSONRecord } from '@s-flex/xfw-data';
import type { FieldConfig, NavItem, ResolvedField } from '@s-flex/xfw-ui';
import { Tooltip, useNavItemAction } from '@s-flex/xfw-ui';
import { Button } from 'react-aria-components';
import { resolveI18nLabel, formatValue, localizeI18n } from '../widgets/flow/utils';
import { resolve } from '../widgets/resolve';
import { useDataGroupContext } from '../widgets/DataGroupContext';
import { IconMap } from './IconMap';
import { Chip } from './Chip';
import { Badge } from './Badge';
import { ImgFromData } from './ImgFromData';
import type { FieldNav } from '../widgets/flow/types';

type TableColumn = {
  key: string;
  label: string;
  class_name?: string;
  field: ResolvedField & { no_label?: boolean; color_field?: string; nav_field?: string; scale?: number };
};

/** Format a numeric value honoring `ui.unit` (e.g. `"seconds"`, `"minutes"`)
 *  and `ui.type` (`"hh:mm"`, `"hh:mm:ss"`, `"mm:ss"`). For non-time `type`s
 *  the value is `toFixed`-rounded by `scale` and the unit is appended as a
 *  suffix unless the type is a duration (then the unit is consumed). */
function formatWithUnit(
  raw: unknown,
  opts: { unit?: string; type?: string; scale?: number },
): string {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!isFinite(n)) return raw == null ? '—' : String(raw);
  const { unit, type, scale } = opts;
  // Time-style displays. Convert to seconds first based on `unit`.
  if (type === 'hh:mm' || type === 'hh:mm:ss' || type === 'mm:ss') {
    const seconds = unit === 'minutes' ? n * 60
      : unit === 'hours' ? n * 3600
      : unit === 'milliseconds' ? n / 1000
      : n; // default: seconds
    const totalSec = Math.max(0, Math.round(seconds));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (type === 'hh:mm:ss') return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (type === 'mm:ss') return `${m}:${String(s).padStart(2, '0')}`;
    return `${h}:${String(m).padStart(2, '0')}`;
  }
  const numStr = typeof scale === 'number'
    ? n.toFixed(scale)
    : (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));
  return unit ? `${numStr} ${unit}` : numStr;
}

/** Build column descriptors for a `control: 'table'` field. A sub-field is
 *  a column iff its key starts with `<parentKey>.` AND its `ui.control` is
 *  `'table-field'`. That's the explicit opt-in: `control: 'table-field'`
 *  marks a field as "for-the-table-only" — it appears as a column here and
 *  is skipped by Cards/Item/FlowBox's standalone field iterators. Sub-keys
 *  without `control: 'table-field'` follow normal field-rendering rules
 *  (i.e. they may appear as standalone fields if not hidden). */
function resolveTableColumns(
  parentKey: string,
  fieldConfig: Record<string, FieldConfig> | undefined,
): TableColumn[] {
  if (!fieldConfig) return [];
  const prefix = parentKey + '.';
  return Object.entries(fieldConfig)
    .filter(([k, cfg]) => k.startsWith(prefix) && cfg.ui?.control === 'table-field')
    .map(([k, cfg]) => {
      const colKey = k.slice(prefix.length);
      const cfgRaw = cfg as Record<string, unknown>;
      const ui = cfg.ui as Record<string, unknown> | undefined;
      const i18n = cfg.ui?.i18n as ResolvedField['i18n'] | undefined;
      const class_name = (cfgRaw.class_name as string | undefined)
        ?? (ui?.class_name as string | undefined)
        ?? (cfg.ui?.group?.class_name as string | undefined);
      return {
        key: k,
        label: resolveI18nLabel(i18n, colKey),
        class_name,
        order: (ui?.order as number | undefined) ?? 999,
        field: {
          key: colKey,
          i18n,
          control: cfg.ui?.control,
          input_data: cfg.input_data,
          color_field: ui?.color_field as string | undefined,
          nav_field: ui?.nav_field as string | undefined,
          scale: ui?.scale as number | undefined,
        },
      };
    })
    .sort((a, b) => a.order - b.order)
    .map(({ key, label, class_name, field }) => ({ key, label, class_name, field }));
}

type FieldProps = {
  field: ResolvedField & {
    aggregate_fn?: string;
    nav?: FieldNav;
    no_label?: boolean;
    scale?: number;
    /** Name of a sibling column on the row whose value supplies the colour. */
    color_field?: string;
    /** Name of a sibling column on the row whose value is a NavItem. When
     *  set, the rendered value becomes a clickable button that fires the
     *  nav action — same pattern as StatusBar's group label. */
    nav_field?: string;
  };
  value: JSONValue;
  showLabel?: boolean;
  row?: JSONRecord;
  /** Pre-computed numerator for `control: 'progress'`. When set, this is the
   *  "done" portion of the progress bar; the field's own `value` is the
   *  total. Used by FlowBox to forward an aggregated done-value alongside
   *  the aggregated total. When unset, Field resolves the done value from
   *  `row[progress_config.value_field]`. */
  progress_value?: JSONValue;
};

function resolveNavPath(nav: FieldNav, row?: JSONRecord): string {
  return (nav.path ?? '').replace(/\{(\w+)\}/g, (_, key) => String(row?.[key] ?? ''));
}

function useIsOverflowing(ref: React.RefObject<HTMLElement | null>) {
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return overflowing;
}

function FieldValue({ text, nav, navUrl, row, className }: {
  text: string;
  nav?: FieldNav;
  navUrl?: string;
  row?: JSONRecord;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const overflowing = useIsOverflowing(ref);
  const navAction = useNavItemAction();
  const isInteractive = !!nav && (!!nav.on_select || !!navUrl);
  const needsTooltip = overflowing || isInteractive;

  const handleClick = isInteractive ? (e: React.MouseEvent) => {
    if (nav?.on_select) {
      e.stopPropagation();
      navAction(row, nav.on_select as NavItem, true);
      return;
    }
    if (!navUrl) return;
    if (!e.ctrlKey && !e.metaKey) return;
    e.stopPropagation();
    const w = window.open(navUrl, '_blank');
    w?.focus();
  } : undefined;

  const tooltipParts: string[] = [];
  if (overflowing) tooltipParts.push(text);
  if (nav?.on_select) tooltipParts.push('click → open');
  else if (nav && navUrl) tooltipParts.push(`ctrl + click → ${navUrl}`);

  const span = (
    <span ref={ref} className={`field-value-text${isInteractive ? ' field-nav' : ''}${className ? ` ${className}` : ''}`} onClick={handleClick}>
      {text}
    </span>
  );

  return (
    <>
      {needsTooltip ? (
        <Tooltip title={tooltipParts.join(' | ')} placement="top" delay={200}>
          <Button className="field-tooltip-trigger" excludeFromTabOrder>
            {span}
          </Button>
        </Tooltip>
      ) : span}
    </>
  );
}

export function Field({ field, value, showLabel, row, progress_value }: FieldProps) {
  const { control, input_data, nav, no_label, scale, color_field, nav_field } = field;
  const label = resolveI18nLabel(field.i18n, field.key);
  const shouldShowLabel = showLabel ?? !no_label;
  // `color_field` is the *name* of another field in the data group; the actual
  // colour string is the value of that field on the current row. Use the
  // dot-path-aware `resolve()` so paths like `state.color` work.
  const colorRaw = color_field && row ? resolve(row, color_field) : undefined;
  const color = typeof colorRaw === 'string' && colorRaw ? colorRaw : undefined;
  // `nav_field` points at a sibling row column whose value is a NavItem.
  // When present, the rendered value is wrapped in a button that fires the
  // nav (mirrors `StatusBar`'s clickable group-label). The data group's
  // primary keys are pulled from context and forwarded as `extraParamKeys`
  // so the row's identity flows into the URL on navigate — matching the
  // generic Cards / FlowBoard / Item nav behavior.
  const navItemRaw = nav_field && row ? resolve(row, nav_field) : undefined;
  const navItem = navItemRaw && typeof navItemRaw === 'object' && !Array.isArray(navItemRaw)
    ? (navItemRaw as unknown as NavItem)
    : null;
  const { primaryKeys, fieldConfig } = useDataGroupContext();
  const fieldNavAction = useNavItemAction(undefined, undefined, { extraParamKeys: primaryKeys });

  // `control: 'table'` — value is a JSON array; columns come from
  // field_config entries keyed `<field.key>.<column>`. The cells render as
  // a flat fragment of header + data divs; no extra wrapper here. The
  // PARENT of these cells is the wrapper that Cards / FlowBox / Item
  // already create around `<Field>` with the field's own `class_name`
  // (e.g. `"col-span-6"` to position in the card grid, or
  // `"col-span-6 grid grid-cols-3 gap-1"` to also act as the table's grid
  // container). Each cell carries its column's own `class_name`.
  if (control === 'table' && Array.isArray(value)) {
    const rows = value as JSONRecord[];
    // Empty array → render nothing at all (no header row, no wrapper).
    if (rows.length === 0) return null;
    const cols = resolveTableColumns(field.key, fieldConfig);
    if (cols.length === 0) return null;
    return (
      <>
        {cols.map(c => (
          <div key={`h-${c.key}`} className={c.class_name || undefined}>
            <span className="field-label">{c.label}</span>
          </div>
        ))}
        {rows.flatMap((tableRow, i) =>
          cols.map(c => (
            <div key={`${i}-${c.key}`} className={c.class_name || undefined}>
              <Field
                field={c.field}
                value={resolve(tableRow, c.field.key) as JSONValue}
                row={tableRow}
                showLabel={false}
              />
            </div>
          ))
        )}
      </>
    );
  }

  // useNavItemAction's navigate branch only writes `data[key]` to the URL —
  // unlike its `func` branch, it doesn't fall back to `param.default_value`
  // or `param.val`. Pre-fill those keys on a synthetic row so the library's
  // generic param-merge picks them up via its existing data[key] read.
  const fireNav = (item: NavItem) => {
    const params = ((item as unknown as { params?: Array<{ key: string; val?: unknown; default_value?: unknown }> }).params) ?? [];
    let data: JSONRecord | undefined = row;
    for (const p of params) {
      const fallback = (p.val ?? p.default_value) as JSONValue | undefined;
      if (fallback !== undefined && (data?.[p.key] === undefined || data?.[p.key] === null)) {
        data = { ...(data ?? {}), [p.key]: fallback };
      }
    }
    fieldNavAction(data, item, true);
  };

  // `control: 'progress'` — render a small horizontal bar with
  // `progress_value` (done) over `value` (total). For aggregated cells the
  // caller passes an already-aggregated `progress_value`; otherwise we
  // resolve `progress_config.value_field` from `row`. `ui.unit` and
  // `ui.type` (e.g. `"hh:mm"`) format the displayed numbers — both done
  // and total go through the same formatter so the ratio reads naturally.
  if (control === 'progress') {
    const fcEntry = fieldConfig?.[field.key];
    const fcUi = fcEntry?.ui as Record<string, unknown> | undefined;
    const progressConfig = fcUi?.progress_config as { value_field?: string } | undefined;
    const valueField = progressConfig?.value_field;
    const unit = fcUi?.unit as string | undefined;
    const type = fcUi?.type as string | undefined;
    const totalNum = Number(value ?? 0);
    const doneRaw = progress_value !== undefined && progress_value !== null
      ? progress_value
      : (valueField && row ? resolve(row, valueField) : 0);
    const doneNum = Number(doneRaw ?? 0);
    const finite = isFinite(totalNum) && isFinite(doneNum);
    const pct = finite && totalNum > 0
      ? Math.min(100, Math.max(0, (doneNum / totalNum) * 100))
      : 0;
    const fmt = (n: number) => formatWithUnit(n, { unit, type, scale });
    return (
      <div className="field-progress">
        {shouldShowLabel && <span className="field-progress-label">{label}</span>}
        <div className="field-progress-track">
          <div className="field-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="field-progress-value">{fmt(doneNum)} / {fmt(totalNum)}</span>
      </div>
    );
  }

  // Visual controls (icon-map / badge / chip): label hidden by default — the
  // visual *is* the meaning. Opt back in via `field_config.<key>.ui.no_label = false`
  // (which flips `shouldShowLabel` to true). Per-row colour comes from
  // `field_config.<key>.color_field` pointing at a sibling column on the row.
  if (control === 'icon-map' && input_data) {
    return (
      <div className="field-center-aligned">
        <IconMap value={value} inputData={input_data} label={label} showLabel={shouldShowLabel} color={color} />
      </div>
    );
  }
  if (control === 'badge') {
    return (
      <div className="field-center-aligned">
        <Badge value={value} inputData={input_data} nav={nav} row={row} label={label} showLabel={shouldShowLabel} color={color} />
      </div>
    );
  }
  if (control === 'img') {
    if (!value) return null;
    if (shouldShowLabel) {
      return (
        <div className="field-with-label">
          <span className="field-label">{label}</span>
          <img src={String(value)} alt={label} className="field-img" />
        </div>
      );
    }
    return <img src={String(value)} alt={label} className="field-img" />;
  }
  if (control === 'img-from-data') {
    if (!Array.isArray(value)) return null;
    const bytes = value as number[];
    if (shouldShowLabel) {
      return (
        <div className="field-with-label">
          <span className="field-label">{label}</span>
          <ImgFromData data={bytes} alt={label} className="field-img" />
        </div>
      );
    }
    return <ImgFromData data={bytes} alt={label} className="field-img" />;
  }
  // Chip is opt-in via `control: 'chip'`. Previously any field with
  // `aggregate_fn` rendered as Chip — that surprised consumers because
  // `aggregate_fn` is purely a data-side instruction (sum/count/avg/...).
  // Now `aggregate_fn` only governs the value computation; the visual
  // requires explicit `control: 'chip'`.
  if (control === 'chip') {
    return <div className="field-center-aligned"><Chip label={label} value={value as string | number} /></div>;
  }

  if ((control === 'i18n-text' || control === 'content') && value && typeof value === 'object' && !Array.isArray(value)) {
    const text = localizeI18n(value);
    if (text) {
      const valueEl = navItem
        ? (
          <button
            type="button"
            className="field-value field-nav-button"
            onClick={(e) => { e.stopPropagation(); fireNav(navItem); }}
          >
            {text}
          </button>
        )
        : <span className="field-value">{text}</span>;
      if (shouldShowLabel) {
        return (
          <div className="field-with-label">
            <span className="field-label">{label}</span>
            {valueEl}
          </div>
        );
      }
      return navItem
        ? (
          <button
            type="button"
            className="field-nav-button"
            onClick={(e) => { e.stopPropagation(); fireNav(navItem); }}
          >
            {text}
          </button>
        )
        : <span>{text}</span>;
    }
  }

  // Apply `ui.unit` / `ui.type` formatting (e.g. seconds → `hh:mm`) for any
  // plain numeric value before falling back to the generic `formatValue`.
  const fcEntryDefault = fieldConfig?.[field.key];
  const fcUiDefault = fcEntryDefault?.ui as Record<string, unknown> | undefined;
  const unitDefault = fcUiDefault?.unit as string | undefined;
  const typeDefault = fcUiDefault?.type as string | undefined;
  const isTimeType = typeDefault === 'hh:mm' || typeDefault === 'hh:mm:ss' || typeDefault === 'mm:ss';
  const formatted = (isTimeType || (unitDefault && typeof value === 'number'))
    ? formatWithUnit(value, { unit: unitDefault, type: typeDefault, scale })
    : formatValue(value, control, scale);
  const navUrl = nav ? resolveNavPath(nav, row) : undefined;

  if (shouldShowLabel) {
    return (
      <div className="field-with-label">
        <span className="field-label">{label}</span>
        <FieldValue text={formatted} nav={nav} navUrl={navUrl} row={row} className="field-value" />
      </div>
    );
  }

  return <FieldValue text={formatted} nav={nav} navUrl={navUrl} row={row} />;
}
