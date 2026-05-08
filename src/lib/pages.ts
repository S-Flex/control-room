/** Single source of truth for the View dropdown and the page-header
 *  breadcrumb. The set of params each view "uses" is auto-derived from
 *  pages.json + each referenced data_group's `params` list (see
 *  `useViewParams`), so this table only needs the path / label. */
export type ViewPage = {
  path: string;
  label: string;
};

export const VIEW_PAGES: ViewPage[] = [
  { path: '/control-room',     label: 'Control Room' },
  { path: '/production-lines', label: 'Production Lines' },
  { path: '/production-board', label: 'Production Board' },
  { path: '/inflow-manual',    label: 'Inflow Manual' },
  { path: '/inflow-auto',      label: 'Inflow Auto' },
  { path: '/batch-nests',      label: 'Batch' },
  { path: '/project',          label: 'Project' },
];

export const PAGES_WITH_MODEL = new Set([
  '/control-room',
  '/production-lines',
  '/production-board',
  '/inflow-manual',
  '/inflow-auto',
  '/batch-nests',
]);

/** `lang` rides along on every view switch regardless of what the
 *  destination's data_groups declare — it's a global UI setting. */
const ALWAYS_KEEP = new Set(['lang']);

/** Build the target URL when switching views. `viewParams` (built by
 *  `useViewParams`) declares the params each view actually consumes;
 *  if the destination's set is `undefined` (page not in pages.json, or
 *  its data_groups are still loading), we keep all current params as a
 *  safe default — never drop something we don't yet understand. */
export function buildViewUrl(
  target: ViewPage,
  currentSearch: string,
  viewParams: Map<string, Set<string> | undefined>,
): string {
  const allowed = viewParams.get(target.path);
  const search = currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch;

  if (!allowed) {
    return search ? `${target.path}?${search}` : target.path;
  }

  const current = new URLSearchParams(search);
  const next = new URLSearchParams();
  for (const [k, v] of current) {
    if (allowed.has(k) || ALWAYS_KEEP.has(k)) next.append(k, v);
  }
  const qs = next.toString();
  return qs ? `${target.path}?${qs}` : target.path;
}
