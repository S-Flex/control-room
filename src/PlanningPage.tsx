import { useCallback, useEffect, useRef, useState } from 'react';
import { ThreeModelView, type CameraState, type JSONRecord } from 'xfw-three';
import {
  useNavigate,
  useQueryParams,
  useAuxOutlet,
  AuxRouteProvider,
} from 'xfw-url';
import type { Resource } from './viewer/types';
import './app.css';

type LineConfig = {
  id: string;
  name: string;
  glb: string;
  camera?: CameraState;
};

type ModelsData = { lines: LineConfig[]; };

type ResourceStateEntry = {
  code: string;
  color: string;
  block: {
    title: string;
    i18n?: Record<string, { title: string; }>;
  };
};
type ResourceStatesData = {
  content: ResourceStateEntry[];
  states: { code: string; }[];
};

function buildStateMap(data: ResourceStatesData): Map<string, ResourceStateEntry> {
  const map = new Map<string, ResourceStateEntry>();
  for (const entry of data.content) map.set(entry.code, entry);
  return map;
}

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

/* ---- Sidebar content component ---- */
function ResourceSidebarContent({ resource, stateMap, menuItem }: {
  resource: Resource;
  stateMap: Map<string, ResourceStateEntry>;
  menuItem: string;
}) {
  const state = stateMap.get(resource.state);
  if (!state) return null;

  return (
    <div className="planning-sidebar-content">
      <div className="planning-sidebar-title-row">
        <span className="planning-sidebar-dot" style={{ background: state.color }} />
        <h3 className="planning-sidebar-name">{resource.name}</h3>
      </div>
      <div className="planning-sidebar-status" style={{ background: state.color + '20', color: state.color }}>
        {state.block.title}
      </div>

      {menuItem === 'inks' && resource.inks ? (
        <div className="planning-sidebar-section">
          <div className="planning-sidebar-section-title">Ink Levels</div>
          <div className="planning-sidebar-inks">
            {Object.entries(resource.inks).map(([color, ink]) => {
              const expDate = new Date(ink.expires);
              const now = new Date();
              const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const isExpiring = daysLeft <= 5;
              return (
                <div key={color} className="planning-sidebar-ink-row">
                  <div className="planning-sidebar-ink-header">
                    <span className="planning-sidebar-ink-color-dot" style={{ background: inkColorMap[color] || '#888' }} />
                    <span className="planning-sidebar-ink-name">{color.charAt(0).toUpperCase() + color.slice(1)}</span>
                    <span className={`planning-sidebar-ink-expires${isExpiring ? ' expiring' : ''}`}>
                      {isExpiring ? `${daysLeft}d left` : ink.expires}
                    </span>
                  </div>
                  <div className="planning-sidebar-ink-bar">
                    <div className="planning-sidebar-ink-fill" style={{ width: `${ink.amount}%`, background: inkColorMap[color] || '#888' }} />
                  </div>
                  <div className="planning-sidebar-ink-pct">{ink.amount}%</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="planning-sidebar-section">
            <div className="planning-sidebar-section-title">OEE</div>
            <div className="planning-sidebar-oee">
              <div className="planning-sidebar-oee-value">{resource.oee ?? '—'}%</div>
              <div className="planning-sidebar-oee-bar">
                <div className="planning-sidebar-oee-fill" style={{ width: `${resource.oee ?? 0}%`, background: state.color }} />
              </div>
            </div>
          </div>
          <div className="planning-sidebar-section">
            <div className="planning-sidebar-section-title">Performance</div>
            <div className="planning-sidebar-stats">
              <div className="planning-sidebar-stat"><span className="planning-sidebar-stat-label">Producing</span><span className="planning-sidebar-stat-value">{resource.producing ?? '—'}%</span></div>
              <div className="planning-sidebar-stat"><span className="planning-sidebar-stat-label">Stopped</span><span className="planning-sidebar-stat-value">{resource.stopped ?? '—'}%</span></div>
              <div className="planning-sidebar-stat"><span className="planning-sidebar-stat-label">Inactive</span><span className="planning-sidebar-stat-value">{resource.inactive ?? '—'}%</span></div>
            </div>
          </div>
          <div className="planning-sidebar-section">
            <div className="planning-sidebar-section-title">Details</div>
            <div className="planning-sidebar-stats">
              <div className="planning-sidebar-stat"><span className="planning-sidebar-stat-label">Type</span><span className="planning-sidebar-stat-value">{resource.type}</span></div>
              <div className="planning-sidebar-stat"><span className="planning-sidebar-stat-label">Errors</span><span className="planning-sidebar-stat-value planning-stat-red">{resource.errors ?? 0}</span></div>
              <div className="planning-sidebar-stat"><span className="planning-sidebar-stat-label">Downtime</span><span className="planning-sidebar-stat-value">{resource.downtime ?? '—'}</span></div>
              <div className="planning-sidebar-stat"><span className="planning-sidebar-stat-label">Jobs today</span><span className="planning-sidebar-stat-value">{resource.jobsToday ?? '—'}</span></div>
              {resource.material && (
                <div className="planning-sidebar-stat"><span className="planning-sidebar-stat-label">Material</span><span className="planning-sidebar-stat-value">{resource.material}</span></div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Sidebar panel: reads aux route + query param, renders directly ---- */
function PlanningResourceSidebarPanel({ resources, stateMap }: {
  resources: Resource[];
  stateMap: Map<string, ResourceStateEntry>;
}) {
  const navigate = useNavigate();
  const menuItem = useAuxOutlet({ outlet: 'sidebar' });
  const params = useQueryParams([{ key: 'resource', isQueryParam: true }]);
  const resourceKey = params.find(p => p.key === 'resource')?.val as string | undefined;
  const resource = resourceKey ? resources.find(r => r.layout_name === resourceKey) : undefined;

  if (!menuItem || !resource) return null;

  // menuItem comes as "/oee" from useAuxOutlet, strip leading slash
  const item = menuItem.replace(/^\//, '');
  console.log(item);

  return (
    <div className="planning-sidebar">
      <div className="planning-sidebar-header">
        <div className="planning-sidebar-title-row">
          <h3 className="planning-sidebar-name">{resource.name}</h3>
        </div>
        <button className="planning-sidebar-close" onClick={() => navigate('(sidebar:)')}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <ResourceSidebarContent resource={resource} stateMap={stateMap} menuItem={item} />
    </div>
  );
}

function formatTimeSlot(slot: number): string {
  const totalMinutes = slot * 5;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* ---- Main page ---- */
export function PlanningPage() {
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => document.body.classList.contains('dark'));
  const [lang, setLang] = useState('en');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timeSlot, setTimeSlot] = useState(() => {
    const now = new Date();
    return Math.round((now.getHours() * 60 + now.getMinutes()) / 5);
  });
  const timeLabel = formatTimeSlot(timeSlot);
  const [allLines, setAllLines] = useState<LineConfig[]>([]);
  const [activeLineId, setActiveLineId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('line') || 'sheet-line';
  });
  const [lineConfig, setLineConfig] = useState<LineConfig | null>(null);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [lineResources, setLineResources] = useState<Resource[]>([]);
  const [stateMap, setStateMap] = useState<Map<string, ResourceStateEntry>>(new Map());
  const modelsDataRef = useRef<ModelsData | null>(null);
  const lineResRef = useRef<Resource[]>([]);
  const stateMapRef = useRef<Map<string, ResourceStateEntry>>(new Map());
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const dismissPopoverRef = useRef<(() => void) | null>(null);

  // Fetch data
  useEffect(() => {
    Promise.all([
      fetch('/data/models.json').then(r => r.json()),
      fetch('/data/resource.json').then(r => r.json()),
      fetch('/data/resource_states.json').then(r => r.json()),
    ])
      .then(([modelsData, resData, statesData]) => {
        modelsDataRef.current = modelsData;
        setAllLines(modelsData.lines);
        const map = buildStateMap(statesData);
        setStateMap(map);
        stateMapRef.current = map;
        const line = modelsData.lines.find((l: LineConfig) => l.id === activeLineId);
        if (line) setLineConfig(line);
        setAllResources(resData.resources);
        const filtered = resData.resources.filter((r: Resource) => r.line === activeLineId);
        setLineResources(filtered);
        lineResRef.current = filtered;
        document.title = `Planning — ${line?.name || ''}`;
      });
  }, [activeLineId]);

  const resourceData: JSONRecord[] = lineResources.map(r => {
    const stateEntry = stateMap.get(r.state);
    const color = stateEntry?.color || '#888888';
    return {
      layout_name: r.layout_name,
      color,
      ...(r.ink_expiration ? { ink_expiration: true, inks: r.inks } : {}),
    };
  });

  const handleSaveCamera = useCallback((state: CameraState) => {
    const models = modelsDataRef.current;
    if (!models) return;
    const line = models.lines.find(l => l.id === activeLineId);
    if (!line) return;
    line.camera = state;
    setLineConfig(prev => prev ? { ...prev, camera: state } : prev);
    fetch('/data/models.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(models, null, 2),
    }).catch(err => console.error('Failed to save camera:', err));
  }, [activeLineId]);

  const switchLine = useCallback((id: string) => {
    if (id === activeLineId) return;
    setActiveLineId(id);
    const line = modelsDataRef.current?.lines.find(l => l.id === id);
    if (line) {
      setLineConfig(line);
      document.title = `Planning — ${line.name}`;
      const filtered = allResources.filter(r => r.line === id);
      setLineResources(filtered);
      lineResRef.current = filtered;
    }
  }, [activeLineId, allResources]);

  // When an object is clicked, set resource as query param
  const handleObjectClick = useCallback((data: Record<string, unknown> | null) => {
    if (!data) {
      // Clicked empty space — clear resource query param and close sidebar
      navigateRef.current({
        queryParams: [{ key: 'resource', val: '' }],
        partialPath: '(sidebar:)',
      });
      return;
    }
    const nodeName = data.name as string;
    const key = nodeName?.includes('_') ? nodeName.split('_').slice(1).join('_') : nodeName;
    const res = lineResRef.current.find(r => r.layout_name === key);
    if (!res) return;
    // Set resource in query param (sidebar not opened yet — user picks from menu)
    navigateRef.current({
      queryParams: [{ key: 'resource', val: res.layout_name }],
    });
  }, []);

  // renderPopover: shows the context menu at the clicked resource
  const renderPopover = useCallback((data: Record<string, unknown>) => {
    const nodeName = data.name as string;
    const key = nodeName?.includes('_') ? nodeName.split('_').slice(1).join('_') : nodeName;
    const res = lineResRef.current.find(r => r.layout_name === key);
    if (!res) return null;

    const isEquipment = res.type !== 'stock' && res.type !== 'queue';
    const expiringInks = getExpiringInks(res);

    const openMenuItem = (item: string) => {
      navigateRef.current({
        queryParams: [{ key: 'resource', val: res.layout_name }],
        partialPath: `(sidebar:${item})`,
      });
      dismissPopoverRef.current?.();
    };

    return (
      <div className="planning-menu-inner">
        <button className="planning-menu-item" onPointerDown={e => { e.stopPropagation(); openMenuItem('machine'); }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" /><path d="M10 3V4M10 16V17M3 10H4M16 10H17M5.05 5.05L5.76 5.76M14.24 14.24L14.95 14.95M14.95 5.05L14.24 5.76M5.76 14.24L5.05 14.95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          <span className="planning-menu-label">{res.name}</span>
        </button>
        {isEquipment && (
          <button className="planning-menu-item" onPointerDown={e => { e.stopPropagation(); openMenuItem('oee'); }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M18 13V17C18 17.5523 17.5523 18 17 18H3C2.44772 18 2 17.5523 2 17V3C2 2.44772 2.44772 2 3 2H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 2H18V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 10L18 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            <span className="planning-menu-label">OEE</span>
          </button>
        )}
        {expiringInks.length > 0 && (
          <button className="planning-menu-item" onPointerDown={e => { e.stopPropagation(); openMenuItem('inks'); }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#d92d20" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8.57 2.79L1.32 15a1.67 1.67 0 001.42 2.5h14.52a1.67 1.67 0 001.42-2.5L11.43 2.79a1.67 1.67 0 00-2.86 0z" />
              <line x1="10" y1="7.5" x2="10" y2="11" /><line x1="10" y1="14" x2="10.01" y2="14" />
            </svg>
            <span className="planning-menu-label">Inks expiring</span>
          </button>
        )}
        <button className="planning-menu-item" onPointerDown={e => { e.stopPropagation(); openMenuItem('productie'); }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 4H18M2 4V16C2 16.5523 2.44772 17 3 17H17C17.5523 17 18 16.5523 18 16V4M2 4L4 2H16L18 4M7 8H13M7 11H13M7 14H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span className="planning-menu-label">Productie overzicht</span>
        </button>
      </div>
    );
  }, []);

  const offTrackCount = lineResources.filter(r => {
    const s = r.state;
    return s === 'breakdown' || s === 'starved' || s === 'starved.operator' || s === 'blocked';
  }).length;

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
    <AuxRouteProvider>
      <div className="planning-page">
        <div className="planning-main">
        <header className="planning-header">
          <div className="planning-header-left">
            <input
              type="date"
              className="planning-date-picker"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
            <div className="planning-time-slider">
              <span className="planning-time-label">{timeLabel}</span>
              <input
                type="range"
                className="planning-time-range"
                min={0}
                max={287}
                value={timeSlot}
                onChange={e => setTimeSlot(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="planning-header-actions">
            <select
              className="planning-select"
              value={lang}
              onChange={e => setLang(e.target.value)}
            >
              <option value="en">EN</option>
              <option value="nl">NL</option>
              <option value="uk">UK</option>
            </select>
            <button
              className="planning-icon-btn"
              title={dark ? 'Light mode' : 'Dark mode'}
              onClick={() => { setDark(d => { document.body.classList.toggle('dark', !d); return !d; }); }}
            >
              {dark ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M10 2V4M10 16V18M2 10H4M16 10H18M4.93 4.93L6.34 6.34M13.66 13.66L15.07 15.07M15.07 4.93L13.66 6.34M6.34 13.66L4.93 15.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M17.39 11.39A7.5 7.5 0 118.61 2.61 5.5 5.5 0 0017.39 11.39z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </button>
          </div>
        </header>

        <div className="planning-content">
          <div className="planning-viewer">
            <ThreeModelView
              key={lineConfig.id}
              url={lineConfig.glb}
              className="scene"
              data={resourceData}
              colorKey="color"
              renderPopover={renderPopover}
              initialCamera={lineConfig.camera}
              onSaveCamera={handleSaveCamera}
              onObjectClick={handleObjectClick}
              popoverRef={dismissPopoverRef}
            />
          </div>
        </div>

        <div className="planning-bottom">
          <div className="planning-bottom-inner">
            <div className="planning-off-track">
              Off track
              <span className="planning-badge">{offTrackCount}</span>
            </div>
            <div className="planning-thumbs">
              {allLines.map(line => (
                <button
                  key={line.id}
                  className={`planning-thumb${line.id === activeLineId ? ' active' : ''}`}
                  onClick={() => switchLine(line.id)}
                >
                  <span className="planning-thumb-name">{line.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        </div>{/* .planning-main */}

        <PlanningResourceSidebarPanel resources={lineResources} stateMap={stateMap} />
      </div>
    </AuxRouteProvider>
  );
}
