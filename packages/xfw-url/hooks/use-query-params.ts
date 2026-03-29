import type { ParamDefinition, ParamValue, JSONValue } from "../types";
import { useQueryParamManager } from "../providers/query-param-provider";
import { useCallback, useEffect, useRef, useState } from "react";

declare global {
    interface Window {
        __patchedPushReplaceState?: boolean;
    }
}

// Monkey-patch pushState/replaceState to emit events
const patchHistoryMethod = (type: "pushState" | "replaceState") => {
    const orig = window.history[type];
    return function (this: History, ...args: unknown[]) {
        // Cast args to correct tuple type
        const typedArgs = args as [data: unknown, unused: string, url?: string | URL | null | undefined];
        const ret = orig.apply(this, typedArgs);
        window.dispatchEvent(new Event(type));
        return ret;
    };
};

const numberRegex = /^-?\d+(\.\d*)?$/;

/** Provides values for the specified query parameters. */
export const useQueryParams = (params: ParamDefinition[]): ParamValue[] => {
    // Get the keys of all query parameters to track
    const toRetrieve = params.filter((p) => p.is_query_param && !p.is_ident_only).map((p) => p.key);

    // Helper to get the relevant param values
    const getRelevantParams = useCallback(() => {
        const searchParams = new URLSearchParams(window.location.search);

        return toRetrieve.map((key): ParamValue => {
            let val: JSONValue = searchParams.get(key);

            if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
                try {
                    val = JSON.parse(val) as JSONValue;
                } catch { /* empty */ }
            }

            if (typeof val === 'string' && numberRegex.exec(val)) {
                val = parseFloat(val);
            }

            return { key, val };
        });
    }, [toRetrieve]);

    const [values, setValues] = useState<ParamValue[]>(getRelevantParams);
    const prevValues = useRef(values);
    const trackedKeys = useRef<string[]>([]);
    const { addParamRef, removeParamRef } = useQueryParamManager();

    useEffect(() => {
        // Add references for all tracked params
        toRetrieve.forEach(key => addParamRef(key));
        trackedKeys.current = toRetrieve;

        return () => {
            // Remove references when component unmounts
            trackedKeys.current.forEach(key => removeParamRef(key));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [addParamRef, removeParamRef, toRetrieve.join(',')]); // use joined array to accurately represent all param keys without resizing issues

    useEffect(() => {
        // Helper to compare arrays of param values
        const areParamsEqual = (a: ParamValue[], b: ParamValue[]) => {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (a[i].key !== b[i].key) return false;
                if (JSON.stringify(a[i].val) !== JSON.stringify(b[i].val)) return false;
            }
            return true;
        };

        const checkForChange = () => {
            const newValues = getRelevantParams();
            if (!areParamsEqual(prevValues.current, newValues)) {
                prevValues.current = newValues;
                setValues(newValues);
            }
        };

        // Listen to popstate (back/forward), hashchange, and custom pushState/replaceState events
        window.addEventListener("popstate", checkForChange);
        window.addEventListener("hashchange", checkForChange);
        // Only patch once
        if (!window.__patchedPushReplaceState) {
            window.history.pushState = patchHistoryMethod("pushState");
            window.history.replaceState = patchHistoryMethod("replaceState");
            window.__patchedPushReplaceState = true;
        }
        window.addEventListener("pushState", checkForChange);
        window.addEventListener("replaceState", checkForChange);

        // Initial check in case params changed before effect
        checkForChange();

        return () => {
            window.removeEventListener("popstate", checkForChange);
            window.removeEventListener("hashchange", checkForChange);
            window.removeEventListener("pushState", checkForChange);
            window.removeEventListener("replaceState", checkForChange);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getRelevantParams, params.map(p => p.key).join(',')]); // use joined array to accurately represent all param keys without resizing issues

    return values;
};
