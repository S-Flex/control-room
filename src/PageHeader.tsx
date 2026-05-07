import { useLocation } from 'react-router-dom';
import { useQueryParams } from '@s-flex/xfw-url';
import { getBlock } from 'xfw-get-block';
import { useAllLines } from './hooks/useAllLines';
import { VIEW_PAGES, PAGES_WITH_MODEL } from './lib/pages';

type PageHeaderProps = {
  children?: React.ReactNode;
  actions?: React.ReactNode;
};

function Breadcrumbs() {
  const location = useLocation();
  const allLines = useAllLines();
  const params = useQueryParams([{ key: 'model', is_query_param: true, is_optional: true }]);
  const modelCode = params.find(p => p.key === 'model')?.val as string | undefined;

  const pageLabel = VIEW_PAGES.find(p => location.pathname === p.path)?.label;
  if (!pageLabel) return null;

  const showModel = PAGES_WITH_MODEL.has(location.pathname) && modelCode && allLines.length > 0;
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

/** Second-row toolbar rendered directly under <AppHeader/>. Always shows
 *  the page / model breadcrumb on the left; pages can pass extra
 *  `children` (controls) and `actions` (right-side buttons). */
export function PageHeader({ children, actions }: PageHeaderProps) {
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
