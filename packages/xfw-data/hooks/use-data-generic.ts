import { useMemo } from "react";
import type { DataGroup, JSONRecord, ParamDefinition, ParamValue } from "../types";
import { useDataRows } from "./use-datarows";
import { useDatatable } from "./use-datatable";
import { useQueryParams } from "xfw-url";

export const useDataGeneric = <T = JSONRecord>(dataGroup: DataGroup, params: ParamDefinition[]) => {
    // Handle single or multiple sources
    const sources = useMemo(() => {
        return Array.isArray(dataGroup.src) ? dataGroup.src : [dataGroup.src];
    }, [dataGroup.src]);

    const primarySrc = sources[0];
    const metaSrc = sources[1];

    // Fetch primary datatable
    const {
        data: dataTable,
        isLoading: isLoadingDataTable,
        error: errorDataTable,
    } = useDatatable(primarySrc);

    // Fetch meta datatable (always call hook, but with conditional src)
    const {
        data: metaDataTable,
        isLoading: isLoadingMetaDataTable,
        error: errorMetaDataTable,
    } = useDatatable(metaSrc || "");

    console.log("useDataGeneric", dataGroup, params);

    // Read URL query params for dataTable params marked is_query_param
    const queryParamConfig = useMemo(
        () => dataTable?.params
            ?.filter(p => p.is_query_param)
            .map(p => ({ key: p.key, isQueryParam: true as const })) ?? [],
        [dataTable]
    );
    const urlParams = useQueryParams(queryParamConfig);

    console.log("useDataGeneric - urlParams:", urlParams);

    // Resolve params: URL query param values override defaults
    const mergedParams = useMemo<ParamValue[]>(() => {
        const urlMap = new Map(urlParams.map(p => [p.key, p.val]));
        const merged: ParamValue[] = params.map(p => ({
            key: p.key,
            val: urlMap.has(p.key) && urlMap.get(p.key) != null
                ? urlMap.get(p.key)!
                : (p.default_value ?? p.val ?? null),
        }));
        // Add URL params not already in the list
        for (const { key, val } of urlParams) {
            if (val != null && !merged.some(p => p.key === key)) {
                merged.push({ key, val });
            }
        }
        return merged;
    }, [params, urlParams]);

    // Check for mandatory params availability
    const mandatoryParams = useMemo(
        () => dataTable?.params?.filter(p => !p.is_ident_only && !p.is_optional) ?? [],
        [dataTable]
    );
    const allMandatoryParamsAvailable = useMemo(() => {
        return mandatoryParams.every(mp =>
            mergedParams.some(p => p.key === mp.key && p.val !== undefined && p.val !== null)
        );
    }, [mandatoryParams, mergedParams]);

    const primaryIdKey = useMemo(
        () => dataTable?.primary_keys?.[0] ?? "id",
        [dataTable]
    );

    // Fetch data rows (disabled until datatable is loaded and all mandatory params are available)
    const { data, isLoading, error, refetch, isInitialLoading, setLocalData, mutate, dataUpdatedAt } =
        useDataRows<T>(primarySrc, mergedParams, {
            enabled: !!dataTable && allMandatoryParamsAvailable,
        }, primaryIdKey);

    // Fetch meta data rows
    const {
        data: metaData,
        isLoading: isLoadingMeta,
        error: errorMeta,
    } = useDataRows(metaSrc || "", mergedParams, {
        enabled: !!metaSrc && !!metaDataTable && allMandatoryParamsAvailable,
    });

    // Aggregate loading and error states
    const totalIsLoading = isLoadingDataTable || (metaSrc ? isLoadingMetaDataTable : false) || isLoading || (metaSrc ? isLoadingMeta : false);
    const totalIsInitialLoading = isLoadingDataTable || (metaSrc ? isLoadingMetaDataTable : false) || isInitialLoading;
    const totalError = errorDataTable || (metaSrc ? errorMetaDataTable : null) || error || (metaSrc ? errorMeta : null);

    return {
        dataTable,
        dataRows: data,
        metaData: metaData || [],
        metaDataTable,
        isLoading: totalIsLoading,
        isInitialLoading: totalIsInitialLoading,
        error: totalError,
        params: mergedParams,
        refetchDataRows: refetch,
        setLocalData,
        mutate,
        dataUpdatedAt,
    };
};
