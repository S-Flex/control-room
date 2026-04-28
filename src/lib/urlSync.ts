import { parseFullPath, composeFullPath } from '@s-flex/xfw-url';

/**
 * Safely write query-param updates to the URL while **preserving aux-route
 * outlets and their `//` separator**.
 *
 * The naive pattern `history.replaceState(null, '', `${window.location.pathname}?…`)`
 * is broken: `window.location.pathname` may already have its `(a:1//b:2)`
 * collapsed to `(a:1/b:2)` (browser/router normalisation), and writing it back
 * permanently overwrites the correct double-slash form even though xfw-url's
 * `composeFullPath` originally emitted it correctly.
 *
 * This helper round-trips through `parseFullPath` (forgiving regex — accepts
 * either single or double slash) and `composeFullPath` (always re-emits `//`),
 * so the URL bar and `window.location.pathname` are always written with the
 * correct `//` form.
 *
 * @param updates  query-param updates: `null` removes the key, anything else
 *                 sets it (arrays / objects are JSON.stringified).
 */
export function syncQueryParams(updates: Record<string, string | number | boolean | null | unknown[] | Record<string, unknown>>) {
  const fullPath = window.location.pathname + window.location.search;
  const parsed = parseFullPath(fullPath);
  const qpMap = new Map<string, unknown>();
  for (const p of parsed.queryParams) qpMap.set(p.key, p.val);
  for (const [k, v] of Object.entries(updates)) {
    if (v == null) {
      qpMap.delete(k);
    } else if (Array.isArray(v) || (typeof v === 'object')) {
      qpMap.set(k, JSON.stringify(v));
    } else {
      qpMap.set(k, String(v));
    }
  }
  const newQp = Array.from(qpMap, ([key, val]) => ({ key, val: val as string }));
  const newUrl = composeFullPath(parsed.path ?? '', parsed.outlets, newQp) + window.location.hash;
  window.history.replaceState(null, '', newUrl);
}

/**
 * Like `syncQueryParams` but lets the caller mutate the parsed query params via
 * a callback. Useful when removing a set of keys conditionally.
 */
export function rewriteUrl(mutate: (qp: Map<string, string>) => void) {
  const fullPath = window.location.pathname + window.location.search;
  const parsed = parseFullPath(fullPath);
  const qpMap = new Map<string, string>();
  for (const p of parsed.queryParams) qpMap.set(p.key, String(p.val ?? ''));
  mutate(qpMap);
  const newQp = Array.from(qpMap, ([key, val]) => ({ key, val }));
  const newUrl = composeFullPath(parsed.path ?? '', parsed.outlets, newQp) + window.location.hash;
  window.history.replaceState(null, '', newUrl);
}
