import { composeFullPath } from '@s-flex/xfw-url';
import { parseFullPathForgiving } from './parseFullPath';

/**
 * Aux-route integrity guard.
 *
 * Why this exists
 * ---------------
 * `composeFullPath` from `@s-flex/xfw-url` correctly emits `(a:1//b:2)` (double
 * slash) when joining multiple aux outlets. Two well-meaning things downstream
 * silently collapse the `//` into `/`:
 *
 *   1. **React Router's `resolveTo`** runs `joinPaths(...).replace(/\/\/+/g, "/")`
 *      on every `to` argument before calling `history.pushState`. Our correctly-
 *      composed URL becomes broken before it ever hits the browser.
 *
 *   2. **Naive `replaceState` patterns** (`window.location.pathname`-based URL
 *      composition) write the already-collapsed pathname back to the bar and
 *      permanently lose the `//`.
 *
 * The version of `@s-flex/xfw-url` pinned in this repo (0.2.4) **does not**
 * have the forgiving parser — its `parseFullPath` splits aux outlets on the
 * literal string `"//"`, so a collapsed URL parses as a single garbage
 * outlet. We therefore can't use it for re-canonicalisation; we use the
 * local `parseFullPathForgiving` (`./parseFullPath.ts`) instead. Compose is
 * still delegated to xfw-url — its `composeFullPath` correctly emits `//`.
 *
 * What this does
 * --------------
 * Patches `history.pushState`/`replaceState` once at boot to dispatch
 * synthetic events (xfw-url already does this, we install our own copy in case
 * it hasn't run yet), then on every navigation event:
 *
 *   • parses the URL with the local forgiving parser
 *   • re-composes via xfw-url's `composeFullPath` (always re-emits `//`)
 *   • if the canonical URL differs from the current URL, calls
 *     `history.replaceState` to restore it
 *
 * The check is idempotent (canonical-canonical comparison), so it cannot loop.
 *
 * Boot-time self-test
 * -------------------
 * `assertComposeEmitsDoubleSlash()` runs once at install and throws if
 * `@s-flex/xfw-url`'s `composeFullPath` is the old single-slash version (i.e.
 * Vite served a stale dep cache). That converts a silent runtime drift into a
 * loud startup error.
 */

let installed = false;
let fixCount = 0;

function canonicalUrl(): string {
  const fullPath = window.location.pathname + window.location.search;
  const parsed = parseFullPathForgiving(fullPath);
  return composeFullPath(parsed.path ?? '', parsed.outlets, parsed.queryParams) + window.location.hash;
}

function currentUrl(): string {
  return window.location.pathname + window.location.search + window.location.hash;
}

function fixIfDrifted() {
  // Skip if there's no `(...)` outlet expression — only multi-outlet URLs can drift.
  if (!window.location.pathname.includes('(')) return;
  const cur = currentUrl();
  const want = canonicalUrl();
  if (want !== cur) {
    fixCount++;
    // eslint-disable-next-line no-console
    console.warn(
      `[aux-route-guard] URL collapsed; restoring // (fix #${fixCount})\n  from: ${cur}\n  to:   ${want}`,
    );
    window.history.replaceState(window.history.state, '', want);
  }
}

function assertComposeEmitsDoubleSlash(): void {
  const probe = composeFullPath('test', [
    { key: 'a', val: '1' },
    { key: 'b', val: '2' },
  ]);
  if (!probe.includes('a:1//b:2')) {
    throw new Error(
      `[aux-route-guard] @s-flex/xfw-url composeFullPath is collapsing aux outlets ` +
      `(got "${probe}"). The Vite dep cache likely has a stale version. ` +
      `Fix: rm -rf node_modules/.vite && npm run dev`,
    );
  }
}

/** Patches history methods so push/replaceState fire synthetic DOM events.
 *  Idempotent — safe to call multiple times; only patches once per `window`. */
function patchHistory(): void {
  const w = window as Window & { __auxGuardPatched?: boolean };
  if (w.__auxGuardPatched) return;
  w.__auxGuardPatched = true;
  for (const m of ['pushState', 'replaceState'] as const) {
    const orig = window.history[m].bind(window.history);
    window.history[m] = function (...args: Parameters<typeof window.history.pushState>) {
      const ret = orig(...args);
      window.dispatchEvent(new Event(m));
      return ret;
    } as typeof window.history.pushState;
  }
}

/** Install the guard. Call once, as early as possible (e.g. in main.tsx). */
export function installAuxRouteGuard(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  assertComposeEmitsDoubleSlash();
  patchHistory();

  window.addEventListener('popstate', fixIfDrifted);
  window.addEventListener('pushState', fixIfDrifted);
  window.addEventListener('replaceState', fixIfDrifted);

  // Initial sweep on mount (covers reload onto a collapsed URL).
  fixIfDrifted();
}

/** For tests / debugging: how many times the guard has had to repair the URL. */
export function getAuxRouteGuardFixCount(): number {
  return fixCount;
}
