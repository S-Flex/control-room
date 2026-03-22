import { useCallback, useEffect, useRef, useState } from 'react';
import { ThreeModelView, type CameraState, type JSONRecord, type ObjectData } from 'xfw-three';
import { EquipCard } from './viewer/EquipCard';
import type { Resource } from './viewer/types';
import { WidgetPanel } from './widgets/WidgetPanel';
import { StatusBar } from './widgets/StatusBar';
import { Ticker } from './widgets/Ticker';
import { DashboardHeader } from './widgets/DashboardHeader';
import type { DashboardData } from './widgets/types';
import './app.css';

type LineConfig = {
  id: string;
  name: string;
  glb: string;
  camera?: CameraState;
};

type ModelsData = {
  lines: LineConfig[];
};

type ResourceStateEntry = {
  code: string;
  color: string;
  block: {
    title: string;
    i18n?: Record<string, { title: string }>;
  };
};
type ResourceStatesData = {
  content: ResourceStateEntry[];
  states: { code: string }[];
};

function buildStateMap(data: ResourceStatesData): Map<string, ResourceStateEntry> {
  const map = new Map<string, ResourceStateEntry>();
  for (const entry of data.content) map.set(entry.code, entry);
  return map;
}

export function App() {
  const [dark, setDark] = useState(() => document.body.classList.contains('dark'));
  const [allLines, setAllLines] = useState<LineConfig[]>([]);
  const [stateMap, setStateMap] = useState<Map<string, ResourceStateEntry>>(new Map());
  const [activeLineId, setActiveLineId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('line') || 'sheet-line';
  });
  const [lineConfig, setLineConfig] = useState<LineConfig | null>(null);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [lineResources, setLineResources] = useState<Resource[]>([]);
  const [displayDuration, setDisplayDuration] = useState(5000);
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeMatchKey, setActiveMatchKey] = useState<number | string | null>(null);
  const [cyclePaused, setCyclePaused] = useState(false);
  const cycleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineResRef = useRef<Resource[]>([]);
  const currentIdx = useRef(-1);
  const modelsDataRef = useRef<ModelsData | null>(null);

  // Toggle dark mode on double-click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.scene')) return;
      setDark(d => {
        document.body.classList.toggle('dark', !d);
        return !d;
      });
    };
    document.addEventListener('dblclick', handler);
    return () => document.removeEventListener('dblclick', handler);
  }, []);

  // Fetch all data
  useEffect(() => {
    Promise.all([
      fetch('/data/models.json').then(r => r.json()),
      fetch('/data/resource.json').then(r => r.json()),
      fetch('/data/inflow.json').then(r => r.json()),
      fetch('/data/queues.json').then(r => r.json()),
      fetch('/data/ticker.json').then(r => r.json()),
      fetch('/data/resource_states.json').then(r => r.json()),
    ])
      .then(([modelsData, resData, inflow, queues, ticker, statesData]) => {
        modelsDataRef.current = modelsData;
        setStateMap(buildStateMap(statesData));
        setAllLines(modelsData.lines);
        const line = modelsData.lines.find((l: LineConfig) => l.id === activeLineId);
        if (!line) { setError(`Line "${activeLineId}" not found`); return; }
        setLineConfig(line);
        setAllResources(resData.resources);
        const filtered = resData.resources.filter((r: Resource) => r.line === activeLineId);
        setLineResources(filtered);
        lineResRef.current = filtered;
        setDisplayDuration((resData.displayDuration || 5) * 1000);
        setDashData({ inflow, queues, ticker });
        document.title = `Control Room — ${line.name}`;
      })
      .catch(err => setError(err.message));
  }, [activeLineId]);

  // Cycle resources
  const cycleNext = useCallback(() => {
    const res = lineResRef.current;
    if (res.length === 0) return;
    currentIdx.current = (currentIdx.current + 1) % res.length;
    const r = res[currentIdx.current];
    setActiveMatchKey(r.layout_name);
  }, []);

  useEffect(() => {
    if (lineResources.length === 0 || cyclePaused) return;
    cycleNext();
    cycleTimer.current = setInterval(cycleNext, displayDuration);
    return () => { if (cycleTimer.current) clearInterval(cycleTimer.current); };
  }, [lineResources, cycleNext, displayDuration, cyclePaused]);

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
    })
      .then(() => console.log('Camera saved:', state))
      .catch(err => console.error('Failed to save camera:', err));
  }, [activeLineId]);

  const switchLine = useCallback((id: string) => {
    if (id === activeLineId) return;
    setActiveLineId(id);
    setActiveMatchKey(null);
    setCyclePaused(false);
    currentIdx.current = -1;
    const line = modelsDataRef.current?.lines.find(l => l.id === id);
    if (line) {
      setLineConfig(line);
      document.title = `Control Room — ${line.name}`;
      const filtered = allResources.filter(r => r.line === id);
      setLineResources(filtered);
      lineResRef.current = filtered;
    }
  }, [activeLineId, allResources]);

  const handleObjectClick = useCallback((data: ObjectData | null) => {
    if (data) {
      const nodeName = data.name as string;
      const key = nodeName?.includes('_') ? nodeName.split('_').slice(1).join('_') : nodeName;
      if (cyclePaused && key === activeMatchKey) {
        setCyclePaused(false);
        return;
      }
      setCyclePaused(true);
      if (cycleTimer.current) { clearInterval(cycleTimer.current); cycleTimer.current = null; }
    } else {
      setCyclePaused(false);
    }
  }, [cyclePaused, activeMatchKey]);

  const renderPopover = useCallback((data: ObjectData) => {
    const nodeName = data.name as string;
    const key = nodeName?.includes('_') ? nodeName.split('_').slice(1).join('_') : nodeName;
    const res = lineResRef.current.find(r => r.layout_name === key);
    if (!res) return null;
    return <EquipCard eq={res} />;
  }, []);

  if (error) {
    return <div className="control-room"><div className="error-msg">{error}</div></div>;
  }

  if (!lineConfig || !dashData) {
    return (
      <div className="control-room">
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-text">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="control-room">
      <DashboardHeader className="outer-only" />
      <div className="main-area">
        <WidgetPanel side="left" data={dashData} />
        <div className="sheet-column">
          <DashboardHeader className="inner-only" />
          <div className="sheet-view">
            <ThreeModelView
              key={lineConfig.id}
              url={lineConfig.glb}
              className="scene"
              data={resourceData}
              colorKey="color"
              activeResourceId={activeMatchKey}
              renderPopover={renderPopover}
              initialCamera={lineConfig.camera}
              onSaveCamera={handleSaveCamera}
              onObjectClick={handleObjectClick}
            />
            {allLines.length > 1 && (
              <div className="model-thumbs">
                {allLines.map(line => (
                  <button
                    key={line.id}
                    className={`model-thumb${line.id === activeLineId ? ' active' : ''}`}
                    onClick={() => switchLine(line.id)}
                    title={line.name}
                  >
                    <span className="model-thumb-label">{line.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <StatusBar />
          <div className="ticker-bar inner-only">
            <Ticker type="highlight" data={dashData.ticker} />
            <Ticker type="alert" data={dashData.ticker} />
          </div>
        </div>
        <WidgetPanel side="right" data={dashData} />
      </div>
      <div className="ticker-bar outer-only">
        <Ticker type="highlight" data={dashData.ticker} />
        <Ticker type="alert" data={dashData.ticker} />
      </div>
    </div>
  );
}
