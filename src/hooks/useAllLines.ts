import { createJsonResource } from '../lib/jsonResource';
import type { LineConfig } from '../types';

export const useAllLines = createJsonResource<LineConfig[]>('/data/models.json', []);
