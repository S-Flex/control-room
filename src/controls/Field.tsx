import type { InputData, JSONValue } from '@s-flex/xfw-data';
import { IconMap } from './IconMap';
import { Chip } from './Chip';

export function Field({ value, label, control, aggregate, inputData }: {
  value: JSONValue;
  label: string;
  control?: string;
  aggregate?: string;
  inputData?: InputData;
}) {
  if (control === 'icon-map' && inputData) {
    return <IconMap value={value} inputData={inputData} />;
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
