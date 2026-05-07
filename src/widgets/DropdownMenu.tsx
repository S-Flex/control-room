import { useEffect, useId, useRef } from 'react';

type DropdownMenuProps = {
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  fullWidth?: boolean;
  /** `'select'` (default) renders the bordered select-box trigger.
   *  `'inline'` renders the trigger as plain text + chevron — used for
   *  menu-bar / breadcrumb pickers in the app header. */
  variant?: 'select' | 'inline';
  children: React.ReactNode;
};

export function DropdownMenu({ label, open, onToggle, onClose, fullWidth = true, variant = 'select', children }: DropdownMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const anchorName = `--dropdown-${useId().replace(/:/g, '')}`;

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

  const panelClass = `dropdown-menu-panel${fullWidth ? ' dropdown-menu-panel-full' : ''}`;

  const triggerClass = variant === 'inline'
    ? `dropdown-menu-trigger dropdown-menu-trigger-inline${open ? ' open' : ''}`
    : `planning-select dropdown-menu-trigger${open ? ' open' : ''}`;

  return (
    <div className="dropdown-menu-wrapper">
      <button
        ref={triggerRef}
        className={triggerClass}
        style={{ anchorName } as React.CSSProperties}
        onClick={onToggle}
      >
        <span className="dropdown-menu-label">{label}</span>
        <svg className="dropdown-menu-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          ref={panelRef}
          className={panelClass}
          style={{ positionAnchor: anchorName } as React.CSSProperties}
        >
          {children}
        </div>
      )}
    </div>
  );
}
