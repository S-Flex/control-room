import { getBlock } from 'xfw-get-block';
import type { UiLabel } from './types';

type Material = {
  code: string;
  category: { code: string };
  model: { code: string };
  rush_time_hours: number;
  interval_workdays: number;
  production_dates?: string[];
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

  return (
    <div className="schedule-menu-grid">
      {columns.map(col => (
        <div key={col.interval} className="schedule-menu-column">
          <div className="schedule-column-header">{getIntervalLabel(col.interval)}</div>
          <div className="schedule-column-body">
            {[...col.categories.entries()].map(([catCode, items]) => (
              <div key={catCode} className="schedule-category">
                <div className="schedule-category-title">{getBlock(content, catCode, 'title')}</div>
                {items.map(item => (
                  <button
                    key={item.code}
                    className={`dropdown-menu-item schedule-item${selectedMaterial === item.code ? ' active' : ''}`}
                    onClick={() => onSelect(item.code)}
                  >
                    <span className="schedule-item-name">{getBlock(content, item.code, 'title')}</span>
                    <span className="schedule-rush-badge">{item.rush_time_hours}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
