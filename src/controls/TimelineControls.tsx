import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryParams } from '@s-flex/xfw-url';
import { getBlock } from 'xfw-get-block';
import { syncQueryParams } from '../lib/urlSync';
import type { UiLabel } from '../types';

/** ISO-8601 with the local timezone offset (e.g. "2026-04-16T06:00:00+02:00"),
 *  so the wall-clock hour the user picked is preserved through the URL. */
function toLocalIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    + `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Parse an `until` ISO string back to {date, slot} for the slider UI.
 *  A time of exactly 00:00 is treated as end-of-previous-day (slot 288) so the
 *  slider-max round-trip keeps the user on the day they picked. */
function parseUntil(iso: string): { date: string; slot: number; } {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) {
    const prev = new Date(d.getTime() - 60_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      date: `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`,
      slot: 288,
    };
  }
  return { date: iso.slice(0, 10), slot: Math.round((h * 60 + m) / 5) };
}

function formatTimeSlot(slot: number): string {
  const totalMinutes = slot * 5;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const SLIDER_MIN = 72;   // 06:00
const SLIDER_MAX = 288;  // 24:00

function buildFromIso(date: string): string {
  return toLocalIso(new Date(`${date}T06:00:00`));
}

function buildUntilFromSlot(date: string, slot: number): string {
  const totalMinutes = slot * 5;
  const base = new Date(`${date}T00:00:00`);
  base.setMinutes(base.getMinutes() + totalMinutes);
  return toLocalIso(base);
}

export { parseUntil, toLocalIso, formatTimeSlot, buildFromIso, buildUntilFromSlot };

export function TimelineControls({ uiLabels }: { uiLabels: UiLabel[] }) {
  const urlParams = useQueryParams([
    { key: 'from', is_query_param: true },
    { key: 'until', is_query_param: true },
  ]);
  const urlFrom = urlParams.find(p => p.key === 'from')?.val as string | undefined;
  const urlUntil = urlParams.find(p => p.key === 'until')?.val as string | undefined;

  const initialFromDate = (urlFrom ?? buildFromIso(new Date().toISOString().slice(0, 10))).slice(0, 10);
  const initialUntilParsed = parseUntil(urlUntil ?? new Date().toISOString());

  const [pendingFromDate, setPendingFromDate] = useState(initialFromDate);
  const [pendingDate, setPendingDate] = useState(initialUntilParsed.date);
  const [pendingSlot, setPendingSlot] = useState(initialUntilParsed.slot);
  const [looping, setLooping] = useState(false);
  const loopRef = useRef(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef(false);

  // If the URL has neither from nor until, seed it from defaults so backend
  // queries that read them get a sensible window on first load.
  useEffect(() => {
    const updates: Record<string, string | null> = {};
    if (!urlFrom) updates.from = buildFromIso(initialFromDate);
    if (!urlUntil) updates.until = buildUntilFromSlot(initialUntilParsed.date, initialUntilParsed.slot);
    if (Object.keys(updates).length > 0) syncQueryParams(updates);
  }, []);

  // React to external from/until changes (back/forward, sibling writers).
  useEffect(() => {
    if (urlFrom) setPendingFromDate(urlFrom.slice(0, 10));
  }, [urlFrom]);

  useEffect(() => {
    if (urlUntil) {
      const parsed = parseUntil(urlUntil);
      setPendingDate(parsed.date);
      setPendingSlot(parsed.slot);
    }
  }, [urlUntil]);

  const handleRefresh = useCallback(() => {
    let fromDate = pendingFromDate;
    if (fromDate > pendingDate) {
      fromDate = pendingDate;
      setPendingFromDate(pendingDate);
    }
    syncQueryParams({
      from: buildFromIso(fromDate),
      until: buildUntilFromSlot(pendingDate, pendingSlot),
    });
  }, [pendingFromDate, pendingDate, pendingSlot]);

  const handleNow = useCallback(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const slot = Math.round((now.getHours() * 60 + now.getMinutes()) / 5);
    setPendingFromDate(today);
    setPendingDate(today);
    setPendingSlot(slot);
    syncQueryParams({
      from: buildFromIso(today),
      until: buildUntilFromSlot(today, slot),
    });
    autoRefreshRef.current = true;
    setAutoRefresh(true);
  }, []);

  const handleDateChange = useCallback((date: string) => {
    setPendingDate(date);
    // Keep `from <= until`: if the user pushes the until-date below the
    // current from-date, snap from down to match so the range stays valid.
    setPendingFromDate(prev => (prev > date ? date : prev));
    autoRefreshRef.current = false;
    setAutoRefresh(false);
  }, []);

  const handleSlotChange = useCallback((slot: number) => {
    setPendingSlot(slot);
    autoRefreshRef.current = false;
    setAutoRefresh(false);
  }, []);

  const handleLoop = useCallback(() => {
    if (looping) {
      loopRef.current = false;
      setLooping(false);
      return;
    }
    loopRef.current = true;
    setLooping(true);
    let slot = SLIDER_MIN;
    setPendingSlot(slot);
    const date = pendingDate;

    const step = () => {
      if (!loopRef.current) return;
      slot += 1;
      if (slot > SLIDER_MAX) {
        loopRef.current = false;
        setLooping(false);
        return;
      }
      setPendingSlot(slot);
      syncQueryParams({ until: buildUntilFromSlot(date, slot) });
      setTimeout(step, 250);
    };
    step();
  }, [looping, pendingDate]);

  // Auto-refresh: every 60s, snap to current wall-clock and re-sync URL.
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (!autoRefreshRef.current) return;
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const slot = Math.round((now.getHours() * 60 + now.getMinutes()) / 5);
      setPendingFromDate(today);
      setPendingDate(today);
      setPendingSlot(slot);
      syncQueryParams({
        from: buildFromIso(today),
        until: buildUntilFromSlot(today, slot),
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <>
      <div className="planning-until">
        <label className="planning-until-label">{getBlock(uiLabels, 'from', 'title')}</label>
        <input
          type="date"
          className="planning-until-input"
          value={pendingFromDate}
          max={pendingDate}
          onChange={e => { setPendingFromDate(e.target.value); autoRefreshRef.current = false; setAutoRefresh(false); }}
        />
      </div>
      <div className="planning-until">
        <label className="planning-until-label">{getBlock(uiLabels, 'until', 'title')}</label>
        <input
          type="date"
          className="planning-until-input"
          value={pendingDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={e => handleDateChange(e.target.value)}
        />
      </div>
      <div className="planning-time-slider">
        <span className="planning-time-label">{formatTimeSlot(SLIDER_MIN)}</span>
        <input
          type="range"
          className="planning-time-range"
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          value={Math.min(pendingSlot, SLIDER_MAX)}
          onChange={e => handleSlotChange(Number(e.target.value))}
        />
        <span className="planning-time-label">{formatTimeSlot(SLIDER_MAX)}</span>
        <span className="planning-time-current">{formatTimeSlot(pendingSlot)}</span>
        <button className="planning-icon-btn planning-slider-btn" title="Refresh" onClick={handleRefresh}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M17 10a7 7 0 01-12.9 3.8M3 10a7 7 0 0112.9-3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M17 4v4h-4M3 16v-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className={`planning-icon-btn planning-slider-btn${looping ? ' active' : ''}`} title={looping ? 'Stop loop' : 'Loop timeline'} onClick={handleLoop}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M14 3l3 3-3 3M6 17l-3-3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M17 6H8a4 4 0 00-4 4M3 14h9a4 4 0 004-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <button className={`planning-icon-btn planning-slider-btn${autoRefresh ? ' active' : ''}`} title={getBlock(uiLabels, 'now', 'title')} onClick={handleNow}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </>
  );
}
