# xfw-url — Claude Integration Guide

Instructions for Claude Code on how to incorporate the xfw-url package into a React project.

## What this package provides

xfw-url is a URL-driven state management package for React. It provides:

- **URL parsing and composition** for paths with auxiliary routes and query parameters
- **Auxiliary routes (outlets)** — render overlays (sidebars, popups, windows) alongside main content using URL syntax: `/page(sidebar:help//popup:confirm)?param=value`
- **Query parameter management** with automatic cleanup
- **Navigation** that intelligently merges paths, outlets, and query params
- **Sidebar system** — a complete sidebar outlet implementation with context, hooks, and UI components that are driven by the URL

## Dependencies

- `react` (>=18)
- `react-router-dom` (>=6)
- `@tanstack/react-query` (>=5) — used by `QueryParamProvider` for cleanup timing
- `react-aria-components` — used by `AriaRouterProvider` and `Sidebar` nav action links

## How to incorporate into a project

### 1. Copy the package

Copy the `xfw-url` directory into the project (e.g. `src/packages/xfw-url` or `src/lib/xfw-url`). All imports are relative — no path aliases needed.

### 2. Set up providers

Wrap the app with providers **in this order** (outermost first):

```tsx
import {
    QueryParamProvider,
    NavigationProvider,
    AriaRouterProvider,
    SidebarProvider,
} from "./packages/xfw-url";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <QueryParamProvider>
                <BrowserRouter>
                    <NavigationProvider>
                        <AriaRouterProvider>
                            <SidebarProvider>
                                <Layout />
                            </SidebarProvider>
                        </AriaRouterProvider>
                    </NavigationProvider>
                </BrowserRouter>
            </QueryParamProvider>
        </QueryClientProvider>
    );
}
```

**Provider order matters:**

| Provider | Must be inside | Why |
|---|---|---|
| `QueryParamProvider` | `QueryClientProvider` | Uses `useIsFetching()` to time param cleanup |
| `NavigationProvider` | `BrowserRouter` | Uses React Router's `useNavigate()` |
| `AriaRouterProvider` | `NavigationProvider` | Bridges xfw-url navigate to React Aria |
| `SidebarProvider` | `AriaRouterProvider` | So sidebar nav actions can use Link navigation |
| `AuxRouteProvider` | `BrowserRouter` | Uses `useLocation()` — place inside your layout |

### 3. Set up the layout with outlets

In your layout component, use `AuxRouteProvider` to enable auxiliary route parsing, then render sidebars and define outlet routes:

```tsx
import {
    AuxRouteProvider,
    MainRoutes,
    AuxRoutes,
    Sidebar,
    useSidebarContext,
} from "./packages/xfw-url";
import { Route } from "react-router-dom";

function Layout() {
    const { left, right } = useSidebarContext();

    return (
        <AuxRouteProvider>
            <div className="flex flex-row h-screen">
                {/* Left sidebars */}
                {left.map(v => (
                    <Sidebar key={`left-${v.index}`} side="left" idx={v.index} />
                ))}

                {/* Main content */}
                <main className="flex-1 overflow-auto">
                    <MainRoutes>
                        <Route path="/app/dashboard" element={<Dashboard />} />
                        <Route path="/app/products" element={<Products />} />
                    </MainRoutes>
                </main>

                {/* Right sidebars */}
                {right.map(v => (
                    <Sidebar key={`right-${v.index}`} side="right" idx={v.index} />
                ))}

                {/* Auxiliary route outlets — these mount components that register sidebars */}
                <AuxRoutes outlet="sidebar">
                    <Route path="/help" element={<HelpSidebarOutlet />} />
                    <Route path="/settings" element={<SettingsSidebarOutlet />} />
                </AuxRoutes>
            </div>
        </AuxRouteProvider>
    );
}
```

### 4. Create sidebar outlet components

A sidebar outlet reads its path from the auxiliary route and registers sidebar content via `useSidebar`. The sidebar appears when the URL contains the outlet, and disappears when the outlet is cleared.

```tsx
import { useAuxOutlet, useSidebar } from "./packages/xfw-url";
import { XClose } from "@untitledui/icons"; // or any icon library

function HelpSidebarOutlet() {
    const path = useAuxOutlet({ outlet: "sidebar" });

    useSidebar({
        identifier: "help-sidebar",
        side: "right",
        index: 0,
        isVisible: !!path,
        title: "Help",
        content: () => <div>Help content here</div>,
        navs: [
            { key: "close", icon: <XClose className="size-5" />, path: "(sidebar:)" },
        ],
        deps: [path],
    });

    return null; // Rendering is handled by the Sidebar component in the layout
}
```

### 5. Open and close sidebars via URL

Sidebars are controlled entirely through the URL using auxiliary route syntax:

