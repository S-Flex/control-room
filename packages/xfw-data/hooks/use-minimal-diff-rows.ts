import type { JSONValue } from "../types";
import { useEffect, useState } from "react";

type BlockRow = { block_json?: unknown; sort_order?: number; [key: string]: unknown; };

const badKeys = ["data_group_json", "widget_id", "gridTemplateRows"];
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
    if (Array.isArray(a) !== Array.isArray(b)) {
        // One is array, one is not
        return false;
    }
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

const sortOnSortOrder = (a: BlockRow, b: BlockRow) => (a.sort_order ?? 0) - (b.sort_order ?? 0);


export function useMinimalDiffRows(data?: BlockRow[] | null) {
    const [rows, setRows] = useState<BlockRow[] | null>(null);
    const [lastDataRef, setLastDataRef] = useState<BlockRow[] | null>(null);

    useEffect(() => {
        if (!data) return;

        // 1. Initial load.
        if (!rows) return setRows(data.sort(sortOnSortOrder));

        // 2. Skip processing if data reference hasn't changed
        if (data === lastDataRef) {
            return;
        }
        setLastDataRef(data);

        // 3. Clone old and new data for mutation and sorting.

        const oldData: BlockRow[] = [...rows];
        const newData: BlockRow[] = [...data].sort(sortOnSortOrder);

        // 4. Create a map of existing items by block_json for efficient lookup

        const oldItemsMap = new Map<string, BlockRow>();
        for (let i = 0; i < oldData.length; i++) {
            const key = JSON.stringify(oldData[i]?.block_json);
            oldItemsMap.set(key, oldData[i]);
        }

        // 5. Build new array preserving references for unchanged items

        const result: BlockRow[] = [];
        for (let i = 0; i < newData.length; i++) {
            const newItem = newData[i];
            const key = JSON.stringify(newItem?.block_json);
            const existingItem = oldItemsMap.get(key);

            // Cast block_json to unknown first, then JSONValue for deepCompare
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
                // New item or content has changed - use new reference
                result.push(newItem);
            }
        }

        // 6. Update state with the new array maintaining object references for unchanged items
        setRows(result);
    }, [data, lastDataRef, rows]);

    return rows;
}
