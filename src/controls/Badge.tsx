import type { InputData, JSONValue } from '@s-flex/xfw-data';

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

export function Badge({ value, inputData }: { value: JSONValue; inputData?: InputData }) {
  const { text, class_name } = resolveBadge(value, inputData);
  return (
    <span className={class_name ? `badge ${class_name}` : 'badge'} title={text}>
      {text}
    </span>
  );
}
