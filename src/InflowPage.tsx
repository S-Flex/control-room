import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { getBlock } from 'xfw-get-block';
import { PageHeader } from './PageHeader';
import { PageFooter } from './PageFooter';
import { PageSidebar } from './PageSidebar';
import { DropdownMenu } from './widgets/DropdownMenu';
import { MaterialCarousel } from './widgets/MaterialCarousel';
import { ProductionScheduleMenu, type Material, type ContentEntry } from './ProductionScheduleMenu';
import type { LineConfig, MenuContentEntry, MenuItemDef, UiLabel } from './types';
import './app.css';

const STORAGE_KEY = 'inflow-production-dates';

/** Build a flat ordered list of material codes matching menu order */
function buildOrderedCodes(materials: Material[], modelCode: string): string[] {
  const filtered = materials.filter(m => m.model.code === modelCode);
  const intervals = [...new Set(filtered.map(m => m.interval_workdays))].sort((a, b) => a - b);
  const codes: string[] = [];
  for (const interval of intervals) {
    const items = filtered
      .filter(m => m.interval_workdays === interval)
      .sort((a, b) => a.rush_time_hours - b.rush_time_hours);
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

  // Checked production dates (multi-select)
  const [checkedDates, setCheckedDates] = useState<Set<string>>(() => new Set(readUrlDates()));

  // Mode (manual / auto)
  const [mode, setMode] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') || 'manual';
  });
  const [modeOpen, setModeOpen] = useState(false);

  // Locations (multi-select)
  type LocationEntry = { code: string; enabled: boolean };
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
      setMenuContent(mc);
      setMaterials(materialsData.materials);
      setMaterialsContent(materialsData.content);
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
    () => buildOrderedCodes(materials, activeLineId),
    [materials, activeLineId],
  );

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
    const params = new URLSearchParams(window.location.search);
    params.set('model', id);
    params.delete('material');
    params.delete('production_dates');
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
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
    const params = new URLSearchParams(window.location.search);
    params.set('model', activeLineId);
    params.set('mode', mode);
    if (selectedMaterial) params.set('material', selectedMaterial);
    else params.delete('material');
    if (checkedDates.size > 0) {
      params.set('production_dates', JSON.stringify([...checkedDates]));
    } else {
      params.delete('production_dates');
    }
    if (selectedLocations.size > 0) {
      params.set('location', JSON.stringify([...selectedLocations]));
    } else {
      params.delete('location');
    }
    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, [activeLineId, selectedMaterial, checkedDates, mode, selectedLocations]);

  const handleSetMode = useCallback((m: string) => {
    setMode(m);
    setModeOpen(false);
  }, []);

  const toggleLocation = useCallback((code: string) => {
    setSelectedLocations(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  // Toggle a date checkbox
  const toggleDate = useCallback((date: string) => {
    setCheckedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);

      // Persist to localStorage
      if (selectedMaterial) {
        const stored = readStorage();
        stored[selectedMaterial] = [...next];
        writeStorage(stored);
      }

      return next;
    });
  }, [selectedMaterial]);

  const scheduleLabel = getBlock(uiLabels, 'production_schedule', 'title');
  const materialLabel = selectedMaterial
    ? getBlock(materialsContent, selectedMaterial, 'title')
    : scheduleLabel;

  // Production dates for the selected material
  const productionDates = useMemo(() => {
    if (!selectedMaterial) return [];
    const mat = materials.find(m => m.code === selectedMaterial);
    return mat?.production_dates ?? [];
  }, [materials, selectedMaterial]);

  const formatDate = useCallback((iso: string) => {
    return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  }, []);

  const singlePieceLabel = getBlock(uiLabels, 'single_piece', 'title');
  const multiPieceLabel = getBlock(uiLabels, 'multi_piece', 'title');

  const getMaterialLabel = useCallback(
    (code: string) => getBlock(materialsContent, code, 'title'),
    [materialsContent],
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
            <DropdownMenu
              label={getBlock(uiLabels, mode, 'title')}
              open={modeOpen}
              onToggle={() => setModeOpen(o => !o)}
              onClose={() => setModeOpen(false)}
              fullWidth={false}
            >
              <div className="dropdown-menu-list">
                {['manual', 'auto'].map(m => (
                  <button
                    key={m}
                    className={`dropdown-menu-item${m === mode ? ' active' : ''}`}
                    onClick={() => handleSetMode(m)}
                  >
                    {getBlock(uiLabels, m, 'title')}
                  </button>
                ))}
              </div>
            </DropdownMenu>
            <DropdownMenu
              label={getBlock(uiLabels, 'locations', 'title')}
              open={locationsOpen}
              onToggle={() => setLocationsOpen(o => !o)}
              onClose={() => setLocationsOpen(false)}
              fullWidth={false}
            >
              <div className="dropdown-menu-list">
                {locations.map(loc => (
                  <label
                    key={loc.code}
                    className={`dropdown-menu-item dropdown-menu-check${!loc.enabled ? ' disabled' : ''}${selectedLocations.has(loc.code) ? ' active' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="dropdown-menu-checkbox"
                      checked={selectedLocations.has(loc.code)}
                      disabled={!loc.enabled}
                      onChange={() => toggleLocation(loc.code)}
                    />
                    {getBlock(locationsContent, loc.code, 'title')}
                  </label>
                ))}
              </div>
            </DropdownMenu>
          </>}
        >
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
            <div className="inflow-col-header">{getBlock(uiLabels, 'schedule', 'title')}</div>
            <MaterialCarousel
              items={orderedCodes}
              currentIndex={currentIndex >= 0 ? currentIndex : 0}
              getLabel={getMaterialLabel}
              onSelect={handleSelectMaterial}
            />
            <div className="inflow-schedule-dates">
              {productionDates.map((date, i) => (
                i === 0 ? (
                  <label key={date} className={`inflow-date-item${checkedDates.has(date) ? ' checked' : ''}`}>
                    <input
                      type="checkbox"
                      className="inflow-date-checkbox"
                      checked={checkedDates.has(date)}
                      onChange={() => toggleDate(date)}
                    />
                    <span className="inflow-date-label">{formatDate(date)}</span>
                  </label>
                ) : (
                  <Fragment key={date}>
                    <label className={`inflow-date-item${checkedDates.has(date + ':sp') ? ' checked' : ''}`}>
                      <input
                        type="checkbox"
                        className="inflow-date-checkbox"
                        checked={checkedDates.has(date + ':sp')}
                        onChange={() => toggleDate(date + ':sp')}
                      />
                      <span className="inflow-date-label">{formatDate(date)}</span>
                      <span className="inflow-date-type" title={singlePieceLabel}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                        </svg>
                      </span>
                    </label>
                    <label className={`inflow-date-item${checkedDates.has(date + ':mp') ? ' checked' : ''}`}>
                      <input
                        type="checkbox"
                        className="inflow-date-checkbox"
                        checked={checkedDates.has(date + ':mp')}
                        onChange={() => toggleDate(date + ':mp')}
                      />
                      <span className="inflow-date-label">{formatDate(date)}</span>
                      <span className="inflow-date-type" title={multiPieceLabel}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                          <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                          <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                          <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                        </svg>
                      </span>
                    </label>
                  </Fragment>
                )
              ))}
            </div>
            <div className="inflow-material-body">
            </div>
          </div>
        </div>

        <PageFooter uiLabels={uiLabels} offTrackCount={0} />
      </div>

      <PageSidebar menuContent={menuContent} />
    </div>
  );
}
