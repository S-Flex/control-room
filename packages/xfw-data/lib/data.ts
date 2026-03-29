import type { DataGroup, DataTable, JSONRecord, ParamValue, ApiResult } from "../types";
import { apiRequest } from "./client";

export async function fetchDatatable(
    src: string
): Promise<ApiResult<DataTable>> {
    return apiRequest<DataTable>(`/api/Query/data-table/${src}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src }),
    });
}

export async function fetchDataGroups(src: string): Promise<ApiResult<DataGroup[]>> {
    const dd = await (fetchDataRow('get_data_group', [{ key: 'data_group', val: src }]) as Promise<ApiResult<[{ data_group_json: string; }]>>);

    console.log('fetchDataGroups', { src, dd });

    if (!dd.ok) return dd;

    return {
        ok: true,
        data: JSON.parse(dd.data[0].data_group_json) as DataGroup[],
    };
}

export async function fetchDataRow<T = JSONRecord>(src: string, params: ParamValue[]) {
    return apiRequest<T[]>(`/api/Query/data-row/${src}`, {
        method: "POST",
        body: JSON.stringify({ src, params }),
        headers: { "Content-Type": "application/json" },
    });
}

export function fetchDataRows(
    requests: { src: string; params: ParamValue[]; }[]
) {
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
