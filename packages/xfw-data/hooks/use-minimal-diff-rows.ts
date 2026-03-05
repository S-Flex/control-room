import { useEffect, useState } from "react";
import type { JSONValue } from "../types";

export type DiffableRow = {
    block_json?: unknown;
    sort_order?: number;
    [key: string]: unknown;
};

const badKeys = ["dataGroupJSON", "widgetId", "gridTemplateRows"];

const deepCompare = (a: JSONValue, b: JSONValue): boolean => {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepCompare(a[i], b[i])) return false;
        }
        return true;
    }
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (typeof a === "object" && typeof b === "object") {
        const aObj = a as Record<string, JSONValue>;
        const bObj = b as Record<string, JSONValue>;
        const aKeys = Object.keys(aObj).filter((v) => !badKeys.includes(v));
        const bKeys = Object.keys(bObj).filter((v) => !badKeys.includes(v));
        if (aKeys.length !== bKeys.length) return false;
        for (const key of aKeys) {
            if (!Object.hasOwnProperty.call(bObj, key)) return false;
            if (!deepCompare(aObj[key], bObj[key])) return false;
        }
        return true;
    }
    return false;
};

const sortOnSortOrder = (a: DiffableRow, b: DiffableRow) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0);

export function useMinimalDiffRows<T extends DiffableRow>(data?: T[] | null) {
    const [rows, setRows] = useState<T[] | null>(null);
    const [lastDataRef, setLastDataRef] = useState<T[] | null>(null);

    useEffect(() => {
        if (!data) return;

        if (!rows) return setRows([...data].sort(sortOnSortOrder));

        if (data === lastDataRef) return;
        setLastDataRef(data);

        const oldData = [...rows];
        const newData = [...data].sort(sortOnSortOrder);

        const oldItemsMap = new Map<string, T>();
        for (let i = 0; i < oldData.length; i++) {
            const key = JSON.stringify(oldData[i]?.block_json);
            oldItemsMap.set(key, oldData[i]);
        }

        const result: T[] = [];
        for (let i = 0; i < newData.length; i++) {
            const newItem = newData[i];
            const key = JSON.stringify(newItem?.block_json);
            const existingItem = oldItemsMap.get(key);

            if (
                existingItem &&
                deepCompare(
                    existingItem.block_json as unknown as JSONValue,
                    newItem.block_json as unknown as JSONValue
                )
            ) {
                const preservedItem = existingItem;
                preservedItem.sort_order = newItem.sort_order;
                result.push(preservedItem);
            } else {
                result.push(newItem);
            }
        }

        setRows(result);
    }, [data, lastDataRef, rows]);

    return rows;
}
