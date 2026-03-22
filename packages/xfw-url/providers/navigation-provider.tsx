import { parseFullPath, recombineFullPath, recombineFullPathFromPartialPath, type KeyValue } from "../lib/url";
import type { ParamValue } from "../types";
import { createContext, useContext, useRef, type ReactNode } from "react";
import { useNavigate as rrUseNavigate, type NavigateOptions } from "react-router-dom";

export type NavigateParams = {
    partialPath?: string;
    path?: string;
    outlets?: KeyValue[];
    queryParams?: ParamValue[];
} | string;

export type StableNavigateFunction = (params: NavigateParams, opts?: NavigateOptions) => void | Promise<void>;

// Export the context so it can be imported separately
export const NavigationContext = createContext<StableNavigateFunction | null>(null);

export const NavigationProvider = ({ children }: { children: ReactNode; }) => {
    const rrNavigate = rrUseNavigate();
    const rrNavigateRef = useRef(rrNavigate);
    rrNavigateRef.current = rrNavigate;
    const navigateRef = useRef<StableNavigateFunction>(null);

    // Create the stable navigate function once, but always use latest rrNavigate via ref
    if (!navigateRef.current) {
        navigateRef.current = (params: NavigateParams, opts: NavigateOptions = { replace: false, preventScrollReset: true }) => {
            // 1. Shape current full path (decode to handle encoded aux routes)
            const fullPath = decodeURIComponent(window.location.pathname) + window.location.search;

            // 2. If string, treat as partialPath
            if (typeof params === "string") {
                const newPath = recombineFullPathFromPartialPath(fullPath, params);
                if (newPath === fullPath) return;
                return rrNavigateRef.current(newPath, opts);
            }

            // eslint-disable-next-line prefer-const
            let { partialPath, path, outlets, queryParams } = params;

            // 3. If partialPath provided, parse and merge
            if (partialPath) {
                const parsed = parseFullPath(partialPath); // Ensure valid format

                path ??= parsed.path;
                outlets = parsed.outlets.concat(outlets ?? []);
                queryParams = parsed.queryParams?.concat(queryParams ?? []);
            }

            // 4. Recombine URL.
            const newPath = recombineFullPath(
                fullPath,
                path,
                outlets,
                queryParams
            );

            // 5. Early return if path hasn't changed to prevent unnecessary navigation
            if (newPath === fullPath) {
                return;
            }

            // 6. Navigate
            return rrNavigateRef.current(newPath, opts);
        };
    }

    return (
        <NavigationContext.Provider value={navigateRef.current}>
            {children}
        </NavigationContext.Provider>
    );
};

export const useStableNavigate = (): StableNavigateFunction => {
    const navigate = useContext(NavigationContext);
    if (!navigate) {
        throw new Error("useStableNavigate must be used within a NavigationProvider");
    }
    return navigate;
};
