import { useCallback, useEffect, useRef, useState } from 'react';

type MaterialSpec = {
  width: number;
  height: number;
  supply_unit_amount: number;
};

type MaterialCarouselProps = {
  items: string[];
  currentIndex: number;
  getLabel: (code: string) => string;
  getSpecs?: (code: string) => MaterialSpec[];
  onSelect: (code: string) => void;
};

export function MaterialCarousel({ items, currentIndex, getLabel, getSpecs, onSelect }: MaterialCarouselProps) {
  const len = items.length;
  if (len === 0) return null;

  const prev = items[(currentIndex - 1 + len) % len];
  const curr = items[currentIndex];
  const next = items[(currentIndex + 1) % len];

  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const centerRef = useRef<HTMLDivElement>(null);

  const goPrev = useCallback(() => { setSlideDir('right'); onSelect(prev); }, [onSelect, prev]);
  const goNext = useCallback(() => { setSlideDir('left'); onSelect(next); }, [onSelect, next]);

  useEffect(() => {
    if (!slideDir || !centerRef.current) return;
    const el = centerRef.current;
    el.classList.remove('slide-left', 'slide-right');
    // Force reflow to restart animation
    void el.offsetWidth;
    el.classList.add(slideDir === 'left' ? 'slide-left' : 'slide-right');
    const onEnd = () => el.classList.remove('slide-left', 'slide-right');
    el.addEventListener('animationend', onEnd, { once: true });
    setSlideDir(null);
  }, [curr]);

  // Keyboard navigation
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [goPrev, goNext]);

  return (
    <div className="carousel-header">
      <button className="carousel-nav carousel-nav-prev" onClick={goPrev}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="carousel-nav-label">{getLabel(prev)}</span>
      </button>
      <div className="carousel-center" ref={centerRef}>
        <span className="carousel-title">{getLabel(curr)}</span>
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
