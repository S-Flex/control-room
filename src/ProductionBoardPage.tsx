import { useEffect, useState } from 'react';
import { getBlock } from 'xfw-get-block';
import { useQueryParams } from '@s-flex/xfw-url';
import { AppHeader } from './AppHeader';
import { PageHeader } from './PageHeader';
import { PageFooter } from './PageFooter';
import { PageSidebar } from './PageSidebar';
import { DataGroupWidget } from './widgets/DataGroup';
import { TimelineControls } from './controls/TimelineControls';
import { usePage } from './hooks/usePages';
import { useAllLines } from './hooks/useAllLines';
import { useLangSync } from './hooks/useLangSync';
import type { UiLabel } from './types';

export function ProductionBoardPage() {
  const { config: pageConfig, content: pageContent } = usePage('production-board');
  const flowBoardDataGroup = pageConfig?.main?.cols?.[0]?.data_group;

  useLangSync();
  const allLines = useAllLines();
  const [uiLabels, setUiLabels] = useState<UiLabel[]>([]);

  const urlParams = useQueryParams([{ key: 'model', is_query_param: true }]);
  const urlModel = urlParams.find(p => p.key === 'model')?.val as string | undefined;
  const activeLineId = urlModel ?? 'sheet';

  useEffect(() => {
    fetch('/data/ui-labels.json').then(r => r.json()).then(setUiLabels);
  }, []);

  useEffect(() => {
    if (allLines.length === 0) return;
    const line = allLines.find(l => l.code === activeLineId);
    if (line) {
      document.title = `Production Board — ${getBlock(allLines, line.code, 'title')}`;
    }
  }, [allLines, activeLineId]);

  return (
    <div className="planning-page">
      <div className="planning-main">
        <AppHeader />
        <PageHeader>
          <TimelineControls uiLabels={uiLabels} />
        </PageHeader>

        <div className="planning-content">
          {flowBoardDataGroup && <DataGroupWidget code={flowBoardDataGroup} />}
        </div>

        <PageFooter footerConfig={pageConfig?.footer} content={pageContent} />
      </div>

      <PageSidebar />
    </div>
  );
}
