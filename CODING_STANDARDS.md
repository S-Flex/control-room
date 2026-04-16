# Coding Standards Guide

**Control Room - Coding Standards**

Adapted from the XFW Portal React coding standards. Defines the architectural patterns, coding conventions, and best practices for this project.

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [TypeScript Configuration](#2-typescript-configuration)
3. [Component Architecture](#3-component-architecture)
4. [Hook Patterns](#4-hook-patterns)
5. [Type Definitions](#5-type-definitions)
6. [File Organization](#6-file-organization)
7. [Code Style Conventions](#7-code-style-conventions)
8. [Data Flow & State Management](#8-data-flow--state-management)
9. [Error Handling](#9-error-handling)
10. [API Integration](#10-api-integration)

---

## 1. Technology Stack

**Core Technologies:**
- **React 18+** with TypeScript
- **Vite** — Build tool
- **TanStack Query v5** — Data fetching and caching
- **React Router** — Routing with auxiliary route support via `xfw-url`

**npm Packages (migrated from local):**
- `@s-flex/xfw-ui` — Full React component library, hooks, providers, and data-driven layout components. Re-exports types from `xfw-data`. Primary import source for `DataGroup`, `FieldConfig`, `useDataGeneric`, `useDataGroups`, `resolveField`, `buildTableFields`, UI components, and providers.
- `@s-flex/xfw-data` — API client, low-level data hooks (`useDataRows`, `useDatatable`), fetch functions, auth. Import raw types (`JSONRecord`, `JSONValue`, `DataTable`, `ParamValue`) from here when not using `xfw-ui`.
- `@s-flex/xfw-url` — URL-driven state management (query params, aux routes, sidebar system, `useNavigate`)

**Local Packages (aliased via vite + tsconfig):**
- `xfw-three` — Three.js 3D model viewer
- `xfw-get-block` — Localization (`getBlock()`, `getLanguage()`)

---

## 2. TypeScript Configuration

- Strict mode enabled
- Package aliases configured in `tsconfig.json` paths and `vite.config.ts` resolve aliases
- Always run `npx tsc --noEmit` to verify compilation after changes

**Import Patterns:**

```typescript
// npm packages — prefer @s-flex/xfw-ui for components, hooks, and re-exported types
import { useDataGeneric, useDataGroups, type DataGroup, type FieldConfig } from '@s-flex/xfw-ui';
import type { DataTable, JSONRecord, JSONValue } from '@s-flex/xfw-data';
import { useQueryParams, useNavigate } from '@s-flex/xfw-url';

// Local packages (aliased)
import { getBlock, getLanguage } from 'xfw-get-block';
import { ThreeModelView } from 'xfw-three';
```

---

## 3. Component Architecture

### Named Exports

```typescript
// Good — Named export
export function TimelineBar({ widgetConfig, data }: TimelineBarProps) {
  // ...
}

// Bad — Default export
export default function({ widgetConfig, data }) { ... }
```

### Widget Pattern

All widgets follow the same contract:

```typescript
export type WidgetConfig = {
  // Field mappings from data to visual properties
  offset_field: string;
  color_field: string;
};

export function Widget({ widgetConfig, data }: {
  widgetConfig: WidgetConfig;
  data: JSONRecord[];
}) {
  // Resolve fields using dot-notation paths
  const value = resolve(row, widgetConfig.some_field);
}
```

### Field Resolution

Use dot-notation path resolution for nested data access:

```typescript
function resolve(row: JSONRecord, path: string): JSONValue {
  let val: JSONValue = row;
  for (const seg of path.split('.')) {
    if (val === null || typeof val !== 'object' || Array.isArray(val)) return null;
    val = (val as JSONRecord)[seg] ?? null;
  }
  return val;
}
```

---

## 4. Hook Patterns

### Hook Composition

Build complex hooks from simple hooks:

```typescript
// useDataGeneric is provided by @s-flex/xfw-ui — do not reimplement.
// It internally handles: param gathering (URL + context), schema fetch,
// mandatory param validation, data fetch, and loading subscription.
//
// Usage:
const { dataTable, dataRows, isLoading, error, mutate, setLocalData } =
  useDataGeneric(dataGroup);
```

### Data Fetching: Dual Query Pattern

Separate server state from UI state:

```typescript
// Original query — server truth
const originalQuery = useQuery({ queryKey: [...], queryFn: fetchFn });

// Live query — cloned for local edits
const liveQuery = useQuery({
  queryKey: [..., "live"],
  enabled: !!originalQuery.data,
  queryFn: () => structuredClone(originalQuery.data),
});

// Revert to original
const revert = () => queryClient.setQueryData(liveKey, structuredClone(originalQuery.data));
```

---

## 5. Type Definitions

### Discriminated Unions for API Results

```typescript
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ApiErrorCode; status?: number };

// Usage with type narrowing:
const result = await fetchData();
if (result.ok) {
  console.log(result.data);
} else {
  console.error(result.error, result.code);
}
```

### Parameter Types

```typescript
// Definition — declares a parameter slot
export type ParamDefinition = {
  key: string;
  is_optional?: boolean;
  is_query_param?: boolean;   // Value comes from URL query string
  is_ident_only?: boolean;    // Output only, never sent to API
  default_value?: JSONValue;
};

// Value — resolved parameter ready for API
export type ParamValue = {
  key: string;
  val: JSONValue;
};
```

---

## 6. File Organization

```
src/
  hooks/               — Custom hooks
  widgets/             — Widget components (TimelineBar, DonutChart, InkGauge)
  SidebarPanel.tsx     — Sidebar with data-driven widget rendering
  ProductionLinesPage.tsx — Main page
  app.css              — All styles

packages/
  xfw-three/           — Three.js 3D model viewer (local)
  xfw-get-block/       — Localization (local)
```

---

## 7. Code Style Conventions

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `TimelineBar`, `SidebarPanel` |
| Hooks | camelCase with `use` | `useDataGeneric`, `useProductionLineOverview` |
| Types | PascalCase | `TimelineBarConfig`, `ApiResult<T>` |
| Event handlers | camelCase with `handle`/`on` | `handleRefresh`, `onClose` |
| Constants | UPPER_SNAKE_CASE | `DATA_GROUP_NAME` |
| Files (components) | PascalCase | `SidebarPanel.tsx`, `WidgetRenderer.tsx` |
| Files (hooks) | camelCase | `useProductionLineOverview.ts` |
| Files (utils) | camelCase or kebab-case | `resolve.ts`, `utils.ts` |

### Import Organization

```typescript
// 1. React
import { useState, useMemo, useCallback } from 'react';

// 2. Third-party
import { useQuery } from '@tanstack/react-query';

// 3. Internal packages — prefer @s-flex/xfw-ui as the primary import source
import { useDataGeneric, type DataGroup, type FieldConfig } from '@s-flex/xfw-ui';
import type { DataTable, JSONRecord } from '@s-flex/xfw-data';
import { useNavigate } from '@s-flex/xfw-url';

// 4. Local packages
import { getBlock, getLanguage } from 'xfw-get-block';

// 5. Local imports
import { TimelineBar } from './widgets/TimelineBar';
```

### Comments: Explain "Why", Not "What"

```typescript
// Good — explains reasoning
// Clamp from date: if it's after the until date, reset it
if (fromDate > pendingDate) { fromDate = pendingDate; }

// Bad — restates obvious code
// Set fromDate to pendingDate
fromDate = pendingDate;
```

---

## 8. Data Flow & State Management

### Parameter Resolution Order

`useDataGeneric` resolves params from three sources (later wins):

1. **Default values** from `ParamDefinition.default_value`
2. **URL query params** for params with `is_query_param: true` (via `useQueryParams`)
3. **Override params** from context (via `useOverrideParams`)

### Context Inheritance

Override params merge parent and child context — child values win:

```typescript
const OverrideParamsProvider = ({ params, children }) => {
  const parentParams = useContext(OverrideParamsContext);
  const merged = useMemo(() => {
    const map = new Map(parentParams.map(p => [p.key, p]));
    params.forEach(p => map.set(p.key, p));
    return Array.from(map.values());
  }, [parentParams, params]);
  return <OverrideParamsContext.Provider value={merged}>{children}</OverrideParamsContext.Provider>;
};
```

### Loading State

Counter-based loading subscription — components increment/decrement a shared counter:

```typescript
useLoadingSubscription(isLoading && isInitialLoading);
```

---

## 9. Error Handling

- API errors use `ApiResult<T>` discriminated union — check `result.ok` before accessing data
- React Query handles retry, caching, and stale state
- Widget rendering falls back gracefully on missing data (return `null`)

---

## 10. API Integration

### Endpoints

- `POST /api/Query/data-table/{src}` — Fetch schema (DataTable)
- `POST /api/Query/data-row/{src}` — Fetch data rows with params
- `POST /api/Query/mutation/{src}` — Write mutations

### Dynamic Params

Special param values resolved at fetch time:

```typescript
if (p.val === 'now()') return { ...p, val: new Date().toISOString() };
if (p.val === 'weekDay()') return { ...p, val: new Date().getDay() };
```

### TanStack Query Keys

```typescript
// Schema — cached for 1 hour
queryKey: ["datatable", src]

// Data rows — includes params for proper cache invalidation
queryKey: ["dataRows", src, params]
queryKey: ["dataRows", src, params, "live"]  // editable clone
```

---

## Core Principles

1. **Data-Driven UI** — Components render based on DataGroup configuration, not hardcoded layouts
2. **Type Safety** — TypeScript strict mode, discriminated unions for API results
3. **Single Source of Truth** — URL query params drive data fetching via `is_query_param`
4. **Hook Composition** — Build complex hooks from simple, focused hooks
5. **Package Isolation** — Internal packages are self-contained; cross-package imports use aliases
6. **Localization** — All user-facing text comes from `i18n` objects, resolved via `getLanguage()` from `xfw-get-block`. Pattern: `i18n[lang] ?? i18n[Object.keys(i18n)[0]]`. Use `getBlock()` for content blocks.
