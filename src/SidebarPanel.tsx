import { Ink } from './widgets/Ink';
import { SectionRenderer } from './widgets/SectionRenderer';
import { usePage } from './hooks/usePages';

export function SidebarPanel({ code }: {
  code: string;
}) {
  const { config, content, isLoading } = usePage(code);

  // Build a root section from the PageConfig
  const rootSection = config?.main ? {
    class_name: config.class_name ?? config.main.class_name,
    grid: config.main.grid,
    cols: config.main.cols,
    sections: config.main.sections,
  } : undefined;

  return (
    <>
      {/* <div className="sidebar-body">
        <div className="sidebar-header sidebar-header-content">
          <button className="sidebar-close" onClick={onClose} title="Close">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div> */}
      {isLoading && <p className="datagroup-loading">Loading...</p>}
      {code === 'ink-heads' ? (
        <Ink />
      ) : (
        rootSection && <SectionRenderer section={rootSection} content={content} />
      )}
      {/* </div> */}
    </>
  );
}
