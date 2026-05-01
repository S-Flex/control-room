// Forgiving replacement for xfw-url's `parseFullPath`. The version of xfw-url
// pinned in this repo (0.2.4) splits aux outlets on the literal string "//",
// which means a collapsed `(a:1/b:2)` (produced when React Router's
// `resolveTo` runs `joinPaths(...).replace(/\/\/+/g, "/")` on the URL) parses
// as a single outlet `{key:'a', val:'1/b:2'}` — garbage. `composeFullPath`
// then can't reconstruct `//`, so the aux-route guard's
// `parseFullPath → composeFullPath` round-trip fails to fix the drift.
//
// This split regex matches one-or-more `/` followed by an outlet header
// (`identifier:`), so it accepts both `//` and a collapsed `/` between
// outlets while never splitting inside an outlet's value (which often
// contains its own `/` for nested paths, e.g. `detail:foo/bar`).
//
// Compose remains delegated to xfw-url — its `composeFullPath` correctly
// emits `//` already.

export type AuxOutlet = { key: string; val: string };
export type ParsedFullPath = {
  path?: string;
  outlets: AuxOutlet[];
  queryParams: Array<{ key: string; val: string }>;
};

const OUTLET_BOUNDARY = /\/+(?=[A-Za-z_][A-Za-z0-9_-]*:)/;

export function parseFullPathForgiving(urlPath: string): ParsedFullPath {
  const [pathWithOutlets, queryString = ''] = urlPath.split('?');
  const match = pathWithOutlets.match(/^([^(]+)?(?:\((.+)\))?$/);
  let path = match?.[1];
  if (path) path = path.replace(/^\/+/, '');
  const auxString = match?.[2] || '';
  const outlets: AuxOutlet[] = [];
  if (auxString) {
    for (const part of auxString.split(OUTLET_BOUNDARY)) {
      const colonIdx = part.indexOf(':');
      if (colonIdx > 0) {
        outlets.push({ key: part.slice(0, colonIdx), val: part.slice(colonIdx + 1) });
      }
    }
  }
  const queryParams: Array<{ key: string; val: string }> = [];
  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    for (const [key, val] of searchParams.entries()) {
      queryParams.push({ key, val });
    }
  }
  return { path, outlets, queryParams };
}
