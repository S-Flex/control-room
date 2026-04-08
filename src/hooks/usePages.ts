import { useEffect, useState } from 'react';
import type { PageConfig } from '../types';

type ContentEntry = {
  code: string;
  block: Record<string, unknown>;
};

type PagesData = {
  pages: PageConfig[];
  content: ContentEntry[];
  isLoading: boolean;
};

let cache: { pages: PageConfig[]; content: ContentEntry[] } | null = null;
let pending: Promise<{ pages: PageConfig[]; content: ContentEntry[] }> | null = null;

function fetchPages() {
  if (!pending) {
    pending = Promise.all([
      fetch('/data/pages.json').then(r => r.json()),
      fetch('/data/pages-content.json').then(r => r.json()),
    ]).then(([pages, content]) => {
      cache = { pages, content };
      return cache;
    });
  }
  return pending;
}

export function usePages(): PagesData {
  const [data, setData] = useState<{ pages: PageConfig[]; content: ContentEntry[] } | null>(cache);

  useEffect(() => {
    if (cache) {
      setData(cache);
      return;
    }
    fetchPages().then(setData);
  }, []);

  return {
    pages: data?.pages ?? [],
    content: data?.content ?? [],
    isLoading: !data,
  };
}

export function usePage(code: string) {
  const { pages, content, isLoading } = usePages();
  const config = pages.find(p => p.code === code);
  return { config, content, isLoading };
}

export type { ContentEntry };
