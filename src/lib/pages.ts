/** Helpers for the View dropdown / page-header breadcrumb. The actual
 *  list of views lives in `data/app-nav.json` (under the `view`
 *  page-list entry); each page's localized label lives in
 *  `data/pages-content.json`. The set of params each view "uses" is
 *  auto-derived from `pages.json` + each referenced data_group's
 *  `params` list (see `useViewParams`). */
export type ViewPage = {
  path: string;
  label: string;
};

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
