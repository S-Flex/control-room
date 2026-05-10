import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { fetchDataRow } from '@s-flex/xfw-data';
import type { DataGroup } from '@s-flex/xfw-ui';
import { useAppNav } from './useAppNav';
import { usePages } from './usePages';
import type { PageArea, Section } from '../types';

export type ViewParamsMap = Map<string, Set<string> | undefined>;

function pathToCode(path: string): string {
  return path.replace(/^\//, '');
}

function collectDataGroupCodes(
  area: PageArea | Section | undefined,
  out: Set<string>,
): void {
  if (!area) return;
  const s = area as Section;
  // The schema doc allows `data_group: string | string[]` even though the
  // type narrows to string only — handle both at runtime.
  const dg = s.data_group as string | string[] | undefined;
  if (typeof dg === 'string') out.add(dg);
  else if (Array.isArray(dg)) for (const c of dg) if (typeof c === 'string') out.add(c);
  if (s.pager?.data_group) out.add(s.pager.data_group);
  if (area.sections) for (const sub of area.sections) collectDataGroupCodes(sub, out);
}

async function fetchDataGroupParams(src: string): Promise<DataGroup[]> {
  const res = await fetchDataRow<{ data_group_json: DataGroup[] }>(
    'get_data_group',
    [{ key: 'data_group', val: src }],
  );
  if (!res.ok) throw new Error(res.error);
  return res.data[0]?.data_group_json ?? [];
}

/** For each path in the app-nav `page-list` entries, returns the union
 *  of param keys declared by every data_group the page references in
 *  pages.json (walking `main.sections` + `footer.sections` recursively,
 *  including pager data_groups). Views with no pages.json entry — or
 *  whose data_groups haven't loaded yet — get `undefined`, which the
 *  caller treats as "keep all params" so we never drop something we
 *  don't yet understand.
 *
 *  Auto-derived: when a data_group adds/removes a param on the API side,
 *  this hook picks it up on the next refresh — no app code to update.
 *  Page-level UI controls that need URL persistence (toggles, multi-
 *  select state, …) should be declared on a data_group's `params` list
 *  so they ride along here. */
export function useViewParams(): ViewParamsMap {
  const { pages } = usePages();
  const navItems = useAppNav();

  const viewPaths = useMemo(() => {
    const paths: string[] = [];
    for (const item of navItems) {
      if (item.type !== 'page-list') continue;
      for (const p of item.pages) paths.push(p.path);
    }
    return paths;
  }, [navItems]);

  const codesByPath = useMemo(() => {
    const out = new Map<string, string[] | null>();
    for (const path of viewPaths) {
      const config = pages.find(p => p.code === pathToCode(path));
      if (!config) { out.set(path, null); continue; }
      const set = new Set<string>();
      collectDataGroupCodes(config.main, set);
      collectDataGroupCodes(config.footer, set);
      out.set(path, [...set]);
    }
    return out;
  }, [pages, viewPaths]);

  const allCodes = useMemo(() => {
    const set = new Set<string>();
    for (const codes of codesByPath.values()) {
      if (codes) for (const c of codes) set.add(c);
    }
    return [...set];
  }, [codesByPath]);

  // Same query key + queryFn shape as xfw-ui's `useDataGroups`, so the
  // cache is shared — pages mounting their own data groups don't refetch.
  const queries = useQueries({
    queries: allCodes.map(code => ({
      queryKey: ['datagroup', code] as const,
      queryFn: () => fetchDataGroupParams(code),
      staleTime: 60 * 60 * 1000,
    })),
  });

  const paramsByCode = useMemo(() => {
    const out = new Map<string, Set<string> | undefined>();
    for (let i = 0; i < allCodes.length; i++) {
      const q = queries[i];
      if (!q.data) { out.set(allCodes[i], undefined); continue; }
      const set = new Set<string>();
      for (const dg of q.data) for (const p of dg.params ?? []) set.add(p.key);
      out.set(allCodes[i], set);
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCodes, ...queries.map(q => q.data)]);

  return useMemo(() => {
    const out: ViewParamsMap = new Map();
    for (const [path, codes] of codesByPath) {
      if (codes === null) { out.set(path, undefined); continue; }
      const set = new Set<string>();
      let allLoaded = true;
      for (const c of codes) {
        const p = paramsByCode.get(c);
        if (!p) { allLoaded = false; break; }
        for (const k of p) set.add(k);
      }
      out.set(path, allLoaded ? set : undefined);
    }
    return out;
  }, [codesByPath, paramsByCode]);
}
