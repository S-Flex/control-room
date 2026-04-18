import type { InputData, JSONRecord, JSONValue } from '@s-flex/xfw-data';
import { useNavItemAction, type NavItem } from '@s-flex/xfw-ui';
import { useNavigate } from '@s-flex/xfw-url';
import type { FieldNav } from '../widgets/flow/types';

function resolveNavPath(path: string, row?: JSONRecord): string {
  return path.replace(/\{(\w+)\}/g, (_, key) => String(row?.[key] ?? ''));
}

type BadgeResolved = {
  text: string;
  class_name?: string;
};

function resolveBadge(value: JSONValue, inputData?: InputData): BadgeResolved {
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

export function Badge({ value, inputData, nav, row }: {
  value: JSONValue;
  inputData?: InputData;
  nav?: FieldNav;
  row?: JSONRecord;
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

  if (Array.isArray(value)) {
    return (
      <span className="badge-list">
        {value.map((v, i) => {
          const { text, class_name } = resolveBadge(v, inputData);
          return (
            <span key={i} className={cls(class_name)} title={text} onClick={handleClick}>
              {text}
            </span>
          );
        })}
      </span>
    );
  }
  const { text, class_name } = resolveBadge(value, inputData);
  return (
    <span className={cls(class_name)} title={text} onClick={handleClick}>
      {text}
    </span>
  );
}
