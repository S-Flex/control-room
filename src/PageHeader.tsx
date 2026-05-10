import { useLocation } from 'react-router-dom';
import { useQueryParams } from '@s-flex/xfw-url';
import { getBlock } from 'xfw-get-block';
import { useAllLines } from './hooks/useAllLines';
import { useAppNav } from './hooks/useAppNav';
import { usePages } from './hooks/usePages';
import { SectionRenderer } from './widgets/SectionRenderer';
import type { ContentEntry } from './hooks/usePages';
import type { PageArea } from './types';

type PageHeaderProps = {
  children?: React.ReactNode;
  actions?: React.ReactNode;
  /** When set, the page-header layout is driven by a `header` block in
   *  pages.json (same shape as `main` / `footer`). Sections are placed
   *  by their `area`; the `breadcrumb` area receives the auto-built
   *  page/model crumb until the data-side defines a data_group for it. */
  headerConfig?: PageArea;
  content?: ContentEntry[];
};

function Breadcrumbs() {
  const location = useLocation();
  const allLines = useAllLines();
  const navItems = useAppNav();
  const { content } = usePages();
  const params = useQueryParams([{ key: 'model', is_query_param: true, is_optional: true }]);
  const modelCode = params.find(p => p.key === 'model')?.val as string | undefined;

  // Find the current path's content code via the View page-list, then
  // resolve its localized title from `pages-content.json`.
  const viewItem = navItems.find(i => i.type === 'page-list');
  const pageEntry = viewItem?.type === 'page-list'
    ? viewItem.pages.find(p => p.path === location.pathname)
    : undefined;
  const pageLabel = pageEntry ? getBlock(content, pageEntry.code, 'title') : null;
  if (!pageLabel || pageLabel === pageEntry?.code) return null;

  // Production-line crumb is shown on routes where the production-line
  // menu is visible. Same `visible_on` list drives both.
  const lineMenu = navItems.find(i => i.type === 'menu' && i.code === 'production-line');
  const showModel = lineMenu?.type === 'menu'
    && (lineMenu.visible_on?.includes(location.pathname) ?? true)
    && modelCode
    && allLines.length > 0;
  const modelLine = showModel ? allLines.find(l => l.code === modelCode) : null;
  const modelLabel = modelLine ? getBlock(allLines, modelLine.code, 'title') : null;

  return (
    <nav className="page-header-breadcrumbs" aria-label="Breadcrumb">
      <span className="page-header-breadcrumb-page">{pageLabel}</span>
      {modelLabel && (
        <>
          <span className="page-header-breadcrumb-sep" aria-hidden="true">/</span>
          <span className="page-header-breadcrumb-model">{modelLabel}</span>
        </>
      )}
    </nav>
  );
}

/** Second-row toolbar rendered directly under <AppHeader/>.
 *
 *  Two modes:
 *  - **Data-driven** — when `headerConfig` is supplied (a `header` block
 *    in pages.json) the layout / sections come from there. The
 *    `breadcrumb` slot is auto-injected with the built-in <Breadcrumbs>
 *    component until a data_group takes over.
 *  - **Static** — otherwise, `children` (left) + `actions` (right) plus
 *    the auto breadcrumb. Used by pages that don't yet declare a header
 *    block (Production Lines / Inflow / …).
 */
export function PageHeader({ children, actions, headerConfig, content }: PageHeaderProps) {
  if (headerConfig?.sections) {
    return (
      <div className="page-header">
        <SectionRenderer
          section={{
            class_name: headerConfig.class_name,
            grid: headerConfig.grid,
            sections: headerConfig.sections,
          }}
          content={content ?? []}
          slots={{ breadcrumb: <Breadcrumbs /> }}
        />
      </div>
    );
  }

  return (
    <div className="page-header">
      <div className="page-header-left">
        <Breadcrumbs />
        {children}
      </div>
      <div className="page-header-actions">{actions}</div>
    </div>
  );
}
