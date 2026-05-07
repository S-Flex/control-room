/** Single source of truth for the View dropdown and the page-header
 *  breadcrumb. */
export const VIEW_PAGES: { path: string; label: string }[] = [
  { path: '/control-room',     label: 'Control Room' },
  { path: '/production-lines', label: 'Production Lines' },
  { path: '/production-board', label: 'Production Board' },
  { path: '/inflow-manual',    label: 'Inflow Manual' },
  { path: '/inflow-auto',      label: 'Inflow Auto' },
  { path: '/batch',            label: 'Batch' },
  { path: '/project',          label: 'Project' },
];

export const PAGES_WITH_MODEL = new Set([
  '/control-room',
  '/production-lines',
  '/production-board',
  '/inflow-manual',
  '/inflow-auto',
]);
