import { useCallback, useEffect } from 'react';

type CarouselSpec = {
  width: number;
  height: number;
  supply_unit_amount: number;
};

export type CarouselInfo = { cutoff?: string; rushHours?: number };

type CarouselHeaderProps = {
  items: string[];
  currentIndex: number;
  getLabel: (code: string) => string;
  getSpecs?: (code: string) => CarouselSpec[];
  getInfo?: (code: string) => CarouselInfo | null;
  onSelect: (code: string) => void;
};

/** Prev / current / next navigation with optional info + specs row. Lives
 *  on its own so a host page can place it inside a header bar instead of
 *  forcing the body to render alongside. */
export function CarouselHeader({
  items,
  currentIndex,
  getLabel,
  getSpecs,
  getInfo,
  onSelect,
}: CarouselHeaderProps) {
  const len = items.length;
  const safeIndex = len > 0 ? ((currentIndex % len) + len) % len : 0;
  const prev = len > 0 ? items[(safeIndex - 1 + len) % len] : '';
  const curr = len > 0 ? items[safeIndex] : '';
  const next = len > 0 ? items[(safeIndex + 1) % len] : '';

  const goPrev = useCallback(() => { if (len > 0) onSelect(prev); }, [onSelect, prev, len]);
  const goNext = useCallback(() => { if (len > 0) onSelect(next); }, [onSelect, next, len]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [goPrev, goNext]);

  if (len === 0) return null;

  return (
    <div className="carousel-header">
      <button className="carousel-nav carousel-nav-prev" onClick={goPrev}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="carousel-nav-label">{getLabel(prev)}</span>
      </button>
      <div className="carousel-center">
        <span className="carousel-title">
          {getLabel(curr)}
          {getInfo && (() => {
            const info = getInfo(curr);
            if (!info) return null;
            return <>
              {info.cutoff && <span className="carousel-info"> · {info.cutoff}</span>}
              {info.rushHours != null && <span className="schedule-rush-badge" style={{ marginLeft: 6 }}>{info.rushHours}</span>}
            </>;
          })()}
        </span>
        {getSpecs && (() => {
          const specs = getSpecs(curr);
          if (!specs.length) return null;
          return <span className="carousel-specs">
            {specs.map((s, i) => (
              <span key={i}>{i > 0 && ' | '}{s.supply_unit_amount}× {s.width}×{s.height} cm</span>
            ))}
          </span>;
        })()}
      </div>
      <button className="carousel-nav carousel-nav-next" onClick={goNext}>
        <span className="carousel-nav-label">{getLabel(next)}</span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

/** Body wrapper that just hosts the active item's content. Pair with
 *  <CarouselHeader> when navigation should sit elsewhere (e.g. in the
 *  page-header bar). */
export function Carousel({ children }: { children?: React.ReactNode }) {
  return <div className="carousel-body">{children}</div>;
}
