import { useCallback, useEffect, useRef, useState } from 'react';
import { getBlock } from 'xfw-get-block';
import type { UiLabel } from '../types';

function formatTimeSlot(slot: number): string {
  const totalMinutes = slot * 5;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildIsoFromSlot(date: string, slot: number): string {
  const totalMinutes = slot * 5;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).toISOString();
}

type TimeSliderProps = {
  uiLabels: UiLabel[];
  onChange: (currentTime: string) => void;
};

const SLIDER_MIN = 72;  // 06:00
const SLIDER_MAX = 288; // 24:00

export function TimeSlider({ uiLabels, onChange }: TimeSliderProps) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState(() => {
    const now = new Date();
    return Math.round((now.getHours() * 60 + now.getMinutes()) / 5);
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef(false);

  // Emit initial value on mount
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      onChange(buildIsoFromSlot(date, slot));
    }
  }, []);

  const handleSlotChange = useCallback((newSlot: number) => {
    setSlot(newSlot);
    autoRefreshRef.current = false;
    setAutoRefresh(false);
  }, []);

  const handleRefresh = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    let s = slot;
    if (date === today) {
      const now = new Date();
      const nowSlot = Math.round((now.getHours() * 60 + now.getMinutes()) / 5);
      if (s > nowSlot) {
        s = nowSlot;
        setSlot(s);
      }
    }
    onChange(buildIsoFromSlot(date, s));
  }, [date, slot, onChange]);

  const handleNow = useCallback(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const s = Math.round((now.getHours() * 60 + now.getMinutes()) / 5);
    setDate(today);
    setSlot(s);
    onChange(buildIsoFromSlot(today, s));
    autoRefreshRef.current = true;
    setAutoRefresh(true);
  }, [onChange]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (!autoRefreshRef.current) return;
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const s = Math.round((now.getHours() * 60 + now.getMinutes()) / 5);
      setDate(today);
      setSlot(s);
      onChange(buildIsoFromSlot(today, s));
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, onChange]);

  const timeLabel = formatTimeSlot(slot);

  return (
    <div className="planning-time-slider">
      <span className="planning-time-label">{formatTimeSlot(SLIDER_MIN)}</span>
      <input
        type="range"
        className="planning-time-range"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        value={Math.min(slot, SLIDER_MAX)}
        onChange={e => handleSlotChange(Number(e.target.value))}
      />
      <span className="planning-time-label">{formatTimeSlot(SLIDER_MAX)}</span>
      <span className="planning-time-current">{timeLabel}</span>
      <button className="planning-icon-btn planning-slider-btn" title="Refresh" onClick={handleRefresh}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M17 10a7 7 0 01-12.9 3.8M3 10a7 7 0 0112.9-3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M17 4v4h-4M3 16v-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button className={`planning-icon-btn planning-slider-btn${autoRefresh ? ' active' : ''}`} title={getBlock(uiLabels, 'now', 'title')} onClick={handleNow}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
