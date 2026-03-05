import { useIsFetching } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Global query param reference counter and removal queue.
 *
 * Using global state instead of React state because:
 * - State changes don't need to trigger re-renders.
 */
const queryParamCounters = new Map<string, number>();
const removalQueue = new Set<string>();

interface QueryParamContextType {
    addParamRef: (key: string) => void;
    removeParamRef: (key: string) => void;
}

const QueryParamContext = createContext<QueryParamContextType | null>(null);

/**
 * Manages query parameter lifecycle to automatically clean up unused params.
 *
 * Problem: Query params from previous pages can't be immediately removed during route changes
 * because the new page might depend on them during its data loading cascade
 * (route change -> data-content fetch -> content render -> data-* fetch).
 *
 * Solution: Reference counting with TanStack Query integration:
 * - Each useQueryParams hook increments a counter when it mounts.
 * - Decrements when it unmounts.
 * - When counter reaches 0, queues param for removal.
 * - Only removes queued params after all TanStack queries are idle + 1 second buffer in case of unaccounted-for latency.
 */
export const QueryParamProvider = ({ children }: { children: ReactNode; }) => {
    const isFetching = useIsFetching();
    const processingQueue = useRef(false);
    const cleanupTimerRef = useRef<number | null>(null);

    // Triggers useEffect re-run when queue changes, even if isFetching hasn't changed.
    // Necessary because removeParamRef is called during cleanup effects,
    // which happens after the current render and its effects have already run.
    const [queueVersion, setQueueVersion] = useState(0);

    const addParamRef = useCallback((key: string) => {
        const currentCount = queryParamCounters.get(key) || 0;
        queryParamCounters.set(key, currentCount + 1);

        // If this param was queued for removal, cancel it.
        // Happens when navigating back to a page that uses this param or the new page needs it.
        const wasInQueue = removalQueue.has(key);
        removalQueue.delete(key);

        if (wasInQueue) {
            setQueueVersion(v => v + 1);
        }
    }, []);

    const removeParamRef = useCallback((key: string) => {
        const currentCount = queryParamCounters.get(key) || 0;
        const newCount = Math.max(0, currentCount - 1);
        queryParamCounters.set(key, newCount);

        // Queue for removal if no components are using this param.
        // Don't remove immediately because queries might still be fetching.
        if (newCount === 0) {
            removalQueue.add(key);
            // Trigger cleanup check even if isFetching hasn't changed
            setQueueVersion(v => v + 1);
        }
    }, []);

    // Process removal queue when all queries are idle
    useEffect(() => {
        // Cancel cleanup if new queries start.
        // Prevents removing params while data is still being fetched.
        if (isFetching > 0 && cleanupTimerRef.current) {
            clearTimeout(cleanupTimerRef.current);
            cleanupTimerRef.current = null;
            processingQueue.current = false;
        }

        // Start cleanup timer when queries are idle and queue has items
        if (isFetching === 0 && removalQueue.size > 0 && !processingQueue.current) {
            processingQueue.current = true;

            // Wait 1 second after queries finish to allow new components to mount.
            // Handles race conditions where cleanup runs before new page components register their params.
            cleanupTimerRef.current = setTimeout(() => {
                const searchParams = new URLSearchParams(window.location.search);
                let hasChanges = false;

                // Only remove params that still have zero references.
                // Protects against params that were re-added during the 1-second delay.
                removalQueue.forEach(key => {
                    if (queryParamCounters.get(key) === 0) {
                        if (searchParams.has(key)) {
                            searchParams.delete(key);
                            hasChanges = true;
                        }
                        queryParamCounters.delete(key);
                    }
                });

                // Batch URL update to avoid multiple history entries
                if (hasChanges) {
                    const newSearch = searchParams.toString();
                    const newUrl = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}${window.location.hash}`;
                    window.history.replaceState(window.history.state, '', newUrl);
                }

                removalQueue.clear();
                processingQueue.current = false;
                cleanupTimerRef.current = null;
                setQueueVersion(v => v + 1);
            }, 1000);
        }
    }, [isFetching, queueVersion]);

    const contextValue: QueryParamContextType = useMemo(() => ({
        addParamRef,
        removeParamRef,
    }), [addParamRef, removeParamRef]);


    return (
        <QueryParamContext.Provider value={contextValue}>
            {children}
        </QueryParamContext.Provider>
    );
};

export const useQueryParamManager = () => {
    const context = useContext(QueryParamContext);
    if (!context) {
        throw new Error("useQueryParamManager must be used within QueryParamProvider");
    }
    return context;
};
