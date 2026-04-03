import { useCallback, useEffect, useRef, useState } from 'react';

type DropdownMenuProps = {
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
};

export function DropdownMenu({ label, open, onToggle, onClose, children }: DropdownMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handle);
    return () => document.removeEventListener('pointerdown', handle);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open, onClose]);

  // Position panel full-width relative to .planning-main
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const main = trigger.closest('.planning-main');
    if (!main) return;
    const mainRect = main.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const inset = 8; // 0.5rem margin on each side
    setPanelStyle({
      position: 'fixed',
      top: triggerRect.bottom + 4,
      left: mainRect.left + inset,
      width: mainRect.width - inset * 2,
    });
  }, []);

  useEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        className={`planning-select dropdown-menu-trigger${open ? ' open' : ''}`}
        onClick={onToggle}
      >
        <span className="dropdown-menu-label">{label}</span>
        <svg className="dropdown-menu-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div ref={panelRef} className="dropdown-menu-panel" style={panelStyle}>
          {children}
        </div>
      )}
    </>
  );
}
