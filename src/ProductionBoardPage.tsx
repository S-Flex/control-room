import { useCallback, useEffect, useState } from 'react';
import { getBlock, getLanguage, setLanguage } from 'xfw-get-block';
import { useQueryParams } from '@s-flex/xfw-url';
import { PageHeader } from './PageHeader';
import { PageFooter } from './PageFooter';
import { PageSidebar } from './PageSidebar';
import { syncQueryParams } from './lib/urlSync';
import { DataGroupWidget } from './widgets/DataGroup';
import { TimelineControls } from './controls/TimelineControls';
import { usePage } from './hooks/usePages';
import type { LineConfig, UiLabel } from './types';

export function ProductionBoardPage() {
  const { config: pageConfig, content: pageContent } = usePage('production-board');
  const flowBoardDataGroup = pageConfig?.main?.cols?.[0]?.data_group;

  const [allLines, setAllLines] = useState<LineConfig[]>([]);
  const [uiLabels, setUiLabels] = useState<UiLabel[]>([]);

  const urlParams = useQueryParams([
    { key: 'model', is_query_param: true },
    { key: 'lang', is_query_param: true },
  ]);
  const urlModel = urlParams.find(p => p.key === 'model')?.val as string | undefined;
  const urlLang = urlParams.find(p => p.key === 'lang')?.val as string | undefined;

  const [activeLineId, setActiveLineId] = useState<string>(() => urlModel ?? 'sheet');
  const [lang, setLang] = useState(() => getLanguage());

  const handleLanguageChange = useCallback((newLang?: string) => {
    setLang(newLang ?? getLanguage());
  }, []);

  const switchLine = useCallback((id: string) => {
    if (id === activeLineId) return;
    setActiveLineId(id);
  }, [activeLineId]);

  // React to ?model=… changes (browser back/forward, external writes).
  useEffect(() => {
    if (urlModel && urlModel !== activeLineId) setActiveLineId(urlModel);
  }, [urlModel]);

  // Apply ?lang=… on mount and on external changes.
  useEffect(() => {
    if (urlLang && urlLang !== getLanguage()) {
      setLanguage(urlLang);
      setLang(urlLang);
    }
  }, [urlLang]);

  // Mirror current model + lang into the URL.
  useEffect(() => {
    syncQueryParams({ model: activeLineId, lang });
  }, [activeLineId, lang]);

  useEffect(() => {
    Promise.all([
      fetch('/data/models.json').then(r => r.json()),
      fetch('/data/ui-labels.json').then(r => r.json()),
    ]).then(([modelsData, labelsData]) => {
      setAllLines(modelsData);
      setUiLabels(labelsData);
      const line = (modelsData as LineConfig[]).find(l => l.code === activeLineId);
      if (line) {
        document.title = `Production Board — ${getBlock(modelsData, line.code, 'title')}`;
      }
    });
  }, [activeLineId]);

  return (
    <div className="planning-page">
      <div className="planning-main">
        <PageHeader
          allLines={allLines}
          activeLineId={activeLineId}
          switchLine={switchLine}
          uiLabels={uiLabels}
          onLanguageChange={handleLanguageChange}
        >
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
