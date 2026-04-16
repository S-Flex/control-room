import { useCallback, useEffect, useRef, useState } from 'react';
import { ThreeModelView, type CameraState, type JSONRecord, type ObjectData } from 'xfw-three';
import { useQueryParams } from '@s-flex/xfw-url';
import { getBlock, setLanguage, getLanguage, languages } from 'xfw-get-block';
import { EquipCard } from './viewer/EquipCard';
import type { Resource } from './viewer/types';
import { useProductionLineOverview } from './hooks/useProductionLineOverview';
import { WidgetPanel } from './widgets/WidgetPanel';
import { StatusBar } from './widgets/StatusBar';
import { Ticker } from './widgets/Ticker';
import { DashboardHeader } from './widgets/DashboardHeader';
import type { DashboardData } from './widgets/types';

type LineConfig = {
  code: string;
  glb: string;
  block: Record<string, unknown>;
  camera?: CameraState;
};

type ModelsData = LineConfig[];

type ResourceStateEntry = {
  code: string;
  color: string;
  block: {
    title: string;
    i18n?: Record<string, { title: string; }>;
  };
};
type StateSetData = {
  code: string;
  color: string;
  block: { title: string; i18n?: Record<string, { title: string; }>; };
  states: ResourceStateEntry[];
};

function buildStateMap(stateSets: StateSetData[]): Map<string, ResourceStateEntry> {
  const map = new Map<string, ResourceStateEntry>();
  for (const ss of stateSets) {
    map.set('set.' + ss.code, { code: 'set.' + ss.code, color: ss.color, block: ss.block });
    for (const st of ss.states) map.set(st.code, st);
  }
  return map;
}

export function ControlRoomPage() {
  const [dark, setDark] = useState(() => document.body.classList.contains('dark'));
  const [lang, setLang] = useState(() => getLanguage());
  const urlParams = useQueryParams([{ key: 'model', is_query_param: true }]);
  const urlModel = urlParams.find(p => p.key === 'model')?.val as string | undefined;
  const [allLines, setAllLines] = useState<LineConfig[]>([]);
  const { rowMap: overviewMap } = useProductionLineOverview();
  const [stateMap, setStateMap] = useState<Map<string, ResourceStateEntry>>(new Map());
  const [activeLineId, setActiveLineId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('model') || 'sheet';
  });
  const [lineConfig, setLineConfig] = useState<LineConfig | null>(null);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [lineResources, setLineResources] = useState<Resource[]>([]);
  const [displayDuration, setDisplayDuration] = useState(5000);
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeMatchKey, setActiveMatchKey] = useState<string | null>(null);
  const [cyclePaused, setCyclePaused] = useState(false);
  const cycleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineResRef = useRef<Resource[]>([]);
  const currentIdx = useRef(-1);
  const modelsDataRef = useRef<ModelsData | null>(null);

  // Sync model, from, and until to URL so useDataGeneric can read them
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('model', activeLineId);
    if (!params.has('until')) {
      params.set('until', new Date().toISOString());
    }
    if (!params.has('from')) {
      const today = new Date().toISOString().slice(0, 10);
      params.set('from', new Date(`${today}T06:00:00`).toISOString());
    }
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [activeLineId]);

  // React to model query param changes
  useEffect(() => {
    if (urlModel && urlModel !== activeLineId) {
      setActiveLineId(urlModel);
    }
  }, [urlModel]);

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

  // Fetch static data (models, resource list, dashboard feeds, state definitions)
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
        setStateMap(buildStateMap(statesData as StateSetData[]));
        setAllLines(modelsData);
        const line = modelsData.find((l: LineConfig) => l.code === activeLineId);
        if (!line) { setError(`Line "${activeLineId}" not found`); return; }
        setLineConfig(line);
        setAllResources(resData.resources);
        const filtered = resData.resources.filter((r: Resource) => r.line === activeLineId);
        setLineResources(filtered);
        lineResRef.current = filtered;
        setDisplayDuration((resData.displayDuration || 5) * 1000);
        setDashData({ inflow, queues, ticker });
        document.title = `Control Room — ${getBlock(modelsData, line.code, 'title')}`;
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
    const overview = overviewMap.get(r.layout_name);
    const color = overview?.state.color ?? '#888888';
    return {
      layout_name: r.layout_name,
      color,
      ...(r.ink_expiration ? { ink_expiration: true, inks: r.inks } : {}),
    };
  });

  const handleSaveCamera = useCallback((state: CameraState) => {
    const models = modelsDataRef.current;
    if (!models) return;
    const line = models.find(l => l.code === activeLineId);
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
    const params = new URLSearchParams(window.location.search);
    params.set('model', id);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    setActiveMatchKey(null);
    setCyclePaused(false);
    currentIdx.current = -1;
    const models = modelsDataRef.current;
    const line = models?.find(l => l.code === id);
    if (line) {
      setLineConfig(line);
      document.title = `Control Room — ${getBlock(models!, line.code, 'title')}`;
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
              key={lineConfig.code}
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
                    key={line.code}
                    className={`model-thumb${line.code === activeLineId ? ' active' : ''}`}
                    onClick={() => switchLine(line.code)}
                    title={getBlock(allLines, line.code, 'title')}
                  >
                    <span className="model-thumb-label">{getBlock(allLines, line.code, 'title')}</span>
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
