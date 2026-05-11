import { useEffect, useState } from 'react';

/** Build a module-cached loader hook for a static JSON resource served
 *  from `/data/*.json`. The cache is keyed by URL and shared across all
 *  callers — one fetch per page-load no matter how many components
 *  consume the same resource. In-flight requests are deduped, and the
 *  effect cleans up to avoid setState-after-unmount. */
export function createJsonResource<T>(url: string, initial: T): () => T {
  let cache: T | null = null;
  let inflight: Promise<T> | null = null;

  const fetchOnce = (): Promise<T> => {
    if (cache !== null) return Promise.resolve(cache);
    if (inflight) return inflight;
    inflight = fetch(url)
      .then(r => r.json() as Promise<T>)
      .then(data => { cache = data; inflight = null; return data; })
      .catch(err => { inflight = null; throw err; });
    return inflight;
  };

  return function useJsonResource(): T {
    const [data, setData] = useState<T>(() => cache ?? initial);
    useEffect(() => {
      if (cache !== null) return;
      let mounted = true;
      fetchOnce().then(d => { if (mounted) setData(d); }).catch(() => {});
      return () => { mounted = false; };
    }, []);
    return data;
  };
}
