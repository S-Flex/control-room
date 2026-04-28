import { useCallback, useEffect, useRef, useState } from 'react';
import { Ink } from './widgets/Ink';
import { SectionRenderer } from './widgets/SectionRenderer';
import { usePage } from './hooks/usePages';

type DragListeners = {
  move: (ev: PointerEvent) => void;
  up: (ev: PointerEvent) => void;
};

export function SidebarPanel({ code, title, onClose }: {
  code: string;
  title: string;
  onClose: () => void;
}) {
  const { config, content, isLoading } = usePage(code);
  const [width, setWidth] = useState(22); // percentage
  const dragging = useRef(false);
  const listenersRef = useRef<DragListeners | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Tear down any in-flight drag listeners on unmount so they don't fire on
  // a dead component (e.g. when the sidebar closes mid-drag).
  useEffect(() => () => {
    if (listenersRef.current) {
      window.removeEventListener('pointermove', listenersRef.current.move);
      window.removeEventListener('pointerup', listenersRef.current.up);
      listenersRef.current = null;
    }
  }, []);

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
      listenersRef.current = null;
    };
    listenersRef.current = { move: onMove, up: onUp };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [width]);

  // Build a root section from the PageConfig
  const rootSection = config?.main ? {
    class_name: config.class_name ?? config.main.class_name,
    grid: config.main.grid,
    cols: config.main.cols,
    sections: config.main.sections,
  } : undefined;

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
        {isLoading && <p className="datagroup-loading">Loading...</p>}
        {code === 'ink-heads' ? (
          <Ink />
        ) : (
          rootSection && <SectionRenderer section={rootSection} content={content} />
        )}
      </div>
    </div>
  );
}
