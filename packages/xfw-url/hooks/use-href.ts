import { recombineFullPathFromPartialPath } from "../lib/url";
import { useMemo } from "react";
import { useHref as rrUseHref } from "react-router-dom";

export const useHref = (originalPath: string, opts?: Parameters<typeof rrUseHref>[1]) => {
    const path = useMemo(() => {
        return recombineFullPathFromPartialPath(window.location.pathname + window.location.search, originalPath);
    }, [originalPath]);

    return rrUseHref(path, opts);
};
