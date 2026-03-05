# xfw-data

Data fetching and mutation layer for React applications. Provides a configurable API client, typed data hooks built on TanStack Query, and file upload utilities.

## Philosophy

**Data access should be declarative.** Instead of manually managing fetch calls, loading states, and cache invalidation, this package provides hooks that handle the full lifecycle: fetching, caching, local editing, and server mutations.

## Dependencies

- `react` (>=18)
- `@tanstack/react-query` (>=5) -- data fetching, caching, and mutations

## Installation

Copy the `xfw-data` directory into your project (e.g. `src/packages/xfw-data` or `src/lib/xfw-data`).

All imports are relative -- no path aliases needed.

## Setup

Configure the API client before rendering your app:

```tsx
import { configureClient } from "./packages/xfw-data";

configureClient({
    baseUrl: "https://your-api.example.com",
    getToken: () => localStorage.getItem("session"),
});
```

Wrap your app with `QueryClientProvider` from TanStack Query:

```tsx
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

const queryClient = new QueryClient();

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <YourRoutes />
        </QueryClientProvider>
    );
}
```

## Core Concepts

### 1. API Client

All requests go through `apiRequest()` which handles URL construction, auth token injection, and typed error handling:

```tsx
import { apiRequest } from "./packages/xfw-data";

const result = await apiRequest<User[]>("/api/users");

if (result.ok) {
    console.log(result.data); // User[]
} else {
    console.error(result.error, result.code); // string, ApiErrorCode
}
```

### 2. Data Table (Schema)

Fetch the schema for a data source:

```tsx
import { useDatatable } from "./packages/xfw-data";

function MyComponent() {
    const { data: schema, isLoading } = useDatatable("products");
    // schema.fields, schema.primaryKeys, schema.params
}
```

### 3. Data Rows (CRUD)

Fetch and mutate data rows with optimistic updates:

```tsx
import { useDataRows } from "./packages/xfw-data";

function ProductList() {
    const params = [{ key: "category", val: "shoes" }];

    const {
        data,           // T[] | undefined (live/editable data)
        originalData,   // ReadonlyArray<T> (server data)
        isLoading,
        setLocalData,   // (updater: (old: T[]) => T[]) => void
        mutate,         // Push changes to server
        revert,         // Reset to server data
    } = useDataRows("products", params);

    // Edit locally
    setLocalData(rows => rows.map(r =>
        r.id === 1 ? { ...r, name: "New Name" } : r
    ));

    // Save to server
    mutate([{ id: 1, name: "New Name" }]);
}
```

### 4. Data Generic (Orchestrator)

Combines schema + data rows + parameter validation in a single hook:

```tsx
import { useDataGeneric } from "./packages/xfw-data";

function DataView({ dataGroup }) {
    const params = [{ key: "category", val: "shoes" }];

    const {
        dataTable,       // Schema
        dataRows,        // Primary data
        metaData,        // Secondary data (for dual-source queries)
        metaDataTable,   // Secondary schema
        isLoading,
        isInitialLoading,
        error,
        refetchDataRows,
        setLocalData,
        mutate,
    } = useDataGeneric(dataGroup, params);
}
```

### 5. File Upload

Upload files with progress tracking:

```tsx
import { uploadFile } from "./packages/xfw-data";

const { promise, cancel } = uploadFile(
    "/api/upload",
    formData,
    (progress) => console.log(`${Math.round(progress * 100)}%`),
    { "X-Custom-Header": "value" }
);

const response = await promise;
```

### 6. Auth Token Management

Built-in token management with localStorage persistence:

```tsx
import { setToken, getToken, clearToken, subscribeToken } from "./packages/xfw-data";

setToken("jwt-token-here");    // Stores in localStorage + notifies subscribers
getToken();                     // Returns current token
clearToken();                   // Removes token

const unsubscribe = subscribeToken((token) => {
    console.log("Token changed:", token);
});
```

## Type Reference

```tsx
type ApiResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string; code: ApiErrorCode; status?: number };

type ApiErrorCode =
    | "network-error" | "invalid-json" | "bad-request"
    | "unauthorized" | "not-found" | "server-error" | "unknown";

type DataConfig = {
    baseUrl: string;
    getToken: () => string | null;
};

type DataTable = {
    src: string;
    primaryKeys: { key: string }[];
    params: ParamDefinition[];
    fields: FieldGroup[];
};

type DataGroup = {
    src: string | [string, string];
    params: ParamDefinition[];
    layout: string;
    // ... see types/index.ts for full definition
};
```

## File Structure

```
xfw-data/
├── index.ts                          # Barrel export
├── types/
│   └── index.ts                      # All type definitions
├── lib/
│   ├── client.ts                     # Configurable API client (apiRequest)
│   ├── data.ts                       # Data fetch/mutation functions
│   ├── upload.ts                     # File upload with progress
│   └── auth.ts                       # Token management
└── hooks/
    ├── use-datatable.ts              # Schema fetching hook
    ├── use-datarows.ts               # Data rows with optimistic updates
    ├── use-datagroup.ts              # Data group configuration fetching
    ├── use-data-generic.ts           # Orchestrator combining schema + data
    └── use-minimal-diff-rows.ts      # Minimal re-render diffing
```
