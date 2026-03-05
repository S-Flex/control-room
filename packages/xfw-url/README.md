# xfw-url

URL-driven state management for React applications. All application state lives in the URL — query params, auxiliary routes (overlays/sidebars/popups), and navigation — making every state shareable, bookmarkable, and debuggable.

## Philosophy

**State belongs in the URL.** Instead of managing state in React context, Redux, or component state, this package pushes state into the URL. This means:

- Every view is a URL — shareable and bookmarkable
- Browser back/forward works naturally
- No state desync between URL and UI
- Debugging is trivial — just look at the address bar

## Dependencies

- `react` (>=18)
- `react-router-dom` (>=6)
- `@tanstack/react-query` (>=5) — used by `QueryParamProvider` for cleanup timing
- `react-aria-components` — only needed if using `AriaRouterProvider`

## Installation

Copy the `xfw-url` directory into your project (e.g. `src/packages/xfw-url` or `src/lib/xfw-url`).

All imports are relative — no path aliases needed.

## Setup

Wrap your app with the required providers **in this order** (outermost first):

```tsx
import {
    QueryParamProvider,
    NavigationProvider,
    AriaRouterProvider, // optional, only if using react-aria-components
} from "./packages/xfw-url";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <QueryParamProvider>
                <BrowserRouter>
                    <NavigationProvider>
                        <AriaRouterProvider> {/* optional */}
                            <YourRoutes />
                        </AriaRouterProvider>
                    </NavigationProvider>
                </BrowserRouter>
            </QueryParamProvider>
        </QueryClientProvider>
    );
}
```

### Provider order matters

| Provider | Must be inside | Why |
|---|---|---|
| `QueryParamProvider` | `QueryClientProvider` | Uses `useIsFetching()` to time param cleanup |
| `NavigationProvider` | `BrowserRouter` | Uses React Router's `useNavigate()` |
| `AriaRouterProvider` | `NavigationProvider` | Bridges xfw-url navigate to React Aria |
| `AuxRouteProvider` | `BrowserRouter` | Uses `useLocation()` — place inside your layout |

## Core Concepts

### 1. Query Parameters as State

Instead of `useState` for filters, selections, pagination, etc. — use query params:

```
/products?category=shoes&page=2&sort=price
```

Define which params a component needs:

```tsx
import { useQueryParams, type ParamDefinition } from "./packages/xfw-url";

const paramDefs: ParamDefinition[] = [
    { key: "category", isQueryParam: true },
    { key: "page", isQueryParam: true, isOptional: true },
    { key: "sort", isQueryParam: true, isOptional: true },
];

function ProductList() {
    const params = useQueryParams(paramDefs);
    // params = [
    //   { key: "category", val: "shoes" },
    //   { key: "page", val: 2 },        // auto-parsed to number
    //   { key: "sort", val: "price" },
    // ]

    // Use params to fetch data, filter UI, etc.
}
```

**Features:**
- Strings that look like numbers are auto-parsed to `number`
- Strings that look like JSON arrays/objects are auto-parsed
- Param cleanup is automatic — when a component unmounts, its params are removed from the URL after all data fetching settles (1s buffer)

### 2. Auxiliary Routes (Overlays)

Open sidebars, popups, and windows alongside the main content using parenthesis syntax:

```
/app/dashboard(sidebar:settings//popup:confirm)
```

This renders:
- **Main route**: `/app/dashboard`
- **Sidebar outlet**: `/settings`
- **Popup outlet**: `/confirm`

#### Setting up aux routes

In your layout, wrap content with `AuxRouteProvider` and use `MainRoutes` / `AuxRoutes`:

```tsx
import {
    AuxRouteProvider,
    MainRoutes,
    AuxRoutes,
} from "./packages/xfw-url";
import { Route } from "react-router-dom";

function Layout() {
    return (
        <AuxRouteProvider>
            {/* Main page content */}
            <MainRoutes>
                <Route path="/app/dashboard" element={<Dashboard />} />
                <Route path="/app/products" element={<Products />} />
            </MainRoutes>

            {/* Sidebar overlay — only renders when outlet is active */}
            <AuxRoutes outlet="sidebar">
                <Route path="/settings" element={<SettingsSidebar />} />
                <Route path="/help" element={<HelpSidebar />} />
            </AuxRoutes>

            {/* Popup overlay */}
            <AuxRoutes outlet="popup">
                <Route path="/confirm" element={<ConfirmPopup />} />
            </AuxRoutes>
        </AuxRouteProvider>
    );
}
```

### 3. Navigation

Use `useNavigate` for URL-aware navigation that preserves or merges state:

```tsx
import { useNavigate } from "./packages/xfw-url";

function MyComponent() {
    const navigate = useNavigate();

    // Navigate to a new path (replaces main route, keeps outlets and params)
    navigate("/app/products");

    // Open a sidebar (keeps current main route and params)
    navigate("(sidebar:settings)");

    // Close a sidebar (set outlet value to empty)
    navigate({ outlets: [{ key: "sidebar", val: "" }] });

    // Set query params (keeps current path and outlets)
    navigate("?category=shoes&page=1");

    // Combine: change path + set params + open outlet
    navigate("/app/products(sidebar:filters)?category=shoes");

    // Full control with object syntax
    navigate({
        path: "app/products",
        outlets: [{ key: "sidebar", val: "filters" }],
        queryParams: [{ key: "category", val: "shoes" }],
    });

    // Mix: partialPath + additional overrides
    navigate({
        partialPath: "(sidebar:settings)",
        queryParams: [{ key: "tab", val: "general" }],
    });
}
```

