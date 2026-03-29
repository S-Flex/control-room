import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

type LoadingContextType = {
    isLoading: boolean;
    increment: () => void;
    decrement: () => void;
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

/** Loading provider component. */
export const LoadingProvider = ({ children }: { children: React.ReactNode; }) => {
    const [count, setCount] = useState(0);

    const increment = useCallback(() => setCount((c) => c + 1), []);
    const decrement = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);

    const value = React.useMemo(() => ({
        isLoading: count > 0,
        increment,
        decrement,
    }), [count, increment, decrement]);

    return (
        <LoadingContext.Provider value={value}>
            {children}
        </LoadingContext.Provider>
    );
};

/** Anothe loading provider, but this one does nothing but intercept registrations and ignore them. */
export const LoadingBlockerProvider = ({ children }: { children: React.ReactNode; }) => {
    // Provide a context that never triggers loading, and does nothing on increment/decrement
    const value = React.useMemo<LoadingContextType>(() => ({
        isLoading: false,
        increment: () => { },
        decrement: () => { },
    }), []);
    return (
        <LoadingContext.Provider value={value}>
            {children}
        </LoadingContext.Provider>
    );
};

/** Use loading state of closest loading boundary. */
export function useIsLoading() {
    const ctx = useContext(LoadingContext);
    if (!ctx) return false;
    return ctx.isLoading;
}

/** Conditionally sets loading state of any above loading boundary. */
export function useLoadingSubscription(active: boolean) {
    const ctx = useContext(LoadingContext);
    const wasActive = useRef(false);

    useEffect(() => {
        if (!ctx) return;

        const { increment, decrement } = ctx;

        if (active && !wasActive.current) {
            increment();
            wasActive.current = true;
        } else if (!active && wasActive.current) {
            decrement();
            wasActive.current = false;
        }
        return () => {
            if (wasActive.current) {
                decrement();
                wasActive.current = false;
            }
        };
         
    }, [active, ctx]);
}

/** Adds loading state to any above loading boundary. */
export function LoadingSubscriber({ children }: { children?: React.ReactNode; }) {
    useLoadingSubscription(true);
    return children ?? null;
}
