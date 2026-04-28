import { useRef, useState, useEffect } from 'react';
import type { JSONValue, JSONRecord } from '@s-flex/xfw-data';
import type { NavItem, ResolvedField } from '@s-flex/xfw-ui';
import { Tooltip, useNavItemAction } from '@s-flex/xfw-ui';
import { Button } from 'react-aria-components';
import { resolveI18nLabel, formatValue, localizeI18n } from '../widgets/flow/utils';
import { resolve } from '../widgets/resolve';
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
  const { control, input_data, aggregate_fn, nav, no_label, scale, color_field } = field;
  const label = resolveI18nLabel(field.i18n, field.key);
  const shouldShowLabel = showLabel ?? !no_label;
  // `color_field` is the *name* of another field in the data group; the actual
  // colour string is the value of that field on the current row. Use the
  // dot-path-aware `resolve()` so paths like `state.color` work.
  const colorRaw = color_field && row ? resolve(row, color_field) : undefined;
  const color = typeof colorRaw === 'string' && colorRaw ? colorRaw : undefined;

  // Visual controls (icon-map / badge / chip): label hidden by default — the
  // visual *is* the meaning. Opt back in via `field_config.<key>.ui.no_label = false`
  // (which flips `shouldShowLabel` to true). Per-row colour comes from
  // `field_config.<key>.color_field` pointing at a sibling column on the row.
  if (control === 'icon-map' && input_data) {
    return (
      <div className="field-bottom-aligned">
        <IconMap value={value} inputData={input_data} label={label} showLabel={shouldShowLabel} color={color} />
      </div>
    );
  }
  if (control === 'badge') {
    return (
      <div className="field-bottom-aligned">
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
    return <div className="field-bottom-aligned"><Chip label={label} value={value as string | number} /></div>;
  }

  if ((control === 'i18n-text' || control === 'content') && value && typeof value === 'object' && !Array.isArray(value)) {
    const text = localizeI18n(value);
    if (text) {
      if (shouldShowLabel) {
        return (
          <div className="field-with-label">
            <span className="field-label">{label}</span>
            <span className="field-value">{text}</span>
          </div>
        );
      }
      return <span>{text}</span>;
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
