import { useCallback, useEffect, useState } from 'react';
import { getBlock } from 'xfw-get-block';
import { PageHeader } from './PageHeader';
import { PageFooter } from './PageFooter';
import { PageSidebar } from './PageSidebar';
import type { LineConfig, MenuContentEntry, MenuItemDef, UiLabel } from './types';
import './app.css';

export function InflowPage() {
  const [, forceRender] = useState(0);
  const handleLanguageChange = useCallback(() => forceRender(n => n + 1), []);

  const [allLines, setAllLines] = useState<LineConfig[]>([]);
  const [uiLabels, setUiLabels] = useState<UiLabel[]>([]);
  const [menuContent, setMenuContent] = useState<Map<string, MenuContentEntry>>(new Map());
  const [activeLineId, setActiveLineId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('model') || 'sheet';
  });

  useEffect(() => {
    Promise.all([
      fetch('/data/models.json').then(r => r.json()),
      fetch('/data/ui-labels.json').then(r => r.json()),
      fetch('/data/menu-items.json').then(r => r.json()),
    ]).then(([modelsData, labelsData, menuItemsData]) => {
      setAllLines(modelsData);
      setUiLabels(labelsData);
      const mc = new Map<string, MenuContentEntry>();
      for (const item of menuItemsData as MenuItemDef[]) {
        if (item.block && !mc.has(item.code)) {
          mc.set(item.code, { code: item.code, block: item.block });
        }
      }
      setMenuContent(mc);
      const line = (modelsData as LineConfig[]).find(l => l.code === activeLineId);
      if (line) {
        document.title = `Inflow — ${getBlock(modelsData, line.code, 'title')}`;
      }
    });
  }, [activeLineId]);

  const switchLine = useCallback((id: string) => {
    if (id === activeLineId) return;
    setActiveLineId(id);
    const params = new URLSearchParams(window.location.search);
    params.set('model', id);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [activeLineId]);

  // Sync model to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('model', activeLineId);
    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
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
        />

        <div className="planning-content">
          <div className="planning-viewer">
          </div>
        </div>

        <PageFooter uiLabels={uiLabels} offTrackCount={0} />
      </div>

      <PageSidebar menuContent={menuContent} />
    </div>
  );
}
