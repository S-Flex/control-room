import { useCallback, useEffect } from 'react';

type MaterialCarouselProps = {
  items: string[];
  currentIndex: number;
  getLabel: (code: string) => string;
  onSelect: (code: string) => void;
};

export function MaterialCarousel({ items, currentIndex, getLabel, onSelect }: MaterialCarouselProps) {
  const len = items.length;
  if (len === 0) return null;

  const prev = items[(currentIndex - 1 + len) % len];
  const curr = items[currentIndex];
  const next = items[(currentIndex + 1) % len];

  const goPrev = useCallback(() => onSelect(prev), [onSelect, prev]);
  const goNext = useCallback(() => onSelect(next), [onSelect, next]);

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
      <div className="carousel-center">{getLabel(curr)}</div>
      <button className="carousel-nav carousel-nav-next" onClick={goNext}>
        <span className="carousel-nav-label">{getLabel(next)}</span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
