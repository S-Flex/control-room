import { useEffect } from 'react';
import { AppHeader } from './AppHeader';
import { PageHeader } from './PageHeader';

export function BatchPage() {
  useEffect(() => {
    document.title = 'Batch';
  }, []);

  return (
    <div className="planning-page">
      <div className="planning-main">
        <AppHeader />
        <PageHeader>
          <h2 className="page-title">Batch</h2>
        </PageHeader>
        <div className="planning-content">
          <p className="page-placeholder">Batch — coming soon.</p>
        </div>
      </div>
    </div>
  );
}
