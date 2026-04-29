import { useRef, useState, useEffect } from 'react';
import type { JSONValue, JSONRecord } from '@s-flex/xfw-data';
import type { NavItem, ResolvedField } from '@s-flex/xfw-ui';
import { Tooltip, useNavItemAction } from '@s-flex/xfw-ui';
import { Button } from 'react-aria-components';
import { resolveI18nLabel, formatValue, localizeI18n } from '../widgets/flow/utils';
import { resolve } from '../widgets/resolve';
import { useDataGroupContext } from '../widgets/DataGroupContext';
import { IconMap } from './IconMap';
import { Chip } from './Chip';
import { Badge } from './Badge';
import type { FieldNav } from '../widgets/flow/types';

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

export function Field({ field, value, showLabel, row }: FieldProps) {
  const { control, input_data, aggregate_fn, nav, no_label, scale, color_field, nav_field } = field;
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
  const { primaryKeys } = useDataGroupContext();
  const fieldNavAction = useNavItemAction(undefined, undefined, { extraParamKeys: primaryKeys });

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
  if (aggregate_fn) {
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

  const formatted = formatValue(value, control, scale);
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
