import { getBlock } from 'xfw-get-block';
import { useNavigate } from '@s-flex/xfw-url';
import { DataGroupWidget } from './DataGroup';
import type { Section, GridConfig } from '../types';

type ContentEntry = {
  code: string;
  block: Record<string, unknown>;
};

function buildGridStyle(grid: string | GridConfig): React.CSSProperties {
  if (typeof grid === 'string') {
    return { display: 'grid', gridTemplateColumns: grid };
  }
  const style: React.CSSProperties = { display: 'grid' };
  if (grid.columns) style.gridTemplateColumns = grid.columns;
  if (grid.rows) style.gridTemplateRows = grid.rows;
  if (grid.areas) style.gridTemplateAreas = grid.areas.map(a => `"${a}"`).join(' ');
  if (grid.gap) style.gap = grid.gap;
  if (grid.row_gap) style.rowGap = grid.row_gap;
  if (grid.column_gap) style.columnGap = grid.column_gap;
  return style;
}

function ContentBlock({ code, content }: { code: string; content: ContentEntry[] }) {
  const title = getBlock(content, code, 'title');
  const text = getBlock(content, code, 'text');
  const block = content.find(c => c.code === code)?.block;
  const type = block?.type as string | undefined;
  const titleClass = block?.title_class as string | undefined;
  const textClass = block?.text_class as string | undefined;

  if (type === 'image') {
    const imageUrl = block?.image_url as string;
    const aspectRatio = block?.aspect_ratio as string | undefined;
    const objectFit = block?.object_fit as string | undefined;
    return (
      <div className="section-image">
        <img
          src={imageUrl}
          alt={title !== code ? title : ''}
          style={{ aspectRatio, objectFit: objectFit as React.CSSProperties['objectFit'] }}
        />
      </div>
    );
  }

  const hasTitle = title && title !== code;
  const hasText = text && text !== code;
  if (!hasTitle && !hasText) return null;

  return (
    <div className="section-content">
      {hasTitle && <h3 className={titleClass}>{title}</h3>}
      {hasText && <p className={textClass}>{text}</p>}
    </div>
  );
}

function NavItems({ items }: { items: NavItem[] }) {
  const navigate = useNavigate();

  return (
    <div className="section-nav">
      {items.map((item, i) => (
        <button
          key={i}
          className="section-nav-item"
          onClick={() => navigate(item.path)}
        >
          {item.text}
        </button>
      ))}
    </div>
  );
}

// Re-import NavItem from types to avoid circular — it's already in scope via Section
type NavItem = NonNullable<Section['nav']>[number];

export function SectionRenderer({ section, content }: { section: Section; content: ContentEntry[] }) {
  const style: React.CSSProperties = {};
  if (section.area) style.gridArea = section.area;

  // Grid + cols
  if (section.grid && section.cols) {
    const gridStyle = { ...buildGridStyle(section.grid), ...style };
    return (
      <div className={`section-grid ${section.class_name ?? ''}`} style={gridStyle}>
        {section.cols.map((col, i) => (
          <SectionRenderer key={i} section={col} content={content} />
        ))}
      </div>
    );
  }

  // Vertical sections
  if (section.sections) {
    return (
      <div className={`section-stack ${section.class_name ?? ''}`} style={style}>
        {section.sections.map((child, i) => (
          <SectionRenderer key={i} section={child} content={content} />
        ))}
      </div>
    );
  }

  // Leaf: code + data_group + nav (any combination)
  return (
    <div className={section.class_name ?? ''} style={style}>
      {section.code && <ContentBlock code={section.code} content={content} />}
      {section.data_group && <DataGroupWidget code={section.data_group} />}
      {section.nav && <NavItems items={section.nav} />}
    </div>
  );
}
