import type { JSONValue } from '@s-flex/xfw-data';
import type { ResolvedField } from '@s-flex/xfw-ui';
import { toDisplayLabel } from '@s-flex/xfw-ui';
import { getLanguage } from 'xfw-get-block';
import { IconMap } from './IconMap';
import { Chip } from './Chip';

type FieldProps = {
  field: ResolvedField & { aggregate?: string };
  value: JSONValue;
};

/** Resolve label from i18n, checking both title and label keys. */
function resolveFieldLabel(i18n: ResolvedField['i18n'], key: string): string {
  if (i18n) {
    const lang = getLanguage();
    const entry = (i18n as Record<string, Record<string, string> | undefined>)[lang];
    if (entry?.title) return entry.title;
    if (entry?.label) return entry.label;
    for (const v of Object.values(i18n as Record<string, Record<string, string> | undefined>)) {
      if (v?.title) return v.title;
      if (v?.label) return v.label;
    }
  }
  return toDisplayLabel(key);
}

export function Field({ field, value }: FieldProps) {
  const { control, input_data, aggregate } = field;
  const label = resolveFieldLabel(field.i18n, field.key);

  if (control === 'icon-map' && input_data) {
    return <IconMap value={value} inputData={input_data} />;
  }
  if (aggregate) {
    return <Chip label={label} value={value as string | number} />;
  }
  if (control === 'badge') {
    return <span className="badge">{formatVal(value, control)}</span>;
  }
  return <>{formatVal(value, control)}</>;
}

function formatVal(val: JSONValue, control?: string): string {
  if (val === null || val === undefined) return '—';
  if (control === 'date') {
    const d = new Date(val as string | number);
    if (!isNaN(d.getTime())) return d.toLocaleDateString();
  }
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}
