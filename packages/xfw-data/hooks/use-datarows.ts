import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useCallback } from "react";
import type { JSONRecord, ParamValue } from "../types";
import { fetchDataRow, updateDataRow } from "../lib/data";

function mergeRowsById(oldRows: JSONRecord[], newRows: JSONRecord[], idKey = "id") {
    const map = new Map(oldRows.map((row) => [row[idKey], row]));
    for (const newRow of newRows) {
        map.set(newRow[idKey], { ...map.get(newRow[idKey]), ...newRow });
    }
    return Array.from(map.values());
}

const deepClone = <T>(data: T) => structuredClone<T>(data);

export function useDataRows<T = JSONRecord>(
    src: string,
    param: ParamValue[],
    queryOpts: Partial<Parameters<typeof useQuery>[0]> = {},
    idKey: string = "id"
) {
    const queryClient = useQueryClient();
    const originalKey = useMemo(() => ["dataRows", src, param], [src, param]);
    const liveKey = useMemo(() => ["dataRows", src, param, "live"], [src, param]);

    const originalQuery = useQuery({
        ...queryOpts,
        // eslint-disable-next-line @tanstack/query/exhaustive-deps
        queryKey: originalKey,
        queryFn: async () => {
            const result = await fetchDataRow<T>(src, param);
            if (!result.ok) throw new Error(result.error);
            return result.data;
        },
    });

    const liveQuery = useQuery({
        // eslint-disable-next-line @tanstack/query/exhaustive-deps
        queryKey: liveKey,
        enabled: !!originalQuery.data,
        queryFn: () => {
            return deepClone(originalQuery.data) as T[];
        },
    });

    const [persistentData, setPersistentData] = useState<T[] | undefined>(undefined);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    useEffect(() => {
        if (liveQuery.isSuccess && liveQuery.data !== undefined) {
            setPersistentData(liveQuery.data);
            if (isInitialLoading) setIsInitialLoading(false);
        }
        /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, [liveQuery.data, liveQuery.isSuccess]);

    useEffect(() => {
        if (originalQuery.data) {
            queryClient.setQueryData(liveKey, deepClone(originalQuery.data));
        }
        /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, [originalQuery.data]);

    const setLocalData = useCallback((updater: (old: T[]) => T[]) => {
        queryClient.setQueryData(liveKey, (old: T[] = []) => updater(old));
    }, [queryClient, liveKey]);

    const revert = useCallback(() => {
        if (!originalQuery.data) return;
        queryClient.setQueryData(liveKey, deepClone(originalQuery.data));
    }, [originalQuery.data, queryClient, liveKey]);

    const mutation = useMutation({
        mutationFn: (update: T[]) =>
            updateDataRow(src, update),
        onSuccess: (serverRows) => {
            if (!serverRows.ok || !serverRows.data?.length) return;

            if (!originalQuery.data) {
                queryClient.setQueryData(originalKey, serverRows.data);
                queryClient.setQueryData(liveKey, serverRows.data);
                return;
            }

            const newData = mergeRowsById(originalQuery.data as JSONRecord[], serverRows.data as JSONRecord[], idKey);
            queryClient.setQueryData(originalKey, newData);
            queryClient.setQueryData(liveKey, deepClone(newData));
        },
    });

    let dataForComponent = liveQuery.data;
    if (
        (dataForComponent === undefined || dataForComponent === null || (Array.isArray(dataForComponent) && dataForComponent.length === 0)) &&
        persistentData !== undefined &&
        !originalQuery.isError
    ) {
        dataForComponent = persistentData;
    }

    return {
        data: dataForComponent as T[] | undefined,
        originalData: originalQuery.data as ReadonlyArray<T> | undefined,
        isLoading: originalQuery.isLoading,
        error: originalQuery.error,
        refetch: originalQuery.refetch,
        dataUpdatedAt: originalQuery.dataUpdatedAt,
        setLocalData,
        mutate: mutation.mutate,
        revert,
        isInitialLoading,
    };
}
