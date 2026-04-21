# Control Room

This file provides guidance to Claude Code when working with code in this repository.

## Project overview

Control Room is a React-based industrial monitoring application built with Vite, TypeScript, and React. It renders 3D production line views, data-driven sidebar widgets, and timeline visualizations. The application uses a data-driven architecture where UI components are dynamically rendered based on backend API responses (DataGroups).

## Development commands

```bash
npm run dev        # Start development server with HMR + TypeScript checking
npm run build      # Type-check + build for production (fails on type errors)
npx tsc --noEmit   # Type-check without emitting
```

## Project structure

```
src/                        — Application source code (React + TypeScript)
  hooks/                    — Custom hooks (useProductionLineOverview, etc.)
  controls/                 — Reusable UI controls (Toggle, Badge, Chip, Field, …)
  widgets/                  — Widget components (TimelineBar, DonutChart, InkGauge)
  SidebarPanel.tsx           — Sidebar with data-driven widget rendering
  ProductionLinesPage.tsx    — Main page with 3D view, timeline, controls
  ControlRoomPage.tsx        — Dashboard overview page
  DataGroupPage.tsx          — Debug page for inspecting data groups
  app.css                   — All application styles
packages/                   — Internal shared packages (local, aliased via vite + tsconfig)
  xfw-three/                — Three.js 3D model viewer
  xfw-get-block/            — Localization (getBlock, setLanguage)
data/                       — JSON data files served by vite dev server
```

## Rules

### Protected directories
- **Never edit files in `packages/` without explicit user permission.** These are shared internal packages. Always ask before modifying any file under `packages/`.

### xfw-library first

**Before writing any new component, hook, utility, or type: check the xfw-library.**

The three core packages are:
- `node_modules/@s-flex/xfw-data/README.md` — data fetching, DataGroup, DataTable, param system
- `node_modules/@s-flex/xfw-ui/README.md` — UI components
- `node_modules/@s-flex/xfw-url/README.md` — routing, URL state, query params

**Workflow:**
1. Read the relevant README(s) before writing code.
2. Use existing exports when they fit — don't re-implement what the library already provides.
3. If the library does not cover a use case, build it locally (see next section). Do **not** patch `node_modules/` — patches are unmaintainable and were removed from this project.

### Local controls and widgets

When something is needed that the xfw-library does not provide, build it in this repo:
- Reusable UI controls (inputs, toggles, chips, tooltips, …) go in **`src/controls/`**.
- Data/widget components (timelines, gauges, cards, …) go in **`src/widgets/`**.

Import locally, e.g. `import { Toggle } from './controls/Toggle'`. Keep these components generic and reusable — semantics in data, not hard-coded in the component.

### Data & i18n
- All user-facing text must go through `getBlock()` from `xfw-get-block`.
- JSON data files use `content` arrays with `code` + `block` pattern (containing `title`, `i18n`).
- Supported languages are defined in `packages/xfw-get-block/languages.json`.
- Always use `snake_case` for JSON properties and `kebab-case` for code values.

### JSON conventions
- `code` is always kebab-case (e.g., `print-side.ss`)
- JSON properties are always snake_case
- `content` is a flat array — single source of truth for all labels, descriptions, images, and multilingual text
- `i18n` uses BCP 47 locale codes (`nl`, `en`, `fr`, `de`)

### Code style
- TypeScript strict mode — the dev server shows type errors in real-time via `vite-plugin-checker`. **Fix all type errors before committing.**
- `npm run build` will **fail** if there are any TypeScript errors. Do not bypass this.
- Only import components/types that actually exist in the library. Verify exports before using them.
- No custom solutions when the library already provides one.
- All components must be generic and reusable — semantics in data, not in code.
- Business logic belongs in JSON/data, not in component code.

## Architecture

### Data-driven pattern

UI is dynamically generated based on API responses:

1. **DataGroup** — widget configuration: `src`, `params`, `layout`, `widget_config`
2. **DataTable** — schema from API: `primary_keys`, `params` (with `is_query_param`), `schema`
3. **ParamDefinition** — parameter slot: `key`, `is_query_param`, `is_optional`, `is_ident_only`, `default_value`

