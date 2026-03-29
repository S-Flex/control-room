import { fetchDataRow, updateDataRow } from "../lib/data";
import type { JSONRecord, ParamValue } from "../types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useCallback } from "react";

// Utility to merge server rows into local data by id
function mergeRowsById(oldRows: JSONRecord[], newRows: JSONRecord[], idKey = "id") {
    const map = new Map(oldRows.map((row) => [row[idKey], row]));
    for (const newRow of newRows) {
        map.set(newRow[idKey], { ...map.get(newRow[idKey]), ...newRow });
    }
    return Array.from(map.values());
}

// Use structuredClone for better performance and type preservation
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

    // Query for the original data (from server)
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

    // Query for the live (editable) data, initialized from the original
    const liveQuery = useQuery({
        // eslint-disable-next-line @tanstack/query/exhaustive-deps
        queryKey: liveKey,
        enabled: !!originalQuery.data,
        queryFn: () => {
            // Clone the original data for editing
            return deepClone(originalQuery.data) as T[];
        }
    });


    // Custom persistent data and isInitialLoading
    const [persistentData, setPersistentData] = useState<T[] | undefined>(undefined);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    // Only update persistentData after a successful query (not just any time liveQuery.data is not undefined)
    useEffect(() => {
        if (liveQuery.isSuccess && liveQuery.data !== undefined) {
            setPersistentData(liveQuery.data);
            if (isInitialLoading) setIsInitialLoading(false);
        }
    }
        /* eslint-disable-next-line react-hooks/exhaustive-deps */
        , [liveQuery.data, liveQuery.isSuccess]);

    // Sync live data with original on refetch
    useEffect(() => {
        if (originalQuery.data) {
            queryClient.setQueryData(liveKey, deepClone(originalQuery.data));
        }
    }
        /* eslint-disable-next-line react-hooks/exhaustive-deps */
        , [originalQuery.data]);

    // Set local data (for form editing, etc)
    const setLocalData = useCallback((updater: (old: T[]) => T[]) => {
        queryClient.setQueryData(liveKey, (old: T[] = []) => updater(old));
    }, [queryClient, liveKey]);

    // Revert to original data
    const revert = useCallback(() => {
        if (!originalQuery.data) return;

        queryClient.setQueryData(liveKey, deepClone(originalQuery.data));
    }, [originalQuery.data, queryClient, liveKey]);

    // Mutation: push to server when needed
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

            // Update both original and live data to match server
            const newData = mergeRowsById(originalQuery.data as JSONRecord[], serverRows.data as JSONRecord[], idKey);
            queryClient.setQueryData(originalKey, newData);
            queryClient.setQueryData(liveKey, deepClone(newData));
        },
    });

    // Use persistentData unless query is idle or errored, or new data is available
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
