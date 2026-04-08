# Control Room

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Control Room is a React-based industrial monitoring application built with Vite, TypeScript, and React. It renders 3D production line views, data-driven sidebar widgets, and timeline visualizations. The application uses a data-driven architecture where UI components are dynamically rendered based on backend API responses (DataGroups).

## Development Commands

```bash
# Start development server with HMR
npm run dev

# Build for production
npm run build

# Type-check without emitting
npx tsc --noEmit
```

## Project Structure

```
src/                     — Application source code (React + TypeScript)
  hooks/                 — Custom hooks (useProductionLineOverview, etc.)
  widgets/               — Widget components (TimelineBar, DonutChart, InkGauge)
  SidebarPanel.tsx       — Sidebar with data-driven widget rendering
  ProductionLinesPage.tsx — Main page with 3D view, timeline, controls
  ControlRoomPage.tsx    — Dashboard overview page
  DataGroupPage.tsx      — Debug page for inspecting data groups
  app.css                — All application styles
packages/                — Internal shared packages (local, aliased via vite + tsconfig)
  xfw-three/             — Three.js 3D model viewer
  xfw-get-block/         — Localization (getBlock, setLanguage)
data/                    — JSON data files served by vite dev server
```

## Rules

### Protected Directories
- **Never edit files in `packages/` without explicit user permission.** These are shared internal packages. Always ask before modifying any file under `packages/`.

### Data & i18n
- All user-facing text must go through `getBlock()` from `xfw-get-block` for localization.
- JSON data files use `content` arrays with `code`, `block` (containing `title`, `i18n`) pattern.
- Supported languages are defined in `packages/xfw-get-block/languages.json`.

### Code Style
- TypeScript strict mode enabled.
- Local packages are aliased via `tsconfig.json` paths and `vite.config.ts` resolve aliases.
- Run `npx tsc --noEmit` to verify compilation after changes.

## Architecture

### Data-Driven Architecture

The application follows a data-driven pattern where UI is dynamically generated based on API responses:

1. **Data Groups** (`DataGroup` type): Define what data to fetch and how to display it
   - `src`: API endpoint identifier (or `[primarySrc, metaSrc]` tuple)
   - `params`: `ParamDefinition[]` — parameters needed for the query
   - `layout`: Determines which widget renders (timeline-bar, donut-chart, ink-gauge, etc.)
   - `widget_config`: Field mappings specific to the widget

2. **Data Flow**:
   - `useDataGeneric(dataGroup)` orchestrates all fetching and parameter management
   - It reads URL query params via `useQueryParams` for params marked `is_query_param`
   - It reads context params via `useOverrideParams`
   - It fetches schema (`DataTable`) and data rows in parallel
   - Mandatory param validation gates data fetching

3. **Parameter System** (params flow through three sources):
   - **URL query params** (`useQueryParams` from `@s-flex/xfw-url`): For params with `is_query_param: true` on the `DataTable`
   - **Override params** (`useOverrideParams` from `@s-flex/xfw-url`): Context-inherited params
   - **Default values**: From `ParamDefinition.default_value` or `ParamDefinition.val`

### Routing System

Uses `xfw-url` for URL-driven state management with auxiliary routes:

- **Main Route**: Primary page content
- **Auxiliary Routes**: Overlays using parenthesis syntax: `/page(sidebar:help//popup:confirm)`
- **Query Params**: `?model=sheet&from=...&until=...&resource=...`

### Widget System

Widgets in `src/widgets/` receive `widgetConfig` (field mappings) and `data` (rows) from the sidebar:

- **TimelineBar**: Timeline visualization with grouping, idle gap detection, enlarged overlay on hover
- **DonutChart**: Aggregated state distribution chart
- **InkGauge**: Ink level/usage progress bars

The `SidebarPanel` loads sidebar config, fetches data groups, and dispatches to `WidgetRenderer` based on `dataGroup.layout`.

### Package Import Paths

Packages are aliased in `tsconfig.json` and `vite.config.ts`:

```typescript
// npm packages (migrated from local packages/)
import { useDataGeneric, type DataGroup } from '@s-flex/xfw-data';
import { useQueryParams, useNavigate } from '@s-flex/xfw-url';

// Local packages (aliased in tsconfig.json + vite.config.ts)
import { getBlock } from 'xfw-get-block';
import { ThreeModelView } from 'xfw-three';
```

### Key Types (from `@s-flex/xfw-data`)

- `DataGroup` — Widget configuration: src, params, layout, widget_config
- `DataTable` — Schema from API: primary_keys, params (with `is_query_param`), schema
- `ParamDefinition` — Parameter slot: key, is_query_param, is_optional, is_ident_only, default_value
- `ParamValue` — Resolved parameter: key, val
- `JSONValue` / `JSONRecord` — Recursive JSON types
- `ApiResult<T>` — Discriminated union: `{ ok: true, data: T } | { ok: false, error, code }`

### API Integration

- Base URL configured via `configureClient()` in `xfw-data`
- All requests go through `apiRequest()` which handles auth tokens, error handling
- Endpoints: `/api/Query/data-table/{src}`, `/api/Query/data-row/{src}`, `/api/Query/mutation/{src}`
- TanStack Query v5 for caching and state management
