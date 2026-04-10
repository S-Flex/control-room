import { useCallback, useEffect, useRef, useState } from 'react';

type CarouselSpec = {
  width: number;
  height: number;
  supply_unit_amount: number;
};

type CarouselProps = {
  items: string[];
  currentIndex: number;
  getLabel: (code: string) => string;
  getSpecs?: (code: string) => CarouselSpec[];
  getInfo?: (code: string) => { cutoff?: string; rushHours?: number } | null;
  onSelect: (code: string) => void;
  children?: React.ReactNode;
};

export function Carousel({ items, currentIndex, getLabel, getSpecs, getInfo, onSelect, children }: CarouselProps) {
  const len = items.length;
  if (len === 0) return null;

  const prev = items[(currentIndex - 1 + len) % len];
  const curr = items[currentIndex];
  const next = items[(currentIndex + 1) % len];

  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const goPrev = useCallback(() => { setSlideDir('right'); onSelect(prev); }, [onSelect, prev]);
  const goNext = useCallback(() => { setSlideDir('left'); onSelect(next); }, [onSelect, next]);

  useEffect(() => {
    if (!slideDir) return;
    const cls = slideDir === 'left' ? 'slide-left' : 'slide-right';
    for (const el of [centerRef.current, bodyRef.current]) {
      if (!el) continue;
      el.classList.remove('slide-left', 'slide-right');
      void el.offsetWidth;
      el.classList.add(cls);
      el.addEventListener('animationend', () => el.classList.remove('slide-left', 'slide-right'), { once: true });
    }
    setSlideDir(null);
  }, [curr]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [goPrev, goNext]);

  return (
    <div className="carousel">
      <div className="carousel-header">
        <button className="carousel-nav carousel-nav-prev" onClick={goPrev}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="carousel-nav-label">{getLabel(prev)}</span>
        </button>
        <div className="carousel-center" ref={centerRef}>
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
      {children && <div className="carousel-body" ref={bodyRef}>{children}</div>}
    </div>
  );
}
