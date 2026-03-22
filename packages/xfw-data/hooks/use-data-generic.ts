import { useMemo } from "react";
import type { DataGroup, JSONRecord, ParamValue } from "../types";
import { useDataRows } from "./use-datarows";
import { useDatatable } from "./use-datatable";

export const useDataGeneric = <T = JSONRecord>(dataGroup: DataGroup, params: ParamValue[]) => {
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

    // Check for mandatory params availability
    const mandatoryParams = useMemo(
        () => dataTable?.params?.filter(p => !p.is_ident_only && !p.is_optional) ?? [],
        [dataTable]
    );
    const allMandatoryParamsAvailable = useMemo(() => {
        return mandatoryParams.every(mp =>
            params.some(p => p.key === mp.key && p.val !== undefined && p.val !== null)
        );
    }, [mandatoryParams, params]);

    const primaryIdKey = useMemo(
        () => dataTable?.primary_keys?.[0] ?? "id",
        [dataTable]
    );

    // Fetch data rows (disabled until datatable is loaded and all mandatory params are available)
    const { data, isLoading, error, refetch, isInitialLoading, setLocalData, mutate, dataUpdatedAt } =
        useDataRows<T>(primarySrc, params, {
            enabled: !!dataTable && allMandatoryParamsAvailable,
        }, primaryIdKey);

    // Fetch meta data rows
    const {
        data: metaData,
        isLoading: isLoadingMeta,
        error: errorMeta,
    } = useDataRows(metaSrc || "", params, {
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
        params,
        refetchDataRows: refetch,
        setLocalData,
        mutate,
        dataUpdatedAt,
    };
};
