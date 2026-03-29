import { useState } from 'react';
import type { JSONValue } from 'xfw-data';

type ContentItem = {
  title?: string;
  text?: string;
  imgUrl?: string;
};

function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  // Remove script tags and event handlers
  for (const el of Array.from(div.querySelectorAll('script'))) el.remove();
  for (const el of Array.from(div.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
    }
    // Remove javascript: URLs
    if (el.hasAttribute('href') && el.getAttribute('href')?.trim().toLowerCase().startsWith('javascript:')) {
      el.removeAttribute('href');
    }
    if (el.hasAttribute('src') && el.getAttribute('src')?.trim().toLowerCase().startsWith('javascript:')) {
      el.removeAttribute('src');
    }
  }
  return div.innerHTML;
}

function ContentBlock({ item, defaultExpanded }: { item: ContentItem; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="content-block">
      <button className="content-block-header" onClick={() => setExpanded(e => !e)}>
        <svg className={`content-collapse-icon${expanded ? '' : ' collapsed'}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {item.title && (
          <span className="content-block-title" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.title) }} />
        )}
      </button>
      {expanded && (
        <div className="content-block-body">
          {item.text && (
            <div className="content-block-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.text) }} />
          )}
          {item.imgUrl && (
            <img className="content-block-img" src={item.imgUrl} alt={item.title ?? ''} />
          )}
        </div>
      )}
    </div>
  );
}

export function Content({ data }: { data: JSONValue }) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const items = data as ContentItem[];

  return (
    <div className="content-list">
      {items.map((item, i) => (
        <ContentBlock key={i} item={item} defaultExpanded={i === 0} />
      ))}
    </div>
  );
}
