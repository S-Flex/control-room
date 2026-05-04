import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThreeModelView, type CameraState, type JSONRecord } from 'xfw-three';
import {
  useNavigate,
  useQueryParams,
  useAuxOutlet,
  AuxRouteProvider,
} from '@s-flex/xfw-url';
import { Toggle } from './controls/Toggle';
import { TimelineControls, parseUntil } from './controls/TimelineControls';
import { getBlock, setLanguage, getLanguage, languages } from 'xfw-get-block';
import type { Resource } from './viewer/types';
import { useProductionLineOverview } from './hooks/useProductionLineOverview';
import { CapacityTooltip } from './widgets/CapacityTooltip';
import type { TooltipConfig, TooltipFieldConfigEntry } from './controls/FieldTooltip';
import { syncQueryParams, rewriteUrl } from './lib/urlSync';
import { PageHeader } from './PageHeader';
import { PageFooter } from './PageFooter';
import { PageSidebar } from './PageSidebar';
import { usePage } from './hooks/usePages';
import type { LineConfig, MenuContentEntry, MenuItemDef, UiLabel } from './types';

type ModelsData = LineConfig[];

type ResourceStateEntry = {
  code: string;
  color: string;
  block: {
    title: string;
    i18n?: Record<string, { title: string; }>;
  };
};
type StateSet = {
  code: string;
  color: string;
  block: { title: string; i18n?: Record<string, { title: string; }>; };
  states: ResourceStateEntry[];
};

function resolveTemplate(formula: string, params: Record<string, string>): string {
  return formula.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? '');
}

function resolveMenuLabel(entry: MenuContentEntry | undefined, params: Record<string, string>): string {
  if (!entry) return '';
  const lang = getLanguage();
  const langBlock = entry.block.i18n?.[lang];
  const template = (langBlock as Record<string, unknown>)?.template as { title?: string; } | undefined;
  if (template?.title) return resolveTemplate(template.title, params);
  if (entry.block.template?.title) return resolveTemplate(entry.block.template.title, params);
  return (langBlock as Record<string, unknown>)?.title as string ?? entry.block.title ?? '';
}
type MenuItemsData = MenuItemDef[];
function buildStateMap(stateSets: StateSet[]): Map<string, ResourceStateEntry> {
  const map = new Map<string, ResourceStateEntry>();
  for (const ss of stateSets) {
    map.set('set.' + ss.code, { code: 'set.' + ss.code, color: ss.color, block: ss.block });
    for (const st of ss.states) map.set(st.code, st);
  }
  return map;
}

// inkColorMap kept for popover condition checks
const inkColorMap: Record<string, string> = {
  cyan: '#00bcd4',
  magenta: '#e91e63',
  yellow: '#ffeb3b',
  black: '#333333',
};

