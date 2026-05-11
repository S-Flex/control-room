import { createJsonResource } from '../lib/jsonResource';
import type { AppNavItem } from '../types';

export const useAppNav = createJsonResource<AppNavItem[]>('/data/app-nav.json', []);
