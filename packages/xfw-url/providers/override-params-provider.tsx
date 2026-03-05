import React, { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { ParamValue, ParamDefinition } from "../types";

// Context type
type OverrideParamsContextType = ParamValue[];

const OverrideParamsContext = createContext<OverrideParamsContextType>([]);

interface OverrideParamsProviderProps {
    params: ParamValue[];
    children: ReactNode;
}


const OverrideParamsProviderComponent: React.FC<OverrideParamsProviderProps> = ({
    params,
    children,
}) => {
    // 1. Grab parent context.
    const parentParams = useContext(OverrideParamsContext);

    // 2. Merge params: child (current) overrides parent by key.
    const mergedParams = useMemo(() => {
        const paramMap = new Map<string, ParamValue>();

        // 2.1 Add parent params first.
        parentParams.forEach((param) => {
            paramMap.set(param.key, param);
        });

        // 2.2 Then add/override with own params.
        params.forEach((param) => {
            paramMap.set(param.key, param);
        });

        return Array.from(paramMap.values());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...parentParams.map(v => v.val), ...params.map(v => v.val)]);

    return (
        <OverrideParamsContext.Provider value={mergedParams}>
            {children}
        </OverrideParamsContext.Provider>
    );
};

export const OverrideParamsProvider = React.memo(
    OverrideParamsProviderComponent,
    (prevProps, nextProps) => {
        // Deep compare params arrays to prevent unnecessary re-renders
        // Return true if props are equal (should NOT re-render), false otherwise
        return (
            JSON.stringify(prevProps.params) === JSON.stringify(nextProps.params) &&
            prevProps.children === nextProps.children
        );
    }
);

export const useOverrideParams = (filter?: ParamDefinition[] | string[]) => {
    // 1. Grab the context.
    const params = useContext(OverrideParamsContext);

    // 2. Apply filter if any.
    return useMemo(() => {
        // 2.1 No filter, return all.
        if (!filter) return params;

        // 2.2 Determine allowed keys from filter.
        let allowedKeys: Set<string>;
        if (
            Array.isArray(filter) &&
            filter.length > 0 &&
            typeof filter[0] === "object" &&
            filter[0] !== null &&
            "key" in filter[0]
        ) {
            // ParamDefinition[]
            allowedKeys = new Set(
                (filter as ParamDefinition[]).map((def) => def.key)
            );
        } else {
            // string[]
            allowedKeys = new Set(filter as string[]);
        }

        // 2.3 Filter params by allowed keys.
        return params.filter((param) => allowedKeys.has(param.key));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params, ...(filter?.map(f => typeof f === 'string' ? f : f.key).sort() || [])]);
};