function getExpiringInks(res: Resource, days = 5): { color: string; amount: number; expires: string; }[] {
  if (!res.inks) return [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const result: { color: string; amount: number; expires: string; }[] = [];
  for (const [color, ink] of Object.entries(res.inks)) {
    const expDate = new Date(ink.expires);
    if (expDate <= cutoff) {
      result.push({ color, amount: ink.amount, expires: ink.expires });
    }
  }
  return result;
}

/* ---- Shift definitions ---- */
const SHIFTS = [
  { name: 'Shift 1', startHour: 6, endHour: 15 },
  { name: 'Shift 2', startHour: 15, endHour: 24 },
];


function shiftDurationHours(shift: typeof SHIFTS[0]) {
  if (shift.endHour > shift.startHour) return shift.endHour - shift.startHour;
  return 24 - shift.startHour + shift.endHour;
}

/** Nominal speed (sqm/hr) by equipment name pattern */
function getNominalSpeed(name: string): number {
  const n = name.toLowerCase();
  if (n.includes('q-line') || n.includes('qline')) return 160;
  if (n.includes('350')) return 186;
  if (n.includes('210-hs') || n.includes('210 hs')) return 130;
  if (n.includes('210')) return 70;
  if (n.includes('500')) return 186;
  if (n.includes('epson') || n.includes('sc-s') || n.includes('sc-g')) return 30;
  if (n.includes('hp')) return 30;
  if (n.includes('swissq') || n.includes('kudu') || n.includes('karibu')) return 160;
  if (n.includes('zünd') || n.includes('zund') || n.includes('bullmer') || n.includes('aristo') || n.includes('itotec')) return 60;
  if (n.includes('sei') || n.includes('laser') || n.includes('abg')) return 60;
  if (n.includes('tau')) return 50;
  if (n.includes('rho')) return 100;
  return 50; // default for other equipment (laminators, calanders, etc.)
}

/** Deterministic pseudo-random from string seed (0..1) */
function seedRand(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return ((Math.abs(h) * 2654435761) >>> 0) / 4294967296;
}

/**
 * Simulate time-dependent OEE for a shift.
 * Ramps up during first hour (startup), peaks mid-shift, slight dip at end.
 * Before shift start: shows the base OEE (projected).
 * After shift end: shows the final OEE (what was achieved).
 */
function timeBasedOee(baseOee: number, shift: typeof SHIFTS[0], h: number, seed: string): number {
  const shiftH = shiftDurationHours(shift);
  let elapsed: number;
  if (h < shift.startHour) {
    // Before this shift — show projected base OEE
    return baseOee;
  } else if (h >= shift.endHour) {
    // After shift — final OEE (slight random offset to feel "settled")
    elapsed = shiftH;
  } else {
    elapsed = h - shift.startHour;
  }

  const progress = elapsed / shiftH; // 0..1
  // Curve: ramp up in first 15%, peak at 40-70%, slight dip at end
  // Uses a smooth bell-ish shape centered around 55% of the shift
  let factor: number;
  if (progress < 0.15) {
    // Startup ramp: 70% → 100% of base
    factor = 0.70 + (progress / 0.15) * 0.30;
  } else if (progress < 0.75) {
    // Peak zone: 100-105% of base
    factor = 1.0 + 0.05 * Math.sin(((progress - 0.15) / 0.60) * Math.PI);
  } else {
    // End-of-shift dip: 100% → 92% of base
    factor = 1.0 - 0.08 * ((progress - 0.75) / 0.25);
  }

  // Add small per-resource deterministic jitter (±3%)
  const jitter = (seedRand(seed) - 0.5) * 0.06;
  const oee = Math.round(baseOee * (factor + jitter));
  return Math.max(0, Math.min(100, oee));
}

/** Compute per-resource capacity for both shifts, with time-dependent OEE */
function computeResourceShiftStats(resource: Resource, minutesFromMidnight: number, stateCode: string, oee: number) {
  const baseOee = oee;
  const h = minutesFromMidnight / 60;
  const speed = getNominalSpeed(resource.name);
  const isBreakdown = stateCode === 'breakdown' || stateCode === 'offline';
  const isIdle = stateCode === 'idle';

  return SHIFTS.map(shift => {
    const shiftH = shiftDurationHours(shift);
    let remainingH: number;
    if (h < shift.startHour) {
      remainingH = shiftH;
    } else if (h >= shift.endHour) {
      remainingH = 0;
    } else {
      remainingH = shift.endHour - h;
    }

    // Time-dependent OEE
    let shiftOee: number;
    if (isBreakdown) {
      shiftOee = 0;
    } else if (isIdle && remainingH > 0) {
      shiftOee = 100;
    } else {
      shiftOee = timeBasedOee(baseOee, shift, h, resource.layout_name + shift.name);
    }

    // Capacity: breakdown=0, otherwise full speed * remaining time
    const capacity = isBreakdown ? 0 : Math.round(speed * remainingH);

    // Planned: simulate as 60-85% of capacity (deterministic per resource+shift)
    const plannedRatio = 0.60 + seedRand(resource.layout_name + shift.name) * 0.25;
    const planned = isBreakdown ? 0 : Math.round(capacity * plannedRatio);

    const available = capacity - planned;

    return {
      name: shift.name,
      oee: shiftOee,
      capacity,
      planned,
      available,
      remainingH: Math.round(remainingH * 10) / 10,
    };
  });
}

/* ---- Main page ---- */
export function ProductionLinesPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState(() => getLanguage());
  const handleLanguageChange = useCallback((newLang?: string) => {
    setLang(newLang ?? getLanguage());
  }, []);
  const { config: pageConfig, content: pageContent } = usePage('production-lines');

  // Read query params from URL
  const urlParams = useQueryParams([
    { key: 'model', is_query_param: true },
    { key: 'until', is_query_param: true },
    { key: 'resource_uids', is_query_param: true },
    { key: 'capacity', is_query_param: true },
    { key: 'lang', is_query_param: true },
  ]);
  const urlModel = urlParams.find(p => p.key === 'model')?.val as string | undefined;
  const urlUntil = urlParams.find(p => p.key === 'until')?.val as string | undefined;
  const urlResourceUids = urlParams.find(p => p.key === 'resource_uids')?.val as string[] | null;
  const urlCapacity = urlParams.find(p => p.key === 'capacity')?.val as string | undefined;
  const urlLang = urlParams.find(p => p.key === 'lang')?.val as string | undefined;

  // Derive committed selectedDates / timeSlot from the URL `until`. The
  // `TimelineControls` component owns the from/until URL state.
  const committedUntil = urlUntil ?? new Date().toISOString();
  const selectedDates = useMemo(() => [parseUntil(committedUntil).date], [committedUntil]);
  const timeSlot = useMemo(() => parseUntil(committedUntil).slot, [committedUntil]);

  const [allLines, setAllLines] = useState<LineConfig[]>([]);
  const { rowMap: overviewMap, dataGroup: overviewDataGroup, dataTable: overviewDataTable } = useProductionLineOverview();
  const [activeLineId, setActiveLineId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('model') || 'sheet';
  });
  const [lineConfig, setLineConfig] = useState<LineConfig | null>(null);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [lineResources, setLineResources] = useState<Resource[]>([]);
  const [stateMap, setStateMap] = useState<Map<string, ResourceStateEntry>>(new Map());
  const [menuItems, setMenuItems] = useState<MenuItemDef[]>([]);
  const [menuContent, setMenuContent] = useState<Map<string, MenuContentEntry>>(new Map());
  const [uiLabels, setUiLabels] = useState<UiLabel[]>([]);
  const modelsDataRef = useRef<ModelsData | null>(null);
  const lineResRef = useRef<Resource[]>([]);
  const stateMapRef = useRef<Map<string, ResourceStateEntry>>(new Map());
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const overviewMapRef = useRef(overviewMap);
  overviewMapRef.current = overviewMap;
  const dismissPopoverRef = useRef<(() => void) | null>(null);
  const popoverOpenRef = useRef(false);
  const ctrlKeyRef = useRef(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Control') ctrlKeyRef.current = true; };
    const up = (e: KeyboardEvent) => { if (e.key === 'Control') ctrlKeyRef.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  // Derive selectedKeys from URL resource_uids + overviewMap (URL is single source of truth)
  const selectedKeys = useMemo<Set<string>>(() => {
    if (!Array.isArray(urlResourceUids) || urlResourceUids.length === 0 || overviewMap.size === 0) {
      return new Set();
    }
    const uidSet = new Set(urlResourceUids as string[]);
    const names = new Set<string>();
    for (const [layoutName, row] of overviewMap) {
      if (row.resource_uid && uidSet.has(row.resource_uid)) {
        names.add(layoutName);
      }
    }
    return names;
  }, [urlResourceUids, overviewMap]);

  // Convert layout names to UIDs for writing to URL
  const layoutNamesToUids = useCallback((names: Iterable<string>): string[] => {
    const uids: string[] = [];
    for (const name of names) {
      const uid = overviewMapRef.current.get(name)?.resource_uid;
      if (uid) uids.push(uid);
    }
    return uids;
  }, []);

  // Write resource_uids to URL (only called from user actions)
  const setResourceUidsInUrl = useCallback((uids: string[]) => {
    rewriteUrl(qp => {
      if (uids.length > 0) qp.set('resource_uids', JSON.stringify(uids));
      else qp.delete('resource_uids');
      qp.delete('selected');
      qp.delete('resource');
    });
  }, []);

  const hadActiveRef = useRef(false);
  const [showCapacity, setShowCapacity] = useState(() => urlCapacity === 'true');
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');

  // Apply ?lang=… on mount and whenever the URL value changes externally.
  useEffect(() => {
    if (urlLang && urlLang !== getLanguage()) {
      setLanguage(urlLang);
      setLang(urlLang);
    }
  }, [urlLang]);

  // React to capacity query param changes
  useEffect(() => {
    const v = urlCapacity === 'true';
    if (v !== showCapacity) setShowCapacity(v);
  }, [urlCapacity]);

  // Sync model, capacity, lang to URL (from/until owned by TimelineControls).
  useEffect(() => {
    syncQueryParams({
      model: activeLineId,
      capacity: showCapacity ? 'true' : null,
      lang,
    });
  }, [activeLineId, showCapacity, lang]);

  // React to model query param changes
  useEffect(() => {
    if (urlModel && urlModel !== activeLineId) {
      setActiveLineId(urlModel);
    }
  }, [urlModel]);

  // Fetch data
  useEffect(() => {
    Promise.all([
      fetch('/data/models.json').then(r => r.json()),
      fetch('/data/resource.json').then(r => r.json()),
      fetch('/data/resource_states.json').then(r => r.json()),
      fetch('/data/menu-items.json').then(r => r.json()),
      fetch('/data/ui-labels.json').then(r => r.json()),
    ])
      .then(([modelsData, resData, statesData, menuItemsData, labelsData]) => {
        setUiLabels(labelsData);
        modelsDataRef.current = modelsData;
        setAllLines(modelsData);
        const sets = statesData as StateSet[];
        const map = buildStateMap(sets);
        setStateMap(map);
        stateMapRef.current = map;
        const items = menuItemsData as MenuItemsData;
        setMenuItems(items);
        const mc = new Map<string, MenuContentEntry>();
        for (const item of items) {
          if (item.block && !mc.has(item.code)) {
            mc.set(item.code, { code: item.code, block: item.block });
          }
        }
        setMenuContent(mc);
        const line = modelsData.find((l: LineConfig) => l.code === activeLineId);
        if (line) setLineConfig(line);
        setAllResources(resData.resources);
        const filtered = resData.resources.filter((r: Resource) => r.line === activeLineId);
        setLineResources(filtered);
        lineResRef.current = filtered;
        document.title = `Planning — ${getBlock(modelsData, activeLineId, 'title')}`;
      });
  }, [activeLineId]);

  const minutesFromMidnight = timeSlot * 5;
  const resourceData: JSONRecord[] = useMemo(() => lineResources.map(r => {
    const overview = overviewMap.get(r.layout_name);
    const stateCode = overview?.state.code ?? 'offline';
    const color = overview?.state.color ?? '#888888';
    const oee = r.oee ?? 0;
    const isEquipment = r.type !== 'stock' && r.type !== 'queue';
    const shifts = isEquipment ? computeResourceShiftStats(r, minutesFromMidnight, stateCode, oee) : undefined;
    return {
      layout_name: r.layout_name,
      color,
      type: r.type,
      oee,
      selected: selectedKeys.has(r.layout_name),
      ...(shifts ? { _shifts: shifts as unknown as JSONRecord[] } : {}),
      ...(r.ink_expiration ? { ink_expiration: true, inks: r.inks } : {}),
    };
  }), [lineResources, overviewMap, selectedKeys, minutesFromMidnight]);

  const handleSaveCamera = useCallback((state: CameraState) => {
    const models = modelsDataRef.current;
    if (!models) return;
    const line = models.find(l => l.code === activeLineId);
    if (!line) return;
    const key = viewMode === '2d' ? 'camera2d' : 'camera';
    line[key] = state;
    setLineConfig(prev => prev ? { ...prev, [key]: state } : prev);
    fetch('/data/models.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(models, null, 2),
    }).catch(err => console.error('Failed to save camera:', err));
  }, [activeLineId, viewMode]);

  const switchLine = useCallback((id: string) => {
    if (id === activeLineId) return;
    setActiveLineId(id);
    syncQueryParams({ model: id });
    setResourceUidsInUrl([]);
    const models = modelsDataRef.current;
    const line = models?.find(l => l.code === id);
    if (line) {
      setLineConfig(line);
      document.title = `Planning — ${getBlock(models!, line.code, 'title')}`;
      const filtered = allResources.filter(r => r.line === id);
      setLineResources(filtered);
      lineResRef.current = filtered;
    }
  }, [activeLineId, allResources]);

  // When an object is clicked, update resource_uids in URL directly
  const handleObjectClick = useCallback((data: Record<string, unknown> | null) => {
    const ctrl = ctrlKeyRef.current;
    if (!data) {
      if (popoverOpenRef.current) {
        popoverOpenRef.current = false;
        return;
      }
      if (ctrl) {
        // Ctrl+floor click: select all non-stock/queue
        const selectableNames = lineResRef.current
          .filter(r => r.type !== 'stock' && r.type !== 'queue')
          .map(r => r.layout_name);
        setResourceUidsInUrl(layoutNamesToUids(selectableNames));
      } else {
        // Floor click without Ctrl: deselect everything
        setResourceUidsInUrl([]);
        hadActiveRef.current = false;
      }
      return;
    }

    hadActiveRef.current = true;

    const nodeName = data.name as string;
    const key = nodeName?.includes('_') ? nodeName.split('_').slice(1).join('_') : nodeName;
    const res = lineResRef.current.find(r => r.layout_name === key);
    if (!res) return;

    if (res.type !== 'stock' && res.type !== 'queue') {
      const uid = overviewMapRef.current.get(res.layout_name)?.resource_uid;
      if (!uid) return;

      if (ctrl) {
        // Ctrl+click: toggle this resource in the current selection
        const currentUids = Array.isArray(urlResourceUids) ? [...urlResourceUids as string[]] : [];
        const idx = currentUids.indexOf(uid);
        if (idx >= 0) {
          currentUids.splice(idx, 1);
        } else {
          currentUids.push(uid);
        }
        setResourceUidsInUrl(currentUids);
      } else {
        setResourceUidsInUrl([uid]);
      }
    }
  }, [layoutNamesToUids, setResourceUidsInUrl, urlResourceUids]);

  // renderPopover: shows the context menu at the clicked resource
  const menuItemsRef = useRef(menuItems);
  menuItemsRef.current = menuItems;
  const menuContentRef = useRef(menuContent);
  menuContentRef.current = menuContent;

  const renderPopover = useCallback((data: Record<string, unknown>) => {
    popoverOpenRef.current = true;
    const nodeName = data.name as string;
    const key = nodeName?.includes('_') ? nodeName.split('_').slice(1).join('_') : nodeName;
    const res = lineResRef.current.find(r => r.layout_name === key);
    if (!res) return null;

    const expiringInks = getExpiringInks(res);
    // Filter menu items by hidden_when rule
    const items = menuItemsRef.current.filter(item => {
      if (!item.hidden_when) return true;
      const { op, val } = item.hidden_when;
      if (op === 'not in') return val.includes(res.type);
      if (op === 'in') return !val.includes(res.type);
      return true;
    });

    const openMenuItem = (path: string) => {
      const uid = overviewMapRef.current.get(res.layout_name)?.resource_uid;
      navigateRef.current({
        queryParams: uid ? [{ key: 'resource_uids', val: JSON.stringify([uid]) }] : [],
        partialPath: path,
      });
      dismissPopoverRef.current?.();
    };

    return (
      <div className="planning-menu-inner">
        {items.map(item => {
          // Check conditions
          if (item.condition === 'inks_expiring' && expiringInks.length === 0) return null;

          const entry = menuContentRef.current.get(item.code);
          const label = resolveMenuLabel(entry, { resource_name: res.name }) || item.code;

          return (
            <button key={item.code} className="planning-menu-item" onPointerDown={e => { e.stopPropagation(); openMenuItem(item.path); }}>
              <span className="planning-menu-label">{label}</span>
            </button>
          );
        })}
      </div>
    );
  }, []);

  // Render capacity tooltip on each equipment object in 3D scene.
  // Sourced from production_line_overview. The tooltip config may be authored
  // under several paths depending on backend version, so we probe each.
  const dgRecord = overviewDataGroup as unknown as Record<string, unknown> | undefined;
  const pickTooltip = (...path: string[]): TooltipConfig | undefined => {
    let cur: unknown = dgRecord;
    for (const p of path) {
      if (!cur || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[p];
    }
    if (cur && typeof cur === 'object') {
      const c = cur as Record<string, unknown>;
      if (c.field_config || c.sections || c.hidden_when) return c as TooltipConfig;
    }
    return undefined;
  };
  const tooltipConfig =
    pickTooltip('three_d_config', 'tooltip') ??
    pickTooltip('widget_config', 'three_d_config', 'tooltip') ??
    pickTooltip('widget_config', 'tooltip') ??
    pickTooltip('tooltip');
  // Build the field_config the tooltip will see by combining:
  //   1. dataTable.schema  (PgField — supplies scale, control, schema-level ui.i18n)
  //   2. dataGroup.field_config (and widget_config.field_config) — UI overrides
  // FieldTooltip then merges this over the section-level field_config in tooltipConfig.
  const tooltipFieldConfig = useMemo(() => {
    const result: Record<string, TooltipFieldConfigEntry> = {};
    const schema = (overviewDataTable?.schema ?? {}) as Record<string, { scale?: number; ui?: Record<string, unknown>; pg_type?: string }>;
    const dgFc = (
      (dgRecord?.field_config as Record<string, TooltipFieldConfigEntry> | undefined) ??
      ((dgRecord?.widget_config as Record<string, unknown> | undefined)?.field_config as Record<string, TooltipFieldConfigEntry> | undefined) ??
      {}
    );
    const allKeys = new Set<string>([...Object.keys(schema), ...Object.keys(dgFc)]);
    for (const key of allKeys) {
      const pg = schema[key];
      const dg = dgFc[key];
      const pgUi = (pg?.ui ?? {}) as Record<string, unknown>;
      const dgUi = ((dg as Record<string, unknown> | undefined)?.ui ?? {}) as Record<string, unknown>;
      // Promote PgField.scale → ui.scale so display rounding picks it up by default.
      // dataGroup.field_config.ui.scale (if set) wins via the spread order.
      const mergedUi: Record<string, unknown> = {
        ...(pg?.scale != null ? { scale: pg.scale } : {}),
        ...pgUi,
        ...dgUi,
      };
      result[key] = { ...(dg ?? {}), ui: mergedUi as TooltipFieldConfigEntry['ui'] } as TooltipFieldConfigEntry;
    }
    return result;
  }, [overviewDataTable, dgRecord]);
  const renderLabel = useCallback((data: Record<string, unknown>) => (
    <CapacityTooltip
      objectData={data}
      show={showCapacity}
      overviewMap={overviewMap}
      tooltipConfig={tooltipConfig}
      fieldConfig={tooltipFieldConfig}
    />
  ), [showCapacity, tooltipConfig, tooltipFieldConfig, overviewMap]);

  const offTrackCount = useMemo(() => lineResources.filter(r => {
    const s = overviewMap.get(r.layout_name)?.state.code ?? 'offline';
    return s === 'breakdown' || s === 'starved' || s === 'starved.operator' || s === 'blocked';
  }).length, [lineResources, overviewMap]);

  if (!lineConfig) {
    return (
      <div className="planning-page">
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-text">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="planning-page">
      <div className="planning-main">
        <PageHeader
          allLines={allLines}
          activeLineId={activeLineId}
          switchLine={switchLine}
          uiLabels={uiLabels}
          onLanguageChange={handleLanguageChange}
          actions={
            <Toggle
              isSelected={showCapacity}
              onChange={setShowCapacity}
              label={getBlock(uiLabels, 'capacity', 'title')}
            />
          }
        >
          <TimelineControls uiLabels={uiLabels} />
        </PageHeader>


        <div className="planning-content">
          <div className="planning-viewer">
            <ThreeModelView
              key={`${lineConfig.code}-${viewMode}`}
              url={lineConfig.glb}
              className="scene"
              data={resourceData}
              colorKey="color"
              renderPopover={renderPopover}
              renderLabel={renderLabel}
              initialCamera={viewMode === '2d' ? (lineConfig.camera2d ?? { position: [0, 20, 0], target: [0, 0, 0] }) : lineConfig.camera}
              onSaveCamera={handleSaveCamera}
              onObjectClick={handleObjectClick}
              popoverRef={dismissPopoverRef}
            />
            <button
              className="planning-view-toggle planning-icon-btn"
              title={viewMode === '3d' ? 'Switch to 2D view' : 'Switch to 3D view'}
              onClick={() => setViewMode(v => v === '3d' ? '2d' : '3d')}
            >
              {viewMode === '3d' ? '2D' : '3D'}
            </button>
          </div>
        </div>

        <PageFooter footerConfig={pageConfig?.footer} content={pageContent} />
      </div>{/* .planning-main */}

      <PageSidebar />
    </div>
  );
}
