import type { InputData, JSONRecord, JSONValue } from '@s-flex/xfw-data';
import { useNavItemAction, type NavItem } from '@s-flex/xfw-ui';
import { useNavigate } from '@s-flex/xfw-url';
import type { FieldNav } from '../widgets/flow/types';
import { localizeI18n } from '../widgets/flow/utils';

function resolveNavPath(path: string, row?: JSONRecord): string {
  return path.replace(/\{(\w+)\}/g, (_, key) => String(row?.[key] ?? ''));
}

type BadgeResolved = {
  text: string;
  class_name?: string;
};

function resolveBadge(value: JSONValue, inputData?: InputData): BadgeResolved {
  // i18n-shaped value (e.g. a field with `control: badge` and `type:
  //  i18n-text`, or any value that already carries `{ <lang>: { title } }`).
  //  Localise first so the badge text isn't `[object Object]`.
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const localized = localizeI18n(value);
    if (localized) return { text: localized };
  }
  if (!inputData?.options) return { text: String(value ?? '—') };
  const valueKey = inputData.value_key || 'id';
  const labelKey = inputData.label_key || 'content';
  const match = inputData.options.find(o => o[valueKey] === value || String(o[valueKey]) === String(value));
  if (!match) return { text: String(value ?? '—') };
  const content = match[labelKey];
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const c = content as Record<string, JSONValue>;
    const text = String(c.title ?? c.text ?? c.label ?? value ?? '—');
    const class_name = c.class_name as string | undefined;
    return { text, class_name };
  }
  return { text: String(content ?? value ?? '—') };
}

export function Badge({ value, inputData, nav, row, label, showLabel = true, color }: {
  value: JSONValue;
  inputData?: InputData;
  nav?: FieldNav;
  row?: JSONRecord;
  /** Optional pre-resolved label (e.g. localized title from i18n). When set,
   *  the badge text becomes `<label>: <value>` — unless `showLabel` is false. */
  label?: string;
  /** Whether to prefix the value with the label. Defaults to `true`. */
  showLabel?: boolean;
  /** Optional CSS color string applied as the badge background (text becomes white). */
  color?: string;
}) {
  const navAction = useNavItemAction();
  const navigate = useNavigate();
  const interactive = !!(nav?.on_select || nav?.path);

  const handleClick = interactive ? (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nav?.on_select) {
      navAction(row, nav.on_select as NavItem, true);
      return;
    }
    if (nav?.path) {
      const resolved = resolveNavPath(nav.path, row);
      if (/^https?:\/\//.test(resolved)) window.open(resolved, '_blank')?.focus();
      else navigate(resolved);
    }
  } : undefined;

  const cls = (extra?: string) =>
    ['badge', extra, interactive ? 'badge-nav' : null].filter(Boolean).join(' ');

  const inlineStyle: React.CSSProperties | undefined = color
    ? { background: color, borderColor: color, color: '#fff' }
    : undefined;

  const decorate = (text: string): string =>
    label && showLabel ? `${label}: ${text}` : text;

  if (Array.isArray(value)) {
    return (
      <span className="badge-list">
        {value.map((v, i) => {
          const { text, class_name } = resolveBadge(v, inputData);
          const display = decorate(text);
          return (
            <span key={i} className={cls(class_name)} title={display} style={inlineStyle} onClick={handleClick}>
              {display}
            </span>
          );
        })}
      </span>
    );
  }
  const { text, class_name } = resolveBadge(value, inputData);
  const display = decorate(text);
  return (
    <span className={cls(class_name)} title={display} style={inlineStyle} onClick={handleClick}>
      {display}
    </span>
  );
}
