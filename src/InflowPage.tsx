import { useCallback, useEffect, useState } from 'react';
import { getBlock } from 'xfw-get-block';
import { PageHeader } from './PageHeader';
import { PageFooter } from './PageFooter';
import { PageSidebar } from './PageSidebar';
import { DropdownMenu } from './widgets/DropdownMenu';
import { ProductionScheduleMenu, type Material, type ContentEntry } from './ProductionScheduleMenu';
import type { LineConfig, MenuContentEntry, MenuItemDef, UiLabel } from './types';
import './app.css';

export function InflowPage() {
  const [, forceRender] = useState(0);
  const handleLanguageChange = useCallback(() => forceRender(n => n + 1), []);

  const [allLines, setAllLines] = useState<LineConfig[]>([]);
  const [uiLabels, setUiLabels] = useState<UiLabel[]>([]);
  const [menuContent, setMenuContent] = useState<Map<string, MenuContentEntry>>(new Map());
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsContent, setMaterialsContent] = useState<ContentEntry[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('material');
  });
  const [activeLineId, setActiveLineId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('model') || 'sheet';
  });

  useEffect(() => {
    Promise.all([
      fetch('/data/models.json').then(r => r.json()),
      fetch('/data/ui-labels.json').then(r => r.json()),
      fetch('/data/menu-items.json').then(r => r.json()),
      fetch('/data/materials.json').then(r => r.json()),
    ]).then(([modelsData, labelsData, menuItemsData, materialsData]) => {
      setAllLines(modelsData);
      setUiLabels(labelsData);
      const mc = new Map<string, MenuContentEntry>();
      for (const item of menuItemsData as MenuItemDef[]) {
        if (item.block && !mc.has(item.code)) {
          mc.set(item.code, { code: item.code, block: item.block });
        }
      }
      setMenuContent(mc);
      setMaterials(materialsData.materials);
      setMaterialsContent(materialsData.content);
      const line = (modelsData as LineConfig[]).find(l => l.code === activeLineId);
      if (line) {
        document.title = `Inflow — ${getBlock(modelsData, line.code, 'title')}`;
      }
    });
  }, [activeLineId]);

  const switchLine = useCallback((id: string) => {
    if (id === activeLineId) return;
    setActiveLineId(id);
    setSelectedMaterial(null);
    const params = new URLSearchParams(window.location.search);
    params.set('model', id);
    params.delete('material');
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [activeLineId]);

  const handleSelectMaterial = useCallback((code: string) => {
    setSelectedMaterial(code);
    setScheduleOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.set('material', code);
    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, []);

  // Sync model to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('model', activeLineId);
    if (selectedMaterial) params.set('material', selectedMaterial);
    else params.delete('material');
    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, [activeLineId, selectedMaterial]);

  const scheduleLabel = getBlock(uiLabels, 'production_schedule', 'title');
  const materialLabel = selectedMaterial
    ? getBlock(materialsContent, selectedMaterial, 'title')
    : scheduleLabel;

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
          <DropdownMenu
            label={materialLabel}
            open={scheduleOpen}
            onToggle={() => setScheduleOpen(o => !o)}
            onClose={() => setScheduleOpen(false)}
          >
            {materials.length > 0 && (
              <ProductionScheduleMenu
                materials={materials}
                content={materialsContent}
                modelCode={activeLineId}
                uiLabels={uiLabels}
                selectedMaterial={selectedMaterial}
                onSelect={handleSelectMaterial}
              />
            )}
          </DropdownMenu>
        </PageHeader>

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
