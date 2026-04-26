export const WIDTH_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'auto (default)' },
  { value: 'col-span-1', label: '1 / 6' },
  { value: 'col-span-2', label: '2 / 6' },
  { value: 'col-span-3', label: '3 / 6' },
  { value: 'col-span-4', label: '4 / 6' },
  { value: 'col-span-5', label: '5 / 6' },
  { value: 'col-span-6', label: '6 / 6 (full)' },
  { value: 'col-span-1 justify-self-end', label: '1 / 6 right-aligned' },
];

export const CONTROL_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'default' },
  { value: 'i18n-text', label: 'i18n-text' },
  { value: 'badge', label: 'badge' },
  { value: 'date', label: 'date' },
  { value: 'datetime', label: 'datetime' },
  { value: 'percent', label: 'percent' },
  { value: 'content', label: 'content' },
  { value: 'icon-map', label: 'icon-map' },
  { value: 'img', label: 'img' },
];

export const LAYOUT_OPTIONS: { value: string; label: string }[] = [
  { value: 'flow-board', label: 'flow-board' },
  { value: 'cards', label: 'cards' },
  { value: 'item', label: 'item' },
  { value: 'table', label: 'table' },
  { value: 'timeline-bar', label: 'timeline-bar' },
  { value: 'donut-chart', label: 'donut-chart' },
  { value: 'activity-gauge', label: 'activity-gauge' },
  { value: 'ink-gauge', label: 'ink-gauge' },
  { value: 'vertical-bar', label: 'vertical-bar' },
  { value: 'stacked-bar', label: 'stacked-bar' },
  { value: 'status-bar', label: 'status-bar' },
  { value: 'content', label: 'content' },
];
