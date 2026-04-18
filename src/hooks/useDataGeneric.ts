import { useMemo } from 'react';
import { useDatatable, useDataRows, type JSONRecord, type ParamValue } from '@s-flex/xfw-data';
import { useQueryParams, useOverrideParams } from '@s-flex/xfw-url';
import { useLoadingSubscription, type DataGroup } from '@s-flex/xfw-ui';

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
    const merged: ParamValue[] = [...dataGroupQueryParams, ...overrideParams];
    for (const def of dataGroup?.params ?? []) {
      if (def.default_value === undefined) continue;
      const existing = merged.find(p => p.key === def.key);
      if (!existing) {
        merged.push({ key: def.key, val: def.default_value });
      } else if (existing.val === null || existing.val === undefined) {
        existing.val = def.default_value;
      }
    }
    return merged.filter(p => !(optionalKeys.has(p.key) && (p.val === null || p.val === undefined)));
  }, [dataGroupQueryParams, overrideParams, dataGroup?.params, optionalKeys]);

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
