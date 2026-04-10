import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDataRow } from '@s-flex/xfw-data';
import type { JSONRecord } from '@s-flex/xfw-data';
import type { FieldMap, FlowBoardLevelConfig, FlowLevelFieldConfig } from './types';

/** Recursively collect all unique input_data.src from level configs + root fieldMap. */
function collectSrcValues(fieldMap: FieldMap, levelConfig?: FlowBoardLevelConfig): string[] {
  const seen = new Set<string>();

  // From root fieldMap
  for (const field of Object.values(fieldMap)) {
    const src = field.input_data?.src;
    if (src) seen.add(src);
  }

  // Recursively from level field_configs
  function walk(config?: FlowBoardLevelConfig) {
    if (!config) return;
    if (config.field_config) {
      for (const [key, fc] of Object.entries(config.field_config)) {
        if (key === 'class_name') continue;
        const uiId = (fc.ui as Record<string, unknown> | undefined)?.input_data as { src?: string } | undefined;
        const src = fc.input_data?.src ?? uiId?.src;
        if (src) seen.add(src);
      }
    }
    walk(config.children);
  }
  walk(levelConfig);

  return [...seen];
}

/**
 * Fetches all input_data.src references found in the fieldMap and
 * flow_board_config levels. Returns an enriched fieldMap with resolved
 * options, plus an optionsMap for level merging.
 */
export function useFieldOptions(fieldMap: FieldMap, flowBoardConfig?: FlowBoardLevelConfig) {
  const srcList = useMemo(
    () => collectSrcValues(fieldMap, flowBoardConfig),
    [fieldMap, flowBoardConfig],
  );

  const { data: optionsMap } = useQuery({
    queryKey: ['field-options', ...srcList],
    queryFn: async () => {
      const results = await Promise.all(
        srcList.map(src => fetchDataRow<JSONRecord>(src, []))
      );
      const map: Record<string, JSONRecord[]> = {};
      srcList.forEach((src, i) => {
        const result = results[i];
        if (result.ok) map[src] = result.data;
      });
      return map;
    },
    staleTime: 60 * 60 * 1000,
    enabled: srcList.length > 0,
  });

  // Enrich root fieldMap
  const enrichedFieldMap = useMemo(() => {
    if (!optionsMap) return fieldMap;
    let changed = false;
    const enriched = { ...fieldMap };
    for (const [key, field] of Object.entries(enriched)) {
      const src = field.input_data?.src;
      if (src && optionsMap[src]) {
        changed = true;
        enriched[key] = {
          ...field,
          input_data: {
            options: optionsMap[src],
            value_key: field.input_data!.value_key,
            label_key: field.input_data!.label_key,
          },
        };
      }
    }
    return changed ? enriched : fieldMap;
  }, [fieldMap, optionsMap]);

  return { fieldMap: enrichedFieldMap, optionsMap };
}
