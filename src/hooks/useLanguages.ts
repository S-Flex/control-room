import type { JSONRecord } from '@s-flex/xfw-data';
import { createJsonResource } from '../lib/jsonResource';

export const useLanguages = createJsonResource<JSONRecord[]>('/data/languages.json', []);
