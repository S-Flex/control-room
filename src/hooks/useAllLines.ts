import { useEffect, useState } from 'react';
import type { LineConfig } from '../types';

let cache: LineConfig[] | null = null;
let inflight: Promise<LineConfig[]> | null = null;

function fetchOnce(): Promise<LineConfig[]> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetch('/data/models.json')
    .then(r => r.json() as Promise<LineConfig[]>)
    .then(data => { cache = data; inflight = null; return data; })
    .catch(err => { inflight = null; throw err; });
  return inflight;
}

/** Shared loader for `models.json`. Module-level cache dedupes across
 *  AppHeader and any page that needs the line list. */
export function useAllLines(): LineConfig[] {
  const [lines, setLines] = useState<LineConfig[]>(() => cache ?? []);
  useEffect(() => {
    if (cache) return;
    let mounted = true;
    fetchOnce().then(data => { if (mounted) setLines(data); }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  return lines;
}
