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
    const dd = await fetchDataRow<{ get_data_group: DataGroup[]; }>('get_data_group', [{ key: 'data_group', val: src }]);

    if (!dd.ok) return dd;

    return {
        ok: true as const,
        data: dd.data[0].get_data_group,
    };
}

function resolveDynamicParams(params: ParamValue[]): ParamValue[] {
    return params.map(p => {
        if (p.val === 'now()') return { ...p, val: new Date().toISOString() };
        if (p.val === 'weekDay()') return { ...p, val: new Date().getDay() };
        if (typeof p.val === 'object' && p.val !== null) return { ...p, val: JSON.stringify(p.val) };
        return p;
    });
}

export async function fetchDataRow<T = JSONRecord>(src: string, params: ParamValue[]) {
    const resolved = resolveDynamicParams(params);
    return apiRequest<T[]>(`/api/Query/data-row/${src}`, {
        method: "POST",
        body: JSON.stringify({ src, params: resolved }),
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
