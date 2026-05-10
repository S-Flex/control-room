import { useEffect, useState } from 'react';
import type { AppNavItem } from '../types';

let cache: AppNavItem[] | null = null;
let inflight: Promise<AppNavItem[]> | null = null;

function fetchOnce(): Promise<AppNavItem[]> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetch('/data/app-nav.json')
    .then(r => r.json() as Promise<AppNavItem[]>)
    .then(data => { cache = data; inflight = null; return data; })
    .catch(err => { inflight = null; throw err; });
  return inflight;
}

/** Loader for `app-nav.json` — drives the app-header nav clusters. */
export function useAppNav(): AppNavItem[] {
  const [nav, setNav] = useState<AppNavItem[]>(() => cache ?? []);
  useEffect(() => {
    if (cache) return;
    let mounted = true;
    fetchOnce().then(data => { if (mounted) setNav(data); }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  return nav;
}
