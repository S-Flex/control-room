import { useEffect } from 'react';
import { AppHeader } from './AppHeader';
import { PageHeader } from './PageHeader';

export function ProjectPage() {
  useEffect(() => {
    document.title = 'Project';
  }, []);

  return (
    <div className="planning-page">
      <div className="planning-main">
        <AppHeader />
        <PageHeader>
          <h2 className="page-title">Project</h2>
        </PageHeader>
        <div className="planning-content">
          <p className="page-placeholder">Project — coming soon.</p>
        </div>
      </div>
    </div>
  );
}