```tsx
import { useNavigate } from "./packages/xfw-url";

function SomeComponent() {
    const navigate = useNavigate();

    // Open a sidebar
    navigate("(sidebar:help)");

    // Close a sidebar (clear the outlet)
    navigate("(sidebar:)");

    // Open sidebar + keep current path and params
    navigate({ outlets: [{ key: "sidebar", val: "settings" }] });

    // Open multiple outlets at once
    navigate("(sidebar:help//popup:confirm)");
}
```

Or use `useHref` for links:

```tsx
import { useHref } from "./packages/xfw-url";

function HelpLink() {
    const href = useHref("(sidebar:help)");
    return <a href={href}>Open Help</a>;
}
```

## URL syntax reference

```
/path/to/page(outlet1:value1//outlet2:value2)?param1=a&param2=b
 ─────┬──────  ──────────────┬──────────────  ────────┬────────
   main path          aux routes               query params
```

| Part | Syntax | Example |
|---|---|---|
| Main path | `/path/segments` | `/app/dashboard` |
| Aux routes | `(name:path//name:path)` | `(sidebar:help//popup:confirm)` |
| Query params | `?key=val&key=val` | `?category=shoes&page=2` |
| Combined | all three | `/app/dashboard(sidebar:help)?tab=general` |

### Partial paths merge into the current URL

| Current URL | Navigate to | Result |
|---|---|---|
| `/app/dash?a=1` | `(sidebar:help)` | `/app/dash(sidebar:help)?a=1` |
| `/app/dash(sidebar:help)` | `(sidebar:)` | `/app/dash` |
| `/app/dash(sidebar:help)` | `/app/products` | `/app/products(sidebar:help)` |

## Sidebar system overview

The sidebar system has three layers:

1. **`SidebarProvider`** — React context that holds all registered sidebar containers. Computes `left`/`right` arrays filtered by visibility and sorted by index.

2. **`useSidebar` hook** — Registers a sidebar container with the provider. Accepts `content` as a factory function, memoized via `deps`. Automatically unregisters on unmount.

3. **`Sidebar` component** — Renders all visible containers for a given `side` + `idx`. Provides collapse/expand toggle and drag-to-resize (10%–50% of viewport).

### Layered sidebars

Multiple sidebars can render at different indices. Lower indices render closer to the center:

```tsx
// Primary sidebar at index 5
useSidebar({ identifier: "nav", side: "right", index: 5, ... });

// Detail sidebar at index 10 (renders further out)
useSidebar({ identifier: "detail", side: "right", index: 10, ... });
```

### Alternative: SidebarPortal component

For simpler cases where you don't need memoization control:

```tsx
import { SidebarPortal } from "./packages/xfw-url";

<SidebarPortal identifier="settings" side="right" index={0} isVisible={isOpen}>
    <SettingsForm />
</SidebarPortal>
```

## Exports reference

### Types
`JSONValue`, `JSONRecord`, `ParamDefinition`, `ParamValue`, `KeyValue`, `ParsedFullPath`, `NavigateParams`, `StableNavigateFunction`, `SidebarSide`, `SidebarNavAction`, `SidebarContainer`

### URL utilities
`parseFullPath`, `composeFullPath`, `recombineFullPath`, `recombineFullPathFromPartialPath`, `fullPathIncludes`

### Hooks
`useAuxRoutes`, `useQueryParams`, `useNavigate`, `useHref`, `useSidebar`

### Providers
`AuxRouteProvider`, `QueryParamProvider`, `OverrideParamsProvider`, `NavigationProvider`, `AriaRouterProvider`, `SidebarProvider`

### Provider hooks
`useAuxOutlet`, `useMainRoute`, `useQueryParamManager`, `useOverrideParams`, `useStableNavigate`, `useSidebarContext`

### Components
`MainRoutes`, `AuxRoutes`, `Sidebar`, `SidebarPortal`

## File structure

```
xfw-url/
├── index.ts                          # Barrel export
├── README.md                         # User documentation
├── CLAUDE.md                         # This file — Claude integration guide
├── types/
│   └── index.ts                      # All type definitions
├── lib/
│   └── url.ts                        # Pure URL parse/compose/recombine functions
├── hooks/
│   ├── use-aux-routes.ts             # Parse auxiliary routes from pathname
│   ├── use-query-params.ts           # Read & subscribe to URL query params
│   ├── use-navigate.ts               # URL-aware navigation
│   ├── use-href.ts                   # Resolve partial paths to full hrefs
│   └── use-sidebar.ts               # Register sidebar containers
├── providers/
│   ├── aux-route-provider.tsx        # Aux route context + MainRoutes/AuxRoutes
│   ├── query-param-provider.tsx      # Automatic query param cleanup
│   ├── override-params-provider.tsx  # Context-injected params
│   ├── navigation-provider.tsx       # Stable navigate function
│   ├── aria-router-provider.tsx      # React Aria bridge (optional)
│   └── sidebar-provider.tsx          # Sidebar container context
└── components/
    ├── sidebar.tsx                   # Sidebar display (resize, collapse, render)
    └── sidebar-portal.tsx           # Declarative sidebar registration
```
