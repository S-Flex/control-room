import { useLoadingSubscription } from "../../providers/loading-boundary-provider";
import { useOverrideParams } from "../../providers/override-params-provider";
import type { DataGroup, JSONRecord } from "../types";
import { useMemo } from "react";
import { useQueryParams } from "xfw-url";
import { useDataRows } from "./use-datarows";
import { useDatatable } from "./use-datatable";


export const useDataGeneric = <T = JSONRecord>(dataGroup: DataGroup) => {
    // 1. Gather and combine all params.
    const dataGroupQueryParams = useQueryParams(dataGroup.params);
    const overrideParams = useOverrideParams(dataGroup.params);
    const params = useMemo(
        () => [...dataGroupQueryParams, ...overrideParams],
        [dataGroupQueryParams, overrideParams]
    );

    // 2. Handle single or multiple sources
    const sources = useMemo(() => {
        return Array.isArray(dataGroup.src) ? dataGroup.src : [dataGroup.src];
    }, [dataGroup.src]);

    const primarySrc = sources[0];
    const metaSrc = sources[1]; // Support one meta source

    // 3. Fetch primary datatable
    const {
        data: dataTable,
        isLoading: isLoadingDataTable,
        error: errorDataTable,
    } = useDatatable(primarySrc);

    // 4. Fetch meta datatable (always call hook, but with conditional src)
    const {
        data: metaDataTable,
        isLoading: isLoadingMetaDataTable,
        error: errorMetaDataTable,
    } = useDatatable(metaSrc || "");

    // 4.1 Check mandatory params using dataTable.params.
    const mandatoryParams = useMemo(
        () => dataTable?.params.filter(p => !p.is_ident_only && !p.is_optional) ?? null,
        [dataTable]
    );
    const allMandatoryParamsAvailable = useMemo(() => {
        return mandatoryParams?.every(mp => params.some(p => p.key === mp.key && p.val !== undefined && p.val !== null)) ?? false;
    }, [mandatoryParams, params]);

    // primaryIdKey defaults to "id" until the datatable resolves — acceptable for the initial fetch.
    const primaryIdKey = useMemo(() => dataTable?.primary_keys?.[0] ?? "id", [dataTable]);

    // 5. Fetch data rows in parallel with the datatable — no longer gated on it.
    const { data, isLoading, error, refetch, isInitialLoading, setLocalData, mutate, dataUpdatedAt } = useDataRows<T>(primarySrc, params, {
        enabled: allMandatoryParamsAvailable,
    }, primaryIdKey);

    // 6. Fetch meta data rows (always call hook, but with conditional enablement)
    const {
        data: metaData,
        isLoading: isLoadingMeta,
        error: errorMeta,
    } = useDataRows(metaSrc || "", params, {
        enabled: !!metaSrc && allMandatoryParamsAvailable,
    });

    // 7. Aggregate loading and error states
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
};