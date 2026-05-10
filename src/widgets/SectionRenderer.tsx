import { getBlock } from 'xfw-get-block';
import { useNavigate } from '@s-flex/xfw-url';
import { DataGroupWidget } from './DataGroup';
import { Pager } from './Pager';
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
  // When `areas` is declared but `columns` isn't, derive equal-width
  // columns from the area template. Without this, the implicit columns
  // default to `auto` and collapse to content width — leaf widgets
  // placed in those cells (e.g. a flow-board with only a spinner during
  // load) shrink to ~20px and the spinner ends up hard against the left
  // edge instead of centred in the available space.
  else if (grid.areas && grid.areas.length > 0) {
    const colCount = Math.max(...grid.areas.map(row => row.trim().split(/\s+/).length));
    style.gridTemplateColumns = colCount === 1 ? '1fr' : `repeat(${colCount}, 1fr)`;
  }
  if (grid.rows) style.gridTemplateRows = grid.rows;
  if (grid.areas) style.gridTemplateAreas = grid.areas.map(a => `"${a}"`).join(' ');
  if (grid.gap) style.gap = grid.gap;
  if (grid.row_gap) style.rowGap = grid.row_gap;
  if (grid.column_gap) style.columnGap = grid.column_gap;
  if (grid.align_items) style.alignItems = grid.align_items;
  if (grid.justify_items) style.justifyItems = grid.justify_items;
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

export type SectionSlots = Record<string, React.ReactNode>;

export function SectionRenderer({ section, content, slots }: {
  section: Section;
  content: ContentEntry[];
  /** Inject a React node into a leaf section by `area` name — used for
   *  layouts where the area is declared in pages.json but its content is
   *  page-level chrome (e.g. the breadcrumb in a page header), pending a
   *  data_group implementation. */
  slots?: SectionSlots;
}) {
  const style: React.CSSProperties = {};
  if (section.area) style.gridArea = section.area;

  // Sections — laid out as grid when `grid` is present, otherwise stacked
  // vertically.
  if (section.sections) {
    const isGrid = !!section.grid;
    const wrapStyle = isGrid ? { ...buildGridStyle(section.grid!), ...style } : style;
    const baseClass = isGrid ? 'section-grid' : 'section-stack';
    return (
      <div className={`${baseClass} ${section.class_name ?? ''}`} style={wrapStyle}>
        {section.sections.map((child, i) => (
          <SectionRenderer key={i} section={child} content={content} slots={slots} />
        ))}
      </div>
    );
  }

  // Leaf: code + data_group + pager + nav (any combination). Use the
  // `section-leaf` class so the wrapper is a flex column that bounds its
  // children — without it, grid items default to `min-height: auto` and
  // the leaf grows to its content height, pushing tall widgets (e.g. a
  // long flow-board) past the page footer.
  const slotContent = section.area ? slots?.[section.area] : undefined;
  return (
    <div className={`section-leaf ${section.class_name ?? ''}`} style={style}>
      {section.code && <ContentBlock code={section.code} content={content} />}
      {section.data_group && <DataGroupWidget code={section.data_group} />}
      {slotContent}
      {section.pager && (
        <Pager dataGroupCode={section.pager.data_group} pageParam={section.pager.page_param} />
      )}
      {section.nav && <NavItems items={section.nav} />}
    </div>
  );
}
