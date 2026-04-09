import type { InputData, JSONValue } from '@s-flex/xfw-data';

type IconMapEntry = {
  class_name?: string;
  text?: string;
  title?: string;
  img_url?: string;
};

function resolve(value: JSONValue, inputData: InputData): IconMapEntry[] {
  if (!inputData.options) return [];
  const valueKey = inputData.value_key || 'id';
  const labelKey = inputData.label_key || 'content';
  const values = Array.isArray(value) ? value : [value];
  const results: IconMapEntry[] = [];
  for (const v of values) {
    const opt = inputData.options.find(o => o[valueKey] === v);
    if (!opt) continue;
    const content = opt[labelKey];
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      const c = content as Record<string, JSONValue>;
      results.push({
        class_name: c.class_name as string | undefined,
        text: c.text as string | undefined,
        title: c.title as string | undefined,
        img_url: c.img_url as string | undefined,
      });
    }
  }
  return results;
}

const svgIcons: Record<string, React.ReactNode> = {
  single: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="0.5" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  batch: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="4" y="1" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.1" opacity="0.4" />
      <rect x="2" y="4" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.1" opacity="0.65" />
      <rect x="0.5" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
};

export function IconMap({ value, inputData }: { value: JSONValue; inputData: InputData }) {
  const entries = resolve(value, inputData);
  if (entries.length === 0) return null;
  return (
    <span className="icon-map">
      {entries.map((e, i) => {
        if (e.img_url) return <img key={i} src={e.img_url} className="icon-map-img" alt={e.title ?? e.text ?? ''} />;
        if (e.class_name && svgIcons[e.class_name]) {
          return <span key={i} className="icon-map-icon" title={e.title ?? e.text}>{svgIcons[e.class_name]}</span>;
        }
        if (e.class_name) return <span key={i} className={`icon-map-icon ${e.class_name}`} title={e.title ?? e.text} />;
        return <span key={i}>{e.text ?? e.title ?? ''}</span>;
      })}
    </span>
  );
}
