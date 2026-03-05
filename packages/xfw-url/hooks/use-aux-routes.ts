import { useMemo } from "react";
import { useLocation } from "react-router-dom";

export function useAuxRoutes() {
    const { pathname } = useLocation();

    // Memoize parsing to avoid recalculating on every render
    return useMemo(() => {
        // Split main vs. aux: e.g. "/xfw/en/dashboard(sidebar:help//window:alert)"
        const match = pathname.match(/^([^()]+)(?:\((.+)\))?$/);

        const main = match?.[1] || "/";
        const auxString = match?.[2] || "";

        const aux: Record<string, string> = {};
        if (auxString) {
            for (const part of auxString.split("//")) {
                const [name, path] = part.split(":");
                if (name && path) aux[name] = "/" + path;
            }
        }

        return { main, aux };
    }, [pathname]);
}
