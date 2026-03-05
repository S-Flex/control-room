import type { ApiResult, DataConfig } from "../types";

let config: DataConfig = {
    baseUrl: "",
    getToken: () => null,
};

export function configureClient(newConfig: DataConfig) {
    config = newConfig;
}

export function getClientConfig(): DataConfig {
    return config;
}

export async function apiRequest<T>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
    const url = config.baseUrl + input;

    const headers = new Headers(init?.headers || {});
    const token = config.getToken();
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    let res: Response;
    try {
        res = await fetch(url, { ...init, headers });
    } catch (e) {
        const err = e as unknown;
        const message = typeof (err as { message?: unknown; }).message === "string"
            ? (err as { message: string; }).message
            : "Network error";
        console.error("[xfw-data] Network error in api request", err);
        return { ok: false as const, error: message, code: "network-error" };
    }

    let data: unknown;
    try {
        const text = await res.text();
        data = JSON.parse(text);
    } catch (e) {
        console.error("[xfw-data] Invalid JSON response", e, { response: res });
        return { ok: false as const, error: "Invalid JSON response", code: "invalid-json", status: res.status };
    }

    if (res.ok) {
        return { ok: true, data: data as T };
    } else {
        console.error("[xfw-data] API error", data, { response: res });
        return {
            ok: false as const,
            error: typeof data === "string" ? data : JSON.stringify(data),
            code: "server-error",
            status: res.status,
        };
    }
}
