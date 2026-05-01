import { useEffect, useMemo } from 'react';
import { useDatatable, useDataRows, type JSONRecord, type JSONValue, type ParamValue } from '@s-flex/xfw-data';
import { useQueryParams, useOverrideParams } from '@s-flex/xfw-url';
import { useLoadingSubscription, type DataGroup } from '@s-flex/xfw-ui';
import { syncQueryParams } from '../lib/urlSync';

/**
 * Wrapper around the xfw-ui `useDataGeneric` that drops optional params with
 * null/undefined values before issuing the fetch, so missing optional query
 * params don't end up in the request body.
 */
export function useDataGeneric<T = JSONRecord>(dataGroup?: DataGroup) {
  const src = (Array.isArray(dataGroup?.src) ? dataGroup?.src[0] : dataGroup?.src) ?? '';
  const metaSrc = Array.isArray(dataGroup?.src) ? dataGroup?.src[1] : undefined;

  const { data: dataTable, isLoading: isLoadingDataTable, error: errorDataTable } = useDatatable(src);
  const { data: metaDataTable, isLoading: isLoadingMetaDataTable, error: errorMetaDataTable } = useDatatable(metaSrc || '');

  const dataGroupQueryParams = useQueryParams(dataGroup?.params ?? []);
  const overrideParams = useOverrideParams(dataGroup?.params ?? []);

  const optionalKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of dataTable?.params ?? []) if (p.is_optional) keys.add(p.key);
    return keys;
  }, [dataTable?.params]);

  const params = useMemo<ParamValue[]>(() => {
    // Spread copies refs from the upstream arrays — the objects inside still
    // belong to xfw-url's `useQueryParams` cache (and TanStack's overrides).
    // Mutating their `.val` corrupts xfw-url's `prevValues.current`, which
    // makes its next `areParamsEqual(prev, urlNewValues)` return false on
    // every render → infinite `setValues` loop. Replace the slot instead.
    const merged: ParamValue[] = [...dataGroupQueryParams, ...overrideParams];
    for (const def of dataGroup?.params ?? []) {
      if (def.default_value === undefined) continue;
      const idx = merged.findIndex(p => p.key === def.key);
      if (idx === -1) {
        merged.push({ key: def.key, val: def.default_value });
      } else if (merged[idx].val === null || merged[idx].val === undefined) {
        merged[idx] = { key: def.key, val: def.default_value };
      }
    }
    return merged.filter(p => !(optionalKeys.has(p.key) && (p.val === null || p.val === undefined)));
  }, [dataGroupQueryParams, overrideParams, dataGroup?.params, optionalKeys]);

  // Reflect `default_value` into the URL for `is_query_param` params so the
  // URL is the source of truth. Skip when URL/override already supplies a
  // value — otherwise the next render's `setValues` from xfw-url would loop.
  useEffect(() => {
    if (!dataGroup?.params) return;
    const updates: Record<string, JSONValue> = {};
    for (const def of dataGroup.params) {
      if (!def.is_query_param) continue;
      if (def.default_value === undefined || def.default_value === null) continue;
      const fromUrl = dataGroupQueryParams.find(p => p.key === def.key);
      if (fromUrl && fromUrl.val !== null && fromUrl.val !== undefined) continue;
      const fromOverride = overrideParams.find(p => p.key === def.key);
      if (fromOverride && fromOverride.val !== null && fromOverride.val !== undefined) continue;
      updates[def.key] = def.default_value;
    }
    if (Object.keys(updates).length > 0) syncQueryParams(updates);
  }, [dataGroup?.params, dataGroupQueryParams, overrideParams]);

  const allMandatoryParamsAvailable = useMemo(() => {
    const mandatory = dataTable?.params.filter(p => !p.is_ident_only && !p.is_optional) ?? [];
    return mandatory.every(mp => params.some(p => p.key === mp.key && p.val !== undefined && p.val !== null));
  }, [dataTable, params]);

  const primaryIdKey = dataTable?.primary_keys?.[0] ?? 'id';
  const refetchInterval = dataGroup?.query_options?.refetch_interval ?? dataTable?.query_options?.refetch_interval;

  const {
    data, isLoading, error, refetch, isInitialLoading, setLocalData, mutate, dataUpdatedAt,
  } = useDataRows<T>(src, params, {
    enabled: !!dataTable && allMandatoryParamsAvailable,
    ...(refetchInterval !== undefined && { refetchInterval }),
  }, primaryIdKey);

  const { data: metaData, isLoading: isLoadingMeta, error: errorMeta } = useDataRows(metaSrc || '', params, {
    enabled: !!metaSrc && !!metaDataTable && allMandatoryParamsAvailable,
    ...(refetchInterval !== undefined && { refetchInterval }),
  });

  const totalIsLoading = isLoadingDataTable || (metaSrc ? isLoadingMetaDataTable : false) || isLoading || (metaSrc ? isLoadingMeta : false);
  const totalIsInitialLoading = isLoadingDataTable || (metaSrc ? isLoadingMetaDataTable : false) || isInitialLoading;
  const totalError = errorDataTable || (metaSrc ? errorMetaDataTable : null) || error || (metaSrc ? errorMeta : null);

  useLoadingSubscription(totalIsLoading && totalIsInitialLoading);

  return {
    dataTable,
    dataRows: data,
    metaData: metaData || [],
    metaDataTable,
    isLoading: totalIsLoading,
    isInitialLoading: totalIsInitialLoading,
    error: totalError,
    params,
    refetchDataRows: refetch,
    setLocalData,
    mutate,
    dataUpdatedAt,
  };
}
