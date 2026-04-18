import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThreeModelView, type CameraState, type JSONRecord } from 'xfw-three';
import {
  useNavigate,
  useQueryParams,
  useAuxOutlet,
  AuxRouteProvider,
} from '@s-flex/xfw-url';
import { getBlock, setLanguage, getLanguage, languages } from 'xfw-get-block';
import type { Resource } from './viewer/types';
import { useProductionLineOverview } from './hooks/useProductionLineOverview';
import { PageHeader } from './PageHeader';
import { PageFooter } from './PageFooter';
import { PageSidebar } from './PageSidebar';
import { Sidebar, Toggle } from '@s-flex/xfw-ui';
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

function formatTimeSlot(slot: number): string {
  const totalMinutes = slot * 5;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
  const [, forceRender] = useState(0);
  const handleLanguageChange = useCallback(() => forceRender(n => n + 1), []);
  const { config: pageConfig, content: pageContent } = usePage('production-lines');

  // Read query params from URL
  const urlParams = useQueryParams([
    { key: 'model', is_query_param: true },
    { key: 'from', is_query_param: true },
    { key: 'until', is_query_param: true },
    { key: 'resource_uids', is_query_param: true },
  ]);
  const urlModel = urlParams.find(p => p.key === 'model')?.val as string | undefined;
  const urlFrom = urlParams.find(p => p.key === 'from')?.val as string | undefined;
  const urlUntil = urlParams.find(p => p.key === 'until')?.val as string | undefined;
  const urlResourceUids = urlParams.find(p => p.key === 'resource_uids')?.val as string[] | null;

  // Build a 06:00 ISO string for a given YYYY-MM-DD date
  const buildFromIso = useCallback((date: string) => {
    return new Date(`${date}T06:00:00`).toISOString();
  }, []);

  // `from` is the committed "from" value sent to the API; `pendingFromDate` is staged in the UI
  const [from, setFrom] = useState<string>(() => {
    if (urlFrom) return urlFrom;
    return buildFromIso(new Date().toISOString().slice(0, 10));
  });
  const [pendingFromDate, setPendingFromDate] = useState(() => from.slice(0, 10));

  // `until` is the committed value sent to the API; `pending*` is staged in the UI
  const [until, setUntil] = useState<string>(() => {
    if (urlUntil) return urlUntil;
    return new Date().toISOString();
  });
  const [pendingDate, setPendingDate] = useState(() => until.slice(0, 10));
  const [pendingSlot, setPendingSlot] = useState(() => {
    const d = new Date(until);
    return Math.round((d.getHours() * 60 + d.getMinutes()) / 5);
  });
  const [looping, setLooping] = useState(false);
  const loopRef = useRef(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef(false);

  // React to from query param changes
  useEffect(() => {
    if (urlFrom && urlFrom !== from) {
      setFrom(urlFrom);
      setPendingFromDate(urlFrom.slice(0, 10));
    }
  }, [urlFrom]);

  // React to until query param changes
  useEffect(() => {
    if (urlUntil && urlUntil !== until) {
      setUntil(urlUntil);
      setPendingDate(urlUntil.slice(0, 10));
      const d = new Date(urlUntil);
      setPendingSlot(Math.round((d.getHours() * 60 + d.getMinutes()) / 5));
    }
  }, [urlUntil]);

  // Derive selectedDates from committed until for timeline components
  const selectedDates = useMemo(() => [until.slice(0, 10)], [until]);
  const timeSlot = useMemo(() => {
    const d = new Date(until);
    return Math.round((d.getHours() * 60 + d.getMinutes()) / 5);
  }, [until]);

  // Slider bounds (6:00 = slot 72, 24:00 = slot 288)
  const sliderMin = 72;
  const sliderMax = 288;

  const pendingTimeLabel = formatTimeSlot(pendingSlot);

  // Build ISO string from pending date + slot
  const buildUntilFromSlot = useCallback((date: string, slot: number) => {
    const totalMinutes = slot * 5;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).toISOString();
  }, []);

  const handleRefresh = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    let slot = pendingSlot;
    // If viewing today and slot exceeds current time, clamp to now
    if (pendingDate === today) {
      const now = new Date();
      const nowSlot = Math.round((now.getHours() * 60 + now.getMinutes()) / 5);
      if (slot > nowSlot) {
        slot = nowSlot;
        setPendingSlot(slot);
      }
    }
    const untilIso = buildUntilFromSlot(pendingDate, slot);
    // Clamp from date: if it's after the until date, reset it to the until date
    let fromDate = pendingFromDate;
    if (fromDate > pendingDate) {
      fromDate = pendingDate;
      setPendingFromDate(pendingDate);
    }
    setFrom(buildFromIso(fromDate));
    setUntil(untilIso);
  }, [pendingFromDate, pendingDate, pendingSlot, buildFromIso, buildUntilFromSlot]);

  const handleNow = useCallback(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const slot = Math.round((now.getHours() * 60 + now.getMinutes()) / 5);
    setPendingFromDate(today);
    setPendingDate(today);
    setPendingSlot(slot);
    setFrom(buildFromIso(today));
    setUntil(buildUntilFromSlot(today, slot));
    // Start auto-refresh
    autoRefreshRef.current = true;
    setAutoRefresh(true);
  }, [buildFromIso, buildUntilFromSlot]);

  const handleDateChange = useCallback((date: string) => {
    setPendingDate(date);
    // Stop auto-refresh when date is changed manually
    autoRefreshRef.current = false;
    setAutoRefresh(false);
  }, []);

  // Stop auto-refresh when time slider is changed manually
  const handleSlotChange = useCallback((slot: number) => {
    setPendingSlot(slot);
    autoRefreshRef.current = false;
    setAutoRefresh(false);
  }, []);

  const handleLoop = useCallback(() => {
    if (looping) {
      loopRef.current = false;
      setLooping(false);
      return;
    }
    loopRef.current = true;
    setLooping(true);
    let slot = 72; // start at 6:00
    setPendingSlot(slot);
    const date = pendingDate;
    const max = sliderMax;

    const step = () => {
      if (!loopRef.current) return;
      slot += 1; // +1 slot = +5 minutes
      if (slot > max) {
        loopRef.current = false;
        setLooping(false);
        return;
      }
      setPendingSlot(slot);
      const iso = buildUntilFromSlot(date, slot);
      setUntil(iso);
      setTimeout(step, 250);
    };
    step();
  }, [looping, pendingSlot, pendingDate, sliderMax, buildUntilFromSlot]);

  // Auto-refresh every 60 seconds: update to current time and sync URL
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (!autoRefreshRef.current) return;
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const slot = Math.round((now.getHours() * 60 + now.getMinutes()) / 5);
      setPendingFromDate(today);
      setPendingDate(today);
      setPendingSlot(slot);
      setFrom(buildFromIso(today));
      setUntil(buildUntilFromSlot(today, slot));
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, buildFromIso, buildUntilFromSlot]);

  const [allLines, setAllLines] = useState<LineConfig[]>([]);
  const { rowMap: overviewMap } = useProductionLineOverview();
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
    const params = new URLSearchParams(window.location.search);
    if (uids.length > 0) {
      params.set('resource_uids', JSON.stringify(uids));
    } else {
      params.delete('resource_uids');
    }
    params.delete('selected');
    params.delete('resource');
    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, []);

  const hadActiveRef = useRef(false);
  const [showCapacity, setShowCapacity] = useState(false);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');

  // Sync model, from, until to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('model', activeLineId);
    params.set('from', from);
    params.set('until', until);
    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, [activeLineId, from, until]);

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
    const params = new URLSearchParams(window.location.search);
    params.set('model', id);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
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

  // Render capacity label on each equipment object in 3D scene
  const renderLabel = useCallback((data: Record<string, unknown>) => {
    if (!showCapacity) return null;
    if (data.type === 'stock' || data.type === 'queue') return null;
    const shifts = data._shifts as { name: string; oee: number; capacity: number; planned: number; available: number; }[] | undefined;
    if (!shifts) return null;
    return (
      <div className="planning-3d-label">
        {shifts.map((s, i) => {
          const oeeColor = s.oee >= 75 ? '#079455' : s.oee >= 50 ? '#eab308' : '#d92d20';
          return (
            <div key={s.name}>
              {i > 0 && <div className="planning-3d-label-hdivider" />}
              <div className="planning-3d-label-shift">{s.name}</div>
              <div className="planning-3d-label-oee" style={{ color: oeeColor }}>OEE {s.oee}%</div>
              <div className="planning-3d-label-cap">Capacity {s.capacity} m²</div>
              <div className="planning-3d-label-cap">Planned {s.planned} m²</div>
              <div className="planning-3d-label-avail">Available {s.available} m²</div>
            </div>
          );
        })}
      </div>
    );
  }, [showCapacity]);

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
          <div className="planning-until">
            <label className="planning-until-label">{getBlock(uiLabels, 'from', 'title')}</label>
            <input
              type="date"
              className="planning-until-input"
              value={pendingFromDate}
              max={pendingDate}
              onChange={e => { setPendingFromDate(e.target.value); autoRefreshRef.current = false; setAutoRefresh(false); }}
            />
          </div>
          <div className="planning-until">
            <label className="planning-until-label">{getBlock(uiLabels, 'until', 'title')}</label>
            <input
              type="date"
              className="planning-until-input"
              value={pendingDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => handleDateChange(e.target.value)}
            />
          </div>
          <div className="planning-time-slider">
            <span className="planning-time-label">{formatTimeSlot(sliderMin)}</span>
            <input
              type="range"
              className="planning-time-range"
              min={sliderMin}
              max={sliderMax}
              value={Math.min(pendingSlot, sliderMax)}
              onChange={e => handleSlotChange(Number(e.target.value))}
            />
            <span className="planning-time-label">{formatTimeSlot(sliderMax)}</span>
            <span className="planning-time-current">{pendingTimeLabel}</span>
            <button className="planning-icon-btn planning-slider-btn" title="Refresh" onClick={handleRefresh}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M17 10a7 7 0 01-12.9 3.8M3 10a7 7 0 0112.9-3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M17 4v4h-4M3 16v-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className={`planning-icon-btn planning-slider-btn${looping ? ' active' : ''}`} title={looping ? 'Stop loop' : 'Loop timeline'} onClick={handleLoop}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M14 3l3 3-3 3M6 17l-3-3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M17 6H8a4 4 0 00-4 4M3 14h9a4 4 0 004-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button className={`planning-icon-btn planning-slider-btn${autoRefresh ? ' active' : ''}`} title={getBlock(uiLabels, 'now', 'title')} onClick={handleNow}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
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

      <PageSidebar menuContent={menuContent} />
      <Sidebar side="right" idx={0} />
      <Sidebar side="right" idx={1} />
    </div>
  );
}
