import { useCallback, useRef, useState } from 'react';
import { Ink } from './widgets/Ink';
import { SectionRenderer } from './widgets/SectionRenderer';
import { usePage } from './hooks/usePages';

export function SidebarPanel({ code, title, onClose }: {
  code: string;
  title: string;
  onClose: () => void;
}) {
  const { config, content, isLoading } = usePage(code);
  const [width, setWidth] = useState(20); // percentage
  const dragging = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

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

  // Build a root section from the PageConfig
  const rootSection = config ? {
    class_name: config.class_name,
    grid: config.grid,
    cols: config.cols,
    sections: config.sections,
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
