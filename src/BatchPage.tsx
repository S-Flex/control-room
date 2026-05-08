import { useEffect } from 'react';
import { AppHeader } from './AppHeader';
import { PageHeader } from './PageHeader';
import { PageFooter } from './PageFooter';
import { PageSidebar } from './PageSidebar';
import { SectionRenderer } from './widgets/SectionRenderer';
import { usePage } from './hooks/usePages';
import { useLangSync } from './hooks/useLangSync';

export function BatchPage() {
  useLangSync();
  const { config: pageConfig, content: pageContent } = usePage('batch-nests');

  useEffect(() => {
    document.title = 'Batch';
  }, []);

  return (
    <div className="planning-page">
      <div className="planning-main">
        <AppHeader />
        <PageHeader />
        <div className="planning-content">
          {pageConfig?.main && (
            <SectionRenderer
              section={{
                class_name: pageConfig.main.class_name,
                grid: pageConfig.main.grid,
                sections: pageConfig.main.sections,
              }}
              content={pageContent ?? []}
            />
          )}
        </div>
        <PageFooter footerConfig={pageConfig?.footer} content={pageContent} />
      </div>
      <PageSidebar />
    </div>
  );
}