**Data flow:**
- `useDataGeneric(dataGroup)` orchestrates fetching and parameter management
- URL query params via `useQueryParams` (params with `is_query_param: true`)
- Context params via `useOverrideParams`
- Mandatory param validation gates data fetching

### Routing

Uses `xfw-url` for URL-driven state management:
- **Main route**: Primary page content
- **Auxiliary routes**: Overlays — `/page(sidebar:help//popup:confirm)`
- **Query params**: `?model=sheet&from=...&until=...&resource=...`

**Aux-route separator is `//`, not `/`.** When two or more auxiliary outlets
appear in the same URL, they are joined by a **double** slash — e.g.
`(sidebar:orderlines//detail:uploader-data)`. A single slash is wrong and
collapses the two outlets into one. This rule applies to:
- Data JSON values (`nav.path`, `on_select.path`, `menu-items.path`, etc.).
- String literals passed to `navigate(...)`.
- Any manual string composition of outlet paths in widgets/hooks.
- Snapshots / screenshots / docs that reference aux-route URLs.

Do **not** change `//` to `/` in aux routes during simplify, review, or
refactor passes — even if it looks like a typo or duplicate slash. Preserve
the `//` exactly.

**If `//` aux routes appear broken at runtime, the fix is to clear Vite's
dep cache, not to edit code.** `@s-flex/xfw-url`'s `dist/index.js` already
contains a forgiving parser that handles both `//` and a collapsed `/`. But
Vite pre-bundles `node_modules` into `node_modules/.vite/deps/` and does not
reliably invalidate that cache when the package is updated. Symptom: the
current `dist/index.js` has the regex `split(/\/+(?=[A-Za-z_][A-Za-z0-9_-]*:)/)`
but `.vite/deps/chunk-*.js` still has the old `split("//")`.

Fix:
```bash
rm -rf node_modules/.vite
# then restart: npm run dev
```
Do not patch `node_modules/@s-flex/xfw-url/**` — the dist is already correct.
Do not search the app source for `/` vs `//` — the compose/parse logic lives
in xfw-url, not in app code.

### Widget system

Widgets in `src/widgets/` receive `widgetConfig` (field mappings) and `data` (rows):
- **TimelineBar** — timeline with grouping, idle gap detection, enlarged overlay on hover
- **DonutChart** — aggregated state distribution chart
- **InkGauge** — ink level/usage progress bars

`SidebarPanel` loads config, fetches data groups, dispatches to `WidgetRenderer` based on `dataGroup.layout`.

### Import paths

```typescript
// npm packages
import { useDataGeneric, type DataGroup } from '@s-flex/xfw-data';
import { useQueryParams, useNavigate } from '@s-flex/xfw-url';

// Local packages (aliased in tsconfig.json + vite.config.ts)
import { getBlock } from 'xfw-get-block';
import { ThreeModelView } from 'xfw-three';
```

### Key types (from `@s-flex/xfw-data`)

| Type | Description |
|---|---|
| `DataGroup` | Widget config: src, params, layout, widget_config |
| `DataTable` | API schema: primary_keys, params, schema |
| `ParamDefinition` | Parameter slot definition |
| `ParamValue` | Resolved parameter: key + val |
| `JSONValue` / `JSONRecord` | Recursive JSON types |
| `ApiResult<T>` | `{ ok: true, data: T } \| { ok: false, error, code }` |

### API integration

- Base URL via `configureClient()` in `xfw-data`
- All requests via `apiRequest()` — handles auth tokens and error handling
- Endpoints:
  - `/api/Query/data-table/{src}`
  - `/api/Query/data-row/{src}`
  - `/api/Query/mutation/{src}`
- TanStack Query v5 for caching and state management

## Example JSONs

For reference JSONs showing which properties to use per component, see `docs/xfw-examples/`.
These are generated from the xfw-library and serve as the single source of truth for JSON structure.
