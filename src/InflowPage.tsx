import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@s-flex/xfw-url';
import { getBlock } from 'xfw-get-block';
import { PageHeader } from './PageHeader';
import { PageFooter } from './PageFooter';
import { PageSidebar } from './PageSidebar';
import { syncQueryParams } from './lib/urlSync';
import { Checkbox } from '@s-flex/xfw-ui';
import { DropdownMenu } from './widgets/DropdownMenu';
import { Carousel } from './widgets/Carousel';
import { TimeSlider } from './widgets/TimeSlider';
import { DataGroupWidget } from './widgets/DataGroup';
import { usePage } from './hooks/usePages';
import { ProductionScheduleMenu, type Material, type ContentEntry, type CutoffTime, type Printer, type PrintMode } from './ProductionScheduleMenu';
import type { LineConfig, MenuContentEntry, MenuItemDef, UiLabel } from './types';

const STORAGE_KEY = 'inflow-production-dates';

/** Build a flat ordered list of material codes matching menu order */
function buildOrderedCodes(materials: Material[], modelCode: string, cutoffTimes: CutoffTime[]): string[] {
  function getCutoff(m: Material): string {
    const match = cutoffTimes.find(c => c.rush_time === m.rush_time_hours);
    if (match) return match.cutoff_time;
    const sorted = [...cutoffTimes].sort((a, b) => a.rush_time - b.rush_time);
    const fallback = sorted.find(c => c.rush_time >= m.rush_time_hours);
    return fallback?.cutoff_time ?? sorted[sorted.length - 1]?.cutoff_time ?? '';
  }

  const filtered = materials.filter(m => m.model.code === modelCode);
  const intervals = [...new Set(filtered.map(m => m.interval_workdays))].sort((a, b) => a - b);
  const codes: string[] = [];
  for (const interval of intervals) {
    const items = filtered
      .filter(m => m.interval_workdays === interval)
      .sort((a, b) => {
        const cutA = getCutoff(a);
        const cutB = getCutoff(b);
        if (cutA !== cutB) return cutA.localeCompare(cutB);
        return a.code.localeCompare(b.code);
      });
    const categoryMap = new Map<string, Material[]>();
    for (const item of items) {
      const cat = item.category.code;
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(item);
    }
    for (const group of categoryMap.values()) {
      for (const m of group) codes.push(m.code);
    }
  }
  return codes;
}

/** Read stored dates map, clear if saved before today */
function readStorage(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    if (parsed._savedDate !== today) {
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }
    const { _savedDate, ...rest } = parsed;
    return rest as Record<string, string[]>;
  } catch {
    return {};
  }
}

function writeStorage(data: Record<string, string[]>) {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ _savedDate: today, ...data }));
}

