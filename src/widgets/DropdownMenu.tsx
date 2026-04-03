import { useCallback, useEffect, useRef, useState } from 'react';

type DropdownMenuProps = {
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  fullWidth?: boolean;
  children: React.ReactNode;
};

export function DropdownMenu({ label, open, onToggle, onClose, fullWidth = true, children }: DropdownMenuProps) {
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

  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const triggerRect = trigger.getBoundingClientRect();
    if (fullWidth) {
      const main = trigger.closest('.planning-main');
      if (!main) return;
      const mainRect = main.getBoundingClientRect();
      const inset = 8;
      setPanelStyle({
        position: 'fixed',
        top: triggerRect.bottom + 4,
        left: mainRect.left + inset,
        width: mainRect.width - inset * 2,
      });
    } else {
      const main = trigger.closest('.planning-main');
      const mainRight = main ? main.getBoundingClientRect().right : window.innerWidth;
      const mainLeft = main ? main.getBoundingClientRect().left : 0;
      // If trigger is in the right half of the container, align panel's right edge to trigger's right edge
      const triggerCenter = (triggerRect.left + triggerRect.right) / 2;
      const containerCenter = (mainLeft + mainRight) / 2;
      if (triggerCenter > containerCenter) {
        setPanelStyle({
          position: 'fixed',
          top: triggerRect.bottom + 4,
          right: window.innerWidth - triggerRect.right,
        });
      } else {
        setPanelStyle({
          position: 'fixed',
          top: triggerRect.bottom + 4,
          left: triggerRect.left,
        });
      }
    }
  }, [fullWidth]);

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
