import type { DataGroup, DataTable, JSONRecord, ParamValue } from "../types";
import { apiRequest } from "./client";

export async function fetchDatatable(src: string) {
    return apiRequest<DataTable>(`/api/Query/data-table/${src}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src }),
    });
}

export async function fetchDataGroups(src: string) {
    const dd = await (fetchDataRow('getDataGroup', [{ key: 'dataGroup', val: src }]) as Promise<{ ok: true; data: [{ dataGroupJSON: string; }]; } | { ok: false; error: string; code: string; }>);

    if (!dd.ok) return dd;

    return {
        ok: true as const,
        data: JSON.parse(dd.data[0].dataGroupJSON) as DataGroup[],
    };
}

export async function fetchDataRow<T = JSONRecord>(src: string, params: ParamValue[]) {
    return apiRequest<T[]>(`/api/Query/data-row/${src}`, {
        method: "POST",
        body: JSON.stringify({ src, params }),
        headers: { "Content-Type": "application/json" },
    });
}

export function fetchDataRows(requests: { src: string; params: ParamValue[]; }[]) {
    return Promise.all(requests.map((v) => fetchDataRow(v.src, v.params)));
}

export function updateDataRow<T = JSONRecord>(src: string, data: T[]) {
    return apiRequest<T[]>(`/api/Query/mutation/${src}`, {
        method: "POST",
        body: JSON.stringify({ src, mutations: data }),
        headers: { "Content-Type": "application/json" },
    });
}

export function updateDataRows<T = JSONRecord>(req: { src: string; data: T[]; }[]) {
    return Promise.all(req.map((v) => updateDataRow<T>(v.src, v.data)));
}