/** Read production_dates from URL query param */
function readUrlDates(): string[] {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('production_dates');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function InflowPage() {
  const navigate = useNavigate();
  const [, forceRender] = useState(0);
  const handleLanguageChange = useCallback(() => forceRender(n => n + 1), []);
  const isAuto = window.location.pathname === '/inflow-auto';
  const { config: pageConfig, content: pageContent } = usePage(isAuto ? 'inflow-auto' : 'inflow-manual');
  const flowBoardDataGroup = pageConfig?.main?.cols?.[0]?.data_group;

  const [allLines, setAllLines] = useState<LineConfig[]>([]);
  const [uiLabels, setUiLabels] = useState<UiLabel[]>([]);
  const [menuContent, setMenuContent] = useState<Map<string, MenuContentEntry>>(new Map());
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsContent, setMaterialsContent] = useState<ContentEntry[]>([]);
  const [cutoffTimes, setCutoffTimes] = useState<CutoffTime[]>([]);
  const [rootProductionDates, setRootProductionDates] = useState<{ interval_workdays: number; dates: string[]; }[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [printModes, setPrintModes] = useState<PrintMode[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [initialMaterialId] = useState<number | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('material_id');
    return raw ? Number(raw) : null;
  });
  const [activeLineId, setActiveLineId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('model') || 'sheet';
  });

  // Checked production dates (multi-select)
  const [checkedDates, setCheckedDates] = useState<Set<string>>(() => new Set(readUrlDates()));

  // from query param
  const handleTimeChange = useCallback((currentTime: string) => {
    syncQueryParams({ from: currentTime });
  }, []);

  const otherMode = isAuto ? 'manual' : 'auto';
  const otherModeUrl = isAuto ? '/inflow-manual' : '/inflow-auto';

  // Locations (multi-select)
  type LocationEntry = { code: string; enabled: boolean; };
  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [locationsContent, setLocationsContent] = useState<ContentEntry[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('location');
    if (!raw) return new Set<string>();
    try {
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set<string>();
    }
  });
  const [locationsOpen, setLocationsOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/data/models.json').then(r => r.json()),
      fetch('/data/ui-labels.json').then(r => r.json()),
      fetch('/data/menu-items.json').then(r => r.json()),
      fetch('/data/materials.json').then(r => r.json()),
      fetch('/data/locations.json').then(r => r.json()),
    ]).then(([modelsData, labelsData, menuItemsData, materialsData, locationsData]) => {
      setAllLines(modelsData);
      setUiLabels(labelsData);
      const mc = new Map<string, MenuContentEntry>();
      for (const item of menuItemsData as MenuItemDef[]) {
        if (item.block && !mc.has(item.code)) {
          mc.set(item.code, { code: item.code, block: item.block });
        }
      }
      // Add nester sidebar title
      mc.set('nester', { code: 'nester', block: { title: 'Nester', i18n: { en: { title: 'Nester' }, nl: { title: 'Nester' }, de: { title: 'Nester' } } } });
      setMenuContent(mc);
      setMaterials(materialsData.materials);
      setMaterialsContent(materialsData.content);
      setCutoffTimes(materialsData.cutoff_times ?? []);
      setRootProductionDates(materialsData.production_dates ?? []);
      setPrinters(materialsData.printers ?? []);
      setPrintModes(materialsData.print_modes ?? []);
      setLocations(locationsData.locations);
      setLocationsContent(locationsData.content);
      // Auto-select enabled locations if none selected
      if (selectedLocations.size === 0) {
        const enabled = (locationsData.locations as LocationEntry[])
          .filter(l => l.enabled)
          .map(l => l.code);
        setSelectedLocations(new Set(enabled));
      }
      const line = (modelsData as LineConfig[]).find(l => l.code === activeLineId);
      if (line) {
        document.title = `Inflow — ${getBlock(modelsData, line.code, 'title')}`;
      }
    });
  }, [activeLineId]);

  // Ordered material codes for the current model
  const orderedCodes = useMemo(
    () => buildOrderedCodes(materials, activeLineId, cutoffTimes),
    [materials, activeLineId, cutoffTimes],
  );

  // Resolve initial material_id from URL to code once materials load
  const resolvedInitial = useRef(false);
  useEffect(() => {
    if (resolvedInitial.current || materials.length === 0) return;
    resolvedInitial.current = true;
    if (initialMaterialId != null) {
      const mat = materials.find(m => m.material_id === initialMaterialId);
      if (mat) {
        setSelectedMaterial(mat.code);
        const stored = readStorage();
        const dates = stored[mat.code];
        if (dates && dates.length > 0) setCheckedDates(new Set(dates));
      }
    }
  }, [materials, initialMaterialId]);

  // Auto-select first material when none selected or current not in list
  useEffect(() => {
    if (orderedCodes.length === 0) return;
    if (!selectedMaterial || !orderedCodes.includes(selectedMaterial)) {
      const first = orderedCodes[0];
      setSelectedMaterial(first);
      // Restore dates from localStorage for this material
      const stored = readStorage();
      const dates = stored[first];
      if (dates && dates.length > 0) {
        setCheckedDates(new Set(dates));
      } else {
        setCheckedDates(new Set());
      }
    }
  }, [orderedCodes, selectedMaterial]);

  const currentIndex = selectedMaterial ? orderedCodes.indexOf(selectedMaterial) : 0;

  const switchLine = useCallback((id: string) => {
    if (id === activeLineId) return;
    setActiveLineId(id);
    setSelectedMaterial(null);
    setCheckedDates(new Set());
    syncQueryParams({ model: id, material_id: null, production_dates: null });
  }, [activeLineId]);

  const handleSelectMaterial = useCallback((code: string) => {
    // Save current checked dates for current material before switching
    if (selectedMaterial && checkedDates.size > 0) {
      const stored = readStorage();
      stored[selectedMaterial] = [...checkedDates];
      writeStorage(stored);
    }

    setSelectedMaterial(code);
    setScheduleOpen(false);

    // Restore dates from localStorage for the new material
    const stored = readStorage();
    const dates = stored[code];
    const newDates = dates && dates.length > 0 ? new Set(dates) : new Set<string>();
    setCheckedDates(newDates);
  }, [selectedMaterial, checkedDates]);

  // Sync URL whenever state changes
  useEffect(() => {
    const selectedMatObj = selectedMaterial ? materials.find(m => m.code === selectedMaterial) : undefined;
    syncQueryParams({
      model: activeLineId,
      material_id: selectedMatObj ? String(selectedMatObj.material_id) : null,
      production_dates: checkedDates.size > 0 ? JSON.stringify([...checkedDates]) : null,
      location: selectedLocations.size > 0 ? JSON.stringify([...selectedLocations]) : null,
    });
  }, [activeLineId, selectedMaterial, checkedDates, selectedLocations, materials]);


  const toggleLocation = useCallback((code: string) => {
    setSelectedLocations(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const scheduleLabel = getBlock(uiLabels, 'production_schedule', 'title');
  const materialLabel = selectedMaterial
    ? getBlock(materialsContent, selectedMaterial, 'title')
    : scheduleLabel;

  const getMaterialLabel = useCallback(
    (code: string) => getBlock(materialsContent, code, 'title'),
    [materialsContent],
  );

  const getMaterialSpecs = useCallback(
    (code: string) => {
      const mat = materials.find(m => m.code === code);
      return mat?.specs ?? [];
    },
    [materials],
  );

  const getMaterialInfo = useCallback(
    (code: string) => {
      const mat = materials.find(m => m.code === code);
      if (!mat) return null;
      const match = cutoffTimes.find(c => c.rush_time === mat.rush_time_hours);
      return { cutoff: match?.cutoff_time, rushHours: mat.rush_time_hours };
    },
    [materials, cutoffTimes],
  );

  return (
    <div className="planning-page">
      <div className="planning-main">
        <PageHeader
          allLines={allLines}
          activeLineId={activeLineId}
          switchLine={switchLine}
          uiLabels={uiLabels}
          onLanguageChange={handleLanguageChange}
          actions={<>
            <a href={otherModeUrl} className="planning-mode-link">
              {getBlock(uiLabels, otherMode, 'title')}
            </a>
            <DropdownMenu
              label={getBlock(uiLabels, 'locations', 'title')}
              open={locationsOpen}
              onToggle={() => setLocationsOpen(o => !o)}
              onClose={() => setLocationsOpen(false)}
              fullWidth={false}
            >
              <div className="dropdown-menu-list">
                {locations.map(loc => (
                  <div key={loc.code} className={`dropdown-menu-item dropdown-menu-check${!loc.enabled ? ' disabled' : ''}${selectedLocations.has(loc.code) ? ' active' : ''}`}>
                    <Checkbox
                      isSelected={selectedLocations.has(loc.code)}
                      isDisabled={!loc.enabled}
                      onChange={() => toggleLocation(loc.code)}
                      label={getBlock(locationsContent, loc.code, 'title')}
                    />
                  </div>
                ))}
              </div>
            </DropdownMenu>
            <button
              className="planning-icon-btn"
              title={getBlock(uiLabels, 'nester', 'title')}
              onClick={() => navigate('(sidebar:nester)')}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="3" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                <rect x="11" y="3" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                <rect x="2" y="12" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                <rect x="11" y="12" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                <path d="M6 8v4M14 8v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </>}
        >
          <TimeSlider uiLabels={uiLabels} onChange={handleTimeChange} />
          <DropdownMenu
            label={materialLabel}
            open={scheduleOpen}
            onToggle={() => setScheduleOpen(o => !o)}
            onClose={() => setScheduleOpen(false)}
            fullWidth={false}
          >
            {materials.length > 0 && (
              <ProductionScheduleMenu
                materials={materials}
                content={materialsContent}
                cutoffTimes={cutoffTimes}
                modelCode={activeLineId}
                uiLabels={uiLabels}
                selectedMaterial={selectedMaterial}
                onSelect={handleSelectMaterial}
              />
            )}
          </DropdownMenu>
        </PageHeader>

        <div className="planning-content">
          <div className="inflow-content">
            <Carousel
              items={orderedCodes}
              currentIndex={currentIndex >= 0 ? currentIndex : 0}
              getLabel={getMaterialLabel}
              getInfo={getMaterialInfo}
              getSpecs={getMaterialSpecs}
              onSelect={handleSelectMaterial}
            >
              {flowBoardDataGroup && <DataGroupWidget code={flowBoardDataGroup} />}
            </Carousel>
          </div>
        </div>

        <PageFooter footerConfig={pageConfig?.footer} content={pageContent} />
      </div>

      <PageSidebar />
    </div>
  );
}
