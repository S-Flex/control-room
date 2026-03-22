import { useMemo } from 'react';
import { Card, ProgressCircleRaw, BarList, Donut, VBars, Gauge, Sparkline, StatRow } from './charts';
import type { DashboardData } from './types';

// SVG icons (matching legacy)
const icons = {
  queue: <svg viewBox="0 0 24 24"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  materials: <svg viewBox="0 0 24 24"><path d="M16 8v8m-8-4v4m4-12v12" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  rush: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  width: <svg viewBox="0 0 24 24"><path d="M21 3H3v18h18V3zM9 21V9m6 12V3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  location: <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="10" r="3"/></svg>,
  trueshape: <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  nesting: <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  cutoff: <svg viewBox="0 0 24 24"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  categories: <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  trend: <svg viewBox="0 0 24 24"><path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 16l4-8 4 4 4-8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  height: <svg viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" strokeLinecap="round" strokeLinejoin="round"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  fast: <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

export function WidgetPanel({ side, data }: { side: 'left' | 'right'; data: DashboardData }) {
  const computed = useMemo(() => {
    const { inflow, queues } = data;
    const queueList = queues.queues;
    const queueMap: Record<string, typeof queueList[0]> = {};
    queueList.forEach(q => { queueMap[q.code] = q; });

    const dk = queueList.filter(q => q.location === 'dk').length;
    const bh = queueList.filter(q => q.location === 'bh').length;
    const fast = queueList.filter(q => q.fastMover).length;

    const nestCount = inflow.filter(i => i.state === 'nest').length;
    const dtpCount = inflow.filter(i => i.state === 'dtp').length;
    const nestPct = inflow.length > 0 ? Math.round((nestCount / inflow.length) * 100) : 0;

    // Top materials
    const matCounts: Record<string, number> = {};
    inflow.forEach(i => { matCounts[i.code] = (matCounts[i.code] || 0) + 1; });
    const topMats = Object.entries(matCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    // Rush time donut
    const rushCounts: Record<string, number> = {};
    inflow.forEach(i => { rushCounts[i.rushTime] = (rushCounts[i.rushTime] || 0) + 1; });
    const rushSegments = [
      { name: '≤24h', value: (rushCounts['18h'] || 0) + (rushCounts['24h'] || 0) },
      { name: '30-48h', value: (rushCounts['30h'] || 0) + (rushCounts['48h'] || 0) },
      { name: '72-96h', value: (rushCounts['72h'] || 0) + (rushCounts['96h'] || 0) },
      { name: '≥72h', value: (rushCounts['120h'] || 0) + (rushCounts['144h'] || 0) + (rushCounts['168h'] || 0) },
    ];

    // Width distribution
    const widthBars = [
      { label: '<100', value: inflow.filter(i => i.width < 100).length },
      { label: '100', value: inflow.filter(i => i.width >= 100 && i.width < 150).length },
      { label: '150', value: inflow.filter(i => i.width >= 150 && i.width < 200).length },
      { label: '200', value: inflow.filter(i => i.width >= 200 && i.width < 250).length },
      { label: '250', value: inflow.filter(i => i.width >= 250 && i.width < 305).length },
      { label: '305+', value: inflow.filter(i => i.width >= 305).length },
    ];

    // Height distribution
    const heightBars = [
      { label: '<50', value: inflow.filter(i => i.height < 50).length },
      { label: '50', value: inflow.filter(i => i.height >= 50 && i.height < 100).length },
      { label: '100', value: inflow.filter(i => i.height >= 100 && i.height < 150).length },
      { label: '150', value: inflow.filter(i => i.height >= 150 && i.height < 203).length },
      { label: '203+', value: inflow.filter(i => i.height >= 203).length },
    ];

    // Gauges
    const dkCodes = new Set(queueList.filter(q => q.location === 'dk').map(q => q.code));
    const dkPct = inflow.length > 0 ? (inflow.filter(i => dkCodes.has(i.code)).length / inflow.length) * 100 : 0;
    const trueshapePct = inflow.length > 0 ? (inflow.filter(i => i.trueshape).length / inflow.length) * 100 : 0;

    // Cutoff status
    const dtpItems = inflow.filter(i => i.state === 'dtp');
    const cutoffCounts: Record<string, number> = { '11:30': 0, '16:30': 0, '21:30': 0 };
    dtpItems.forEach(i => {
      const h = parseInt(i.rushTime);
      if (h <= 30) cutoffCounts['11:30']++;
      else if (h <= 72) cutoffCounts['16:30']++;
      else cutoffCounts['21:30']++;
    });
    const cutoffItems = Object.entries(cutoffCounts).map(([name, value]) => ({ name, value }));

    // Categories
    const catCounts: Record<string, number> = {};
    inflow.forEach(i => {
      const q = queueMap[i.code];
      if (q?.category) catCounts[q.category.code] = (catCounts[q.category.code] || 0) + 1;
    });
    const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, value]) => ({ name: name.length > 13 ? name.substring(0, 12) + '...' : name, value }));

    // Sparkline (simulated per-hour)
    const perHour = Array.from({ length: 24 }, (_, h) =>
      Math.round(inflow.length / 24 * (Math.sin((h - 4) / 24 * Math.PI * 2) * 0.4 + 0.6) * (0.8 + Math.random() * 0.4))
    );
    const peakIdx = perHour.indexOf(Math.max(...perHour));
    const avgHour = Math.round(perHour.reduce((a, b) => a + b, 0) / 24);

    // Fast movers
    const fmQueues = queueList.filter(q => q.fastMover && q.location === 'dk');
    const fmCounts: Record<string, number> = {};
    fmQueues.forEach(q => { fmCounts[q.code] = inflow.filter(i => i.code === q.code).length; });
    const topFm = Object.entries(fmCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    return {
      dk, bh, fast, nestCount, dtpCount, nestPct, topMats, rushSegments,
      widthBars, heightBars, dkPct, trueshapePct, cutoffItems, topCats,
      perHour, peakIdx, avgHour, topFm, totalInflow: inflow.length,
    };
  }, [data]);

  if (side === 'left') {
    return (
      <div className="panel-left">
        <Card icon={icons.queue} title="Queue Activity" subtitle="Active queues">
          <ProgressCircleRaw value={computed.dk + computed.bh} total={300} label="queues" />
          <StatRow label="DK" value={computed.dk} />
          <StatRow label="BH" value={computed.bh} />
          <StatRow label="Fast" value={computed.fast} />
        </Card>
        <Card icon={icons.materials} title="Top Materials">
          <BarList items={computed.topMats} />
        </Card>
        <Card icon={icons.rush} title="Rush Times">
          <Donut segments={computed.rushSegments} colors={['#0f8d91', '#17c6cd', '#7dd3d7', '#d0f0f1']} />
        </Card>
        <Card icon={icons.width} title="Width Spread">
          <VBars data={computed.widthBars} />
        </Card>
        <Card icon={icons.location} title="DK Volume">
          <Gauge pct={computed.dkPct} label="DK share" />
        </Card>
        <Card icon={icons.trueshape} title="Trueshape">
          <Gauge pct={computed.trueshapePct} label="trueshape" />
        </Card>
      </div>
    );
  }

  return (
    <div className="panel-right">
      <Card icon={icons.nesting} title="Nesting Progress">
        <ProgressCircleRaw value={computed.nestPct} total={100} label="nested" />
        <StatRow label="Total" value={computed.totalInflow.toLocaleString()} />
        <StatRow label="Nest" value={computed.nestCount.toLocaleString()} />
        <StatRow label="DTP" value={computed.dtpCount.toLocaleString()} />
      </Card>
      <Card icon={icons.cutoff} title="Cutoff Status" iconClass="red">
        <BarList items={computed.cutoffItems} color="var(--alert-red)" />
      </Card>
      <Card icon={icons.categories} title="Categories">
        <BarList items={computed.topCats} />
      </Card>
      <Card icon={icons.trend} title="Inflow Trend">
        <Sparkline values={computed.perHour} />
        <StatRow label="Peak" value={`${computed.peakIdx}:00 (${computed.perHour[computed.peakIdx]})`} />
        <StatRow label="Avg/h" value={computed.avgHour.toLocaleString()} />
      </Card>
      <Card icon={icons.height} title="Height Spread">
        <VBars data={computed.heightBars} />
      </Card>
      <Card icon={icons.fast} title="Fast Movers">
        <BarList items={computed.topFm} />
      </Card>
    </div>
  );
}
