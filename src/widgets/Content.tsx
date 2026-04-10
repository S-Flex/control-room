import { useState } from 'react';
import type { JSONValue } from '@s-flex/xfw-data';

type ContentItem = {
  title?: string;
  text?: string;
  imgUrl?: string;
};

type ContentRow = {
  action_id?: number;
  content?: ContentItem[];
  start_at?: string;
  [key: string]: JSONValue | ContentItem[] | undefined;
};

function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  for (const el of Array.from(div.querySelectorAll('script'))) el.remove();
  for (const el of Array.from(div.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
    }
    if (el.hasAttribute('href') && el.getAttribute('href')?.trim().toLowerCase().startsWith('javascript:')) {
      el.removeAttribute('href');
    }
    if (el.hasAttribute('src') && el.getAttribute('src')?.trim().toLowerCase().startsWith('javascript:')) {
      el.removeAttribute('src');
    }
  }
  return div.innerHTML;
}

function ContentItem({ item }: { item: ContentItem }) {
  return (
    <div className="content-block">
      {item.title && (
        <div className="content-block-title" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.title) }} />
      )}
      {item.text && (
        <div className="content-block-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.text) }} />
      )}
      {item.imgUrl && (
        <img className="content-block-img" src={item.imgUrl} alt={item.title ?? ''} />
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

function ContentGroup({ group, defaultExpanded }: { group: { items: ContentItem[]; date?: string }; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const headerTitle = group.date
    ? formatDate(group.date)
    : group.items[0]?.title ?? '';

  return (
    <div className="content-group">
      <button className="content-group-header" onClick={() => setExpanded(e => !e)}>
        <svg className={`content-collapse-icon${expanded ? '' : ' collapsed'}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{headerTitle}</span>
      </button>
      {expanded && (
        <div className="content-group-body">
          {group.items.map((item, i) => (
            <ContentItem key={i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Normalize data: supports both flat ContentItem[] and row-based { content, start_at }[] */
function normalizeItems(data: JSONValue): { items: ContentItem[]; date?: string }[] {
  if (!data || !Array.isArray(data) || data.length === 0) return [];
  const first = data[0] as Record<string, unknown>;
  if ('content' in first && Array.isArray(first.content)) {
    return (data as ContentRow[]).map(row => ({
      items: row.content ?? [],
      date: row.start_at,
    }));
  }
  return [{ items: data as ContentItem[] }];
}

export function Content({ data }: { data: JSONValue }) {
  const groups = normalizeItems(data);
  if (groups.length === 0) return null;

  return (
    <div className="content-list">
      {groups.map((group, gi) => (
        <ContentGroup key={gi} group={group} defaultExpanded={gi === 0} />
      ))}
    </div>
  );
}
