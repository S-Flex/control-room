import { useCallback, useEffect, useRef, useState } from 'react';
import { Ink } from './widgets/Ink';
import { DataGroupWidget, type DataGroupEntry } from './widgets/DataGroup';

type SidebarConfig = {
  code: string;
  data_groups: DataGroupEntry[];
};

export function SidebarPanel({ code, title, onClose }: {
  code: string;
  title: string;
  onClose: () => void;
}) {
  const [sidebarConfigs, setSidebarConfigs] = useState<SidebarConfig[]>([]);
  const [width, setWidth] = useState(20); // percentage
  const dragging = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/data/sidebar.json')
      .then(r => r.json())
      .then(data => setSidebarConfigs(data));
  }, []);

  const config = sidebarConfigs.find(s => s.code === code);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startX = e.clientX;
    const startWidth = width;
    const vw = window.innerWidth;

    const onMove = (ev: PointerEvent) => {
      if (!dragging.current) return;
      const delta = startX - ev.clientX;
      const newWidth = Math.min(50, Math.max(15, startWidth + (delta / vw) * 100));
      setWidth(newWidth);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [width]);

  return (
    <div className="sidebar" ref={sidebarRef} style={{ width: `${width}%` }}>
      <div className="sidebar-resize-handle" onPointerDown={handleResizeStart} />
      <div className="sidebar-header">
        <h3 className="sidebar-title">{title}</h3>
        <button className="sidebar-close" onClick={onClose} title="Close">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="sidebar-body">
        {!config && <p className="datagroup-loading">Loading...</p>}
        {code === 'ink-heads' ? (
          <Ink />
        ) : (
          config?.data_groups.map(entry => (
            <DataGroupWidget key={entry.code} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}
