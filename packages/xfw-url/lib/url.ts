import type { ParamValue } from "../types";

export type KeyValue<T = string> = { key: string; val: T; };
export type ParsedFullPath = {
    path?: string;
    outlets: KeyValue[];
    queryParams: ParamValue[];
};

/**
 * Parses a full path string (or path) into path, outlets, and query params.
 * @param urlPath The full path, e.g. /foo/bar(sidebar:help//window:alert)?a=1&b=2
 */
export function parseFullPath(urlPath: string): ParsedFullPath {
    // Split off query string
    const [pathWithOutlets, queryString = ""] = urlPath.split("?");

    // Match path and outlets
    const match = pathWithOutlets.match(/^([^(]+)?(?:\((.+)\))?$/);

    // Remove leading slash from path if present
    let path = match?.[1];
    if (path) path = path.replace(/^\/+/, "");
    const auxString = match?.[2] || "";

    // Parse outlets
    const outlets: KeyValue[] = [];
    if (auxString) {
        for (const part of auxString.split("//")) {
            const [key, val] = part.split(":");
            if (key) outlets.push({ key, val });
        }
    }
    // Parse query params
    const queryParams: ParamValue[] = [];
    if (queryString) {
        const searchParams = new URLSearchParams(queryString);
        for (const [key, val] of searchParams.entries()) {
            queryParams.push({ key, val });
        }
    }
    return { path, outlets, queryParams };
}

/**
 * Composes a URL string from path, outlets, and query params.
 * @param path The base path (should start with /)
 * @param outlets Array of {key, val} for outlets
 * @param queryParams Array of {key, val} for query params
 */
export function composeFullPath(
    path: string,
    outlets: KeyValue<string | undefined>[] = [],
    queryParams: ParamValue[] = []
): string {
    const auxEntries = outlets
        .filter(({ val }) => val !== undefined && val !== null && val !== "")
        .map(({ key, val }) => `${key}:${val}`);

    const outletsString = auxEntries.length > 0 ? `(${auxEntries.join("//")})` : "";
    const searchParams = new URLSearchParams();

    for (const { key, val } of queryParams)
        if (val !== undefined && val !== null && val !== "")
            searchParams.set(key, val.toString());

    const queryString = searchParams.toString();

    // Always remove leading slash from path
    const normalizedPath = path.replace(/^\/+/, "");

    return `/${normalizedPath}${outletsString}${queryString ? `?${queryString}` : ""}`;
}


/**
 * Recombines a path with optional new path, outlets, and query parameters.
 * @param fullPath The existing full path to recombine, e.g. /foo/bar(sidebar:help//window:alert)?a=1&b=2
 * @param path The new path to use (optional)
 * @param outlets The new outlets to use (optional)
 * @param queryParams The new query params to use (optional)
 * @returns The recombined path
 */
export function recombineFullPath(fullPath: string, path?: string, outlets?: KeyValue<string | undefined>[], queryParams?: ParamValue[]): string {
    // 1. Parse existing path
    const parsed = parseFullPath(fullPath);

    // 2. Use existing path if not provided
    path ??= parsed.path!;

    // Always remove leading slash from path
    if (path) path = path.replace(/^\/+/, "");

    // 3. Concat existing (parsed) and new (outlets param) outlets and override duplicate keyed outlets
    const newOutlets = Object.fromEntries(parsed.outlets.map(v => [v.key, v.val]));
    outlets?.forEach(({ key, val }) => { newOutlets[key] = val!; });
    outlets = Object.entries(newOutlets).map(([key, val]) => ({ key, val }));

    // 4. Concat existing (parsed) and new (queryParams param) query params and override duplicate keyed params
    const newQP = Object.fromEntries(parsed.queryParams.map(v => [v.key, v.val]));
    queryParams?.forEach(({ key, val }) => { newQP[key] = val!; });
    queryParams = Object.entries(newQP).map(([key, val]) => ({ key, val }));

    // 5. Compose final URL
    return composeFullPath(path, outlets, queryParams);
}

/**
 * Recombines a full path with a partial path.
 * @param path The existing full path to recombine, e.g. /foo/bar(sidebar:help//window:alert)?a=1&b=2
 * @param partialPath The partial path to apply, e.g. (sidebar:settings)?b=3&c=4 or /newpath?d=5
 * @returns The recombined path
 */
export function recombineFullPathFromPartialPath(path: string, partialPath?: string): string {
    if (!partialPath) return path;
    const parsed = parseFullPath(partialPath);
    return recombineFullPath(path, parsed.path, parsed.outlets, parsed.queryParams);
}


export function fullPathIncludes(fullPath: string, subPath?: string): boolean {
    if (!subPath) return true; // Empty subPath matches all
    const { path: fullBase, outlets: fullOutlets, queryParams: fullQPs } = parseFullPath(fullPath);
    const { path: subBase, outlets: subOutlets, queryParams: subQPs } = parseFullPath(subPath);

    // Normalize leading slashes for comparison
    const normFullBase = fullBase ? fullBase.replace(/^\/+/, "") : fullBase;
    const normSubBase = subBase ? subBase.replace(/^\/+/, "") : subBase;

    return (normSubBase?.length ? (normFullBase === normSubBase) : true)
        && subOutlets.every(so => fullOutlets.some(fo => fo.key === so.key && fo.val === so.val))
        && subQPs.every(sq => fullQPs.some(fq => fq.key === sq.key && fq.val === sq.val));
}