### 4. Override Params (Context-Injected Params)

For params that come from component context rather than the URL — e.g., a parent list passing the selected item ID to a child detail view:

```tsx
import { OverrideParamsProvider, useOverrideParams } from "./packages/xfw-url";

function ParentList({ selectedId }) {
    return (
        <OverrideParamsProvider params={[{ key: "itemId", val: selectedId }]}>
            <ChildDetail />
        </OverrideParamsProvider>
    );
}

function ChildDetail() {
    const params = useOverrideParams(["itemId"]);
    // params = [{ key: "itemId", val: 42 }]
}
```

Override params nest and merge — child providers override parent providers by key.

### 5. Links with `useHref`

For `<a>` tags or React Aria components that need an `href`, use `useHref` which resolves partial paths against the current URL:

```tsx
import { useHref } from "./packages/xfw-url";

function NavLink() {
    const href = useHref("(sidebar:help)");
    // If current URL is /app/dashboard?page=1
    // href = /app/dashboard(sidebar:help)?page=1

    return <a href={href}>Help</a>;
}
```

## URL Syntax Reference

```
/path/to/page(outlet1:value1//outlet2:value2)?param1=a&param2=b
 ─────┬──────  ──────────────┬──────────────  ────────┬────────
   main path          aux routes               query params
```

| Part | Syntax | Example |
|---|---|---|
| Main path | `/path/segments` | `/app/en/dashboard` |
| Aux routes | `(name:path//name:path)` | `(sidebar:settings//popup:confirm)` |
| Query params | `?key=val&key=val` | `?category=shoes&page=2` |
| Combined | all three | `/app/dashboard(sidebar:help)?tab=general` |

### Partial paths

When navigating, you can provide partial paths that merge into the current URL:

| Current URL | Partial path | Result |
|---|---|---|
| `/app/dash?a=1` | `(sidebar:help)` | `/app/dash(sidebar:help)?a=1` |
| `/app/dash(sidebar:help)?a=1` | `?b=2` | `/app/dash(sidebar:help)?a=1&b=2` |
| `/app/dash(sidebar:help)` | `/app/products` | `/app/products(sidebar:help)` |
| `/app/dash(sidebar:help)` | `(sidebar:)` | `/app/dash` |

## URL Utility Functions

For advanced use cases, the URL parsing/composing functions are available directly:

```tsx
import {
    parseFullPath,
    composeFullPath,
    recombineFullPath,
    recombineFullPathFromPartialPath,
    fullPathIncludes,
} from "./packages/xfw-url";

// Parse a URL into its components
const parsed = parseFullPath("/app/dash(sidebar:help)?page=2");
// { path: "app/dash", outlets: [{key:"sidebar",val:"help"}], queryParams: [{key:"page",val:"2"}] }

// Compose components back into a URL
const url = composeFullPath("app/dash", [{key:"sidebar",val:"help"}], [{key:"page",val:"2"}]);
// "/app/dash(sidebar:help)?page=2"

// Merge new values into an existing URL
const merged = recombineFullPath("/app/dash?a=1", undefined, undefined, [{key:"b",val:"2"}]);
// "/app/dash?a=1&b=2"

// Check if a URL contains a sub-path
fullPathIncludes("/app/dash(sidebar:help)?a=1", "(sidebar:help)"); // true
fullPathIncludes("/app/dash?a=1", "?b=2"); // false
```

## Type Reference

```tsx
// A value that can be serialized to/from a URL query param
type JSONValue = string | number | boolean | null | JSONRecord | JSONValue[];
type JSONRecord = { [key: string]: JSONValue };

// Defines a query parameter a component needs
type ParamDefinition = {
    key: string;
    isOptional?: boolean;      // if false/missing, param is required
    isQueryParam?: boolean;    // if true, read from URL query string
    isIdentOnly?: boolean;     // output-only param, not used for data fetching
    defaultValue?: JSONValue;
};

// A resolved parameter key-value pair
type ParamValue = {
    key: string;
    val: JSONValue;
};

// Navigation parameters — string shorthand or full object
type NavigateParams = string | {
    partialPath?: string;
    path?: string;
    outlets?: KeyValue[];
    queryParams?: ParamValue[];
};
```

## File Structure

```
xfw-url/
├── index.ts                          # Barrel export
├── types/
│   └── index.ts                      # JSONValue, ParamDefinition, ParamValue
├── lib/
│   └── url.ts                        # Pure URL parse/compose/recombine functions
├── hooks/
│   ├── use-aux-routes.ts             # Parse auxiliary routes from pathname
│   ├── use-query-params.ts           # Read & subscribe to URL query params
│   ├── use-navigate.ts               # URL-aware navigation
│   └── use-href.ts                   # Resolve partial paths to full hrefs
└── providers/
    ├── aux-route-provider.tsx         # Aux route context + MainRoutes/AuxRoutes
    ├── query-param-provider.tsx       # Automatic query param cleanup
    ├── override-params-provider.tsx   # Context-injected params
    ├── navigation-provider.tsx        # Stable navigate function
    └── aria-router-provider.tsx       # React Aria bridge (optional)
```
