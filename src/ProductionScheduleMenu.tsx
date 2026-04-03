import { getBlock } from 'xfw-get-block';
import type { UiLabel } from './types';

type CutoffTime = {
  rush_time: number;
  cutoff_time: string;
};

type Material = {
  code: string;
  category: { code: string };
  model: { code: string };
  rush_time_hours: number;
  interval_workdays: number;
  production_dates?: string[];
  cutoff_times?: CutoffTime[];
};

type ContentEntry = {
  code: string;
  block: { i18n?: Record<string, { title?: string }>; [key: string]: unknown };
};

type ProductionScheduleMenuProps = {
  materials: Material[];
  content: ContentEntry[];
  modelCode: string;
  uiLabels: UiLabel[];
  selectedMaterial: string | null;
  onSelect: (code: string) => void;
};

export type { Material, ContentEntry };

export function ProductionScheduleMenu({
  materials,
  content,
  modelCode,
  uiLabels,
  selectedMaterial,
  onSelect,
}: ProductionScheduleMenuProps) {
  // Filter materials by selected model
  const filtered = materials.filter(m => m.model.code === modelCode);

  // Get distinct intervals, sorted
  const intervals = [...new Set(filtered.map(m => m.interval_workdays))].sort((a, b) => a - b);

  // Group by interval, then by category, sorted by rush_time_hours
  const columns = intervals.map(interval => {
    const items = filtered
      .filter(m => m.interval_workdays === interval)
      .sort((a, b) => a.rush_time_hours - b.rush_time_hours);

    const categoryMap = new Map<string, Material[]>();
    for (const item of items) {
      const cat = item.category.code;
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(item);
    }

    return { interval, categories: categoryMap };
  });

  function getIntervalLabel(interval: number): string {
    if (interval === 1) return getBlock(uiLabels, 'every_day', 'title');
    const template = getBlock(uiLabels, 'every_n_days', 'title');
    return template.replace('{n}', String(interval));
  }

  function getCutoffTime(item: Material): string | null {
    if (!item.cutoff_times) return null;
    const match = item.cutoff_times.find(c => c.rush_time === item.rush_time_hours);
    if (match) return match.cutoff_time;
    // Fallback: find the closest cutoff with rush_time >= material's rush_time
    const sorted = [...item.cutoff_times].sort((a, b) => a.rush_time - b.rush_time);
    const fallback = sorted.find(c => c.rush_time >= item.rush_time_hours);
    return fallback?.cutoff_time ?? sorted[sorted.length - 1]?.cutoff_time ?? null;
  }

  // Collect distinct rush_time badges per interval for the header
  function getIntervalBadges(col: typeof columns[0]): number[] {
    const set = new Set<number>();
    for (const items of col.categories.values()) {
      for (const item of items) set.add(item.rush_time_hours);
    }
    return [...set].sort((a, b) => a - b);
  }

  return (
    <div className="schedule-menu-grid">
      {columns.map(col => (
        <div key={col.interval} className="schedule-menu-column">
          <div className="schedule-column-header">
            <span>{getIntervalLabel(col.interval)}</span>
            <span className="schedule-header-badges">
              {getIntervalBadges(col).map(rt => (
                <span key={rt} className="schedule-rush-badge">{rt}</span>
              ))}
            </span>
          </div>
          <div className="schedule-column-body">
            {[...col.categories.entries()].map(([catCode, items]) => (
              <div key={catCode} className="schedule-category">
                <div className="schedule-category-title">{getBlock(content, catCode, 'title')}</div>
                {items.map(item => {
                  const cutoff = getCutoffTime(item);
                  return (
                    <button
                      key={item.code}
                      className={`dropdown-menu-item schedule-item${selectedMaterial === item.code ? ' active' : ''}`}
                      onClick={() => onSelect(item.code)}
                    >
                      <span className="schedule-item-name">{getBlock(content, item.code, 'title')}</span>
                      {cutoff && <span className="schedule-cutoff">{cutoff}</span>}
                      <span className="schedule-rush-badge">{item.rush_time_hours}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
