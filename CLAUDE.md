# Control Room

This file provides guidance to Claude Code when working with code in this repository.

## Project overview

Control Room is a React-based industrial monitoring application built with Vite, TypeScript, and React. It renders 3D production line views, data-driven sidebar widgets, and timeline visualizations. The application uses a data-driven architecture where UI components are dynamically rendered based on backend API responses (DataGroups).

## Development commands

```bash
npm run dev        # Start development server with HMR + TypeScript checking
npm run build      # Type-check + aux-route lint + build (fails on either)
npx tsc --noEmit   # Type-check without emitting
npm run check:aux-routes  # Run the aux-route lint by hand
```

## Project structure

```
src/                            React + TypeScript app
  hooks/                        Custom hooks (useProductionLineOverview, …)
  controls/                     Reusable controls (SearchBox, Field, Badge, Toggle, …)
  widgets/                      Widgets (FlowBoard, Cards, Content, TimelineBar,
                                DonutChart, InkGauge, ActivityGauge, StackedBar, …)
  lib/urlSync.ts                The only sanctioned URL writer
  lib/auxRouteGuard.ts          Aux-route runtime guard (installed in main.tsx)
  SidebarPanel.tsx              Sidebar with data-driven widget rendering
  ProductionLinesPage.tsx       Main page with 3D view, timeline, controls
  ControlRoomPage.tsx           Dashboard overview page
  DataGroupPage.tsx             Debug page for inspecting data groups
  app.css                       All app styles
packages/                       Internal aliased packages — DO NOT EDIT
  xfw-three/                    Three.js model viewer
  xfw-get-block/                Localisation (getBlock, setLanguage)
data/                           JSON data served by the dev server
scripts/check-aux-routes.mjs    Aux-route lint (pre-commit + build)
docs/xfw-examples/              Reference JSONs (generated from xfw-library)
```

## Rules

### Protected directories
- **Never edit files in `packages/` without explicit user permission.** These are shared internal packages. Always ask before modifying any file under `packages/`.
- **Never patch `node_modules/`** — patches are unmaintainable and were removed from this project.

### xfw-library first

**Before writing any new component, hook, utility, or type: check the xfw-library.**

The three core packages are:
- `node_modules/@s-flex/xfw-data/README.md` — data fetching, DataGroup, DataTable, param system
- `node_modules/@s-flex/xfw-ui/README.md` — UI components, hooks, providers
- `node_modules/@s-flex/xfw-url/README.md` — routing, URL state, query params

When a section in this file disagrees with the library README, the library wins.

**Workflow:**
1. Read the relevant README(s) before writing code.
2. Use existing exports when they fit — don't re-implement what the library already provides.
3. Verify a library export exists before importing (`grep` the README, then confirm in `node_modules/@s-flex/xfw-*/dist/index.d.ts`).
4. If the library does not cover a use case, build it locally (next section).

### Local controls and widgets

When something is needed that the xfw-library does not provide, build it in this repo:
- Reusable UI controls (inputs, toggles, chips, tooltips, …) go in **`src/controls/`**.
- Data/widget components (timelines, gauges, cards, …) go in **`src/widgets/`**.

Import locally, e.g. `import { Toggle } from './controls/Toggle'`. Keep these components generic and reusable — semantics in data, not hard-coded in the component.

### Code style
- TypeScript strict mode — the dev server shows type errors in real-time via `vite-plugin-checker`. **Fix all type errors before committing.**
- `npm run build` will **fail** on type errors and on aux-route lint failures. Do not bypass either.
- Only import components/types that actually exist in the library. Verify exports before using them.
- No custom solutions when the library already provides one.
- All components must be generic and reusable — semantics in data, not in code.
- Business logic belongs in JSON / `field_config` / `DataGroup`, not in component code.

### Selection state is one shared visual

**Selected / checked / active state must look the same across every list-style control** — dropdown-list (Select), DropdownMenu items, cascading Menu, language picker, sidebar items, etc. The user reads "this is the picked one" once, and that signal must mean the same thing everywhere.

**The visual is a tinted div with a brand border** — never a checkmark glyph. Specifically:
- background `var(--brand-pale)`
- `box-shadow: inset 0 0 0 1px var(--brand)` for the border (use box-shadow, not `border`, so row height stays stable regardless of selection)
- `font-weight: 500` on the label
- `color: var(--text-primary)` so it stays readable on light + dark themes

This visual lives on `.dropdown-menu-item.active` in `app.css` and is mirrored onto `[role="option"][aria-selected="true"]` for the React Aria Select, with the trailing check-icon hidden via `display: none`.

Rules:
- One CSS class / pattern drives the look. Every list-style control that has a "this row is picked" state reuses it. Do not invent a new highlight per component.
- If the xfw-ui / React Aria component ships its own selection glyph (a checkmark, dot, etc.), **hide it** and rely on the shared border+tint. Two signals competing is worse than one consistent one.
- Same one-style-fits-all applies to hover, focus, and disabled — one shared treatment, not per-component variations.
- Before adding a new selection style, check whether `.dropdown-menu-item.active` already covers it. If the existing style is wrong for the new context, change the shared style — don't fork it.
- This is part of the "generic over local" rule: when you find yourself styling selection state inside a specific component's CSS scope, stop and lift the style to the shared class instead.

---

## Where data comes from

All data flows through `@s-flex/xfw-data`. The single entry point used by widgets is
`useDataGeneric(dataGroup, params)`, which orchestrates the schema + row fetch.

| Field | Type | Description |
|---|---|---|
| `dataTable` | `DataTable` | Schema: `primary_keys`, `params`, `schema: Record<string, PgField>` |
| `dataRows` | `T[]` | Live editable rows (preserved during refetch) |
| `originalData` | `ReadonlyArray<T>` | Last server-confirmed snapshot (for `revert`) |
| `setLocalData` | `(updater) => void` | Local edits, no network |
| `mutate` | `(rows: T[]) => void` | POST `/api/Query/mutation/:src`; cache merged on success |
| `revert` | `() => void` | Drop local edits |
| `refetchDataRows` | `() => void` | Re-trigger fetch |
| `metaDataTable`/`metaData` | tuple side | When `dataGroup.src` is `[primarySrc, metaSrc]` |

`dataGroup.edit.update_mutations` chooses the save model: `"direct"` (per change), `"save"`
(buffered until commit), `"batch"` (multi-row flush).

Other hooks worth knowing:

- `useDataRows<T>(src, params, opts?, idKey?)` — rows-only variant.
- `useDatatable(src)` — schema only, `staleTime: 3600000`.
- `useDataGroups(src)` — fetch the `DataGroup[]` config row.
- `useMinimalDiffRows<T>(rows)` — keyed-diff stabiliser; reuses references when `block_json`
  is unchanged, sorts by `sort_order` if present.
- Low-level (non-React): `fetchDatatable`, `fetchDataRow(s)`, `updateDataRow(s)`,
  `apiRequest`, `uploadFile`. All return `ApiResult<T>` (`{ ok: true, data }` or
  `{ ok: false, error, code, status? }`).

Setup is a one-time `configureClient({ baseUrl, getToken })` at app start. Endpoints:
- `/api/Query/data-table/{src}`
- `/api/Query/data-row/{src}`
- `/api/Query/mutation/{src}`

TanStack Query v5 handles caching and state management.

## Row identity

The library does **not** stamp `_track_by` on rows. Stable row identity is the contract of
`dataTable.primary_keys`. Build a string key from those when you need one:

```ts
const buildRowKey = (row, primaryKeys) =>
  primaryKeys.map(k => String(row[k] ?? '')).join('||');
```

Where primary keys are unavailable or unstable across in-flight clones, this repo stamps a
numeric `track_by` index in `src/widgets/DataGroup.tsx` (`DataGroupContent`) the moment data
arrives from the API. `track_by` survives the row spreads that `toggleChecked` /
`mergeData` perform (object identity wouldn't), so it's the canonical id used by search,
prev/next navigation, and `data-search-track`.

Never use array index as a React `key`.

## field_config & PgField

`DataGroup.field_config: Record<string, FieldConfig>` is keyed by the schema field name and
overrides the schema-level `PgField.ui` for that DataGroup.

```ts
type FieldConfig = {
  type?: string;            // overrides the widget inferred from pg_type
  input_data?: InputData;   // options source for select-style widgets
  ui?: Partial<UI>;         // overrides PgField.ui
};

type UI = {
  i18n?: Record<Language, Record<string, string>>;  // 'nl' | 'en' | 'de' | 'fr' | 'uk'
  order?: number;
  hidden?: boolean;
  hidden_when?: unknown;     // evaluated by isNavItemHidden(item, row)
  read_only?: boolean;
  group?: { title?: string; class_name?: string };
  table?: { sortable?: boolean; width?: number; hidden?: boolean };
  chart_role?: 'x' | 'y' | 'value' | 'name' | 'group' | 'class_name';
};
```

Widget inference (`resolveWidget`):

1. `fieldConfig.type` → returned as-is
2. `pg_type === 'date'` → `'date'`
3. `pg_type === 'timestamptz'` → `'datetime'`
4. `prop.ref` present → `'select'`
5. `prop.items` present → `'group'` (array)
6. numeric `pg_type` (`int4`/`int2`/`int8`/`numeric`) → `'number'`
7. `pg_type === 'bool'` → `'checkbox'`
8. `pg_type === 'jsonb'` → `'group'`
9. default → `'text'`

`resolveField(key, prop, override?, fieldConfig?)` produces a `ResolvedField` ready for
rendering — it merges UI overrides and recurses into nested `fields` / `items`.

`InputData` for select-like widgets is either a reference to a named source
(`{ src, value_key, label_key }`) or inline `options`.

## ParamDefinition / ParamValue

```ts
type ParamDefinition = {
  key: string;
  is_optional?: boolean;     // fetch proceeds without it
  is_query_param?: boolean;  // read from URL ?key=...
  is_ident_only?: boolean;   // not sent to API; identity-only
  default_value?: JSONValue;
};
type ParamValue = { key: string; val: JSONValue };
```

Param flow:

1. URL query → `useQueryParams(params)` (auto-coerces numbers, JSON, `;`-arrays).
2. Context overrides → `useOverrideParams(filter?)` (override-by-key).
3. Mandatory params (`is_optional !== true && is_ident_only !== true`) gate the data fetch.

**Casing seam:** `@s-flex/xfw-data` uses snake_case (`is_query_param`,
`is_optional`, `is_ident_only`, `default_value`); `@s-flex/xfw-url` exposes camelCase
(`isQueryParam`, `isOptional`, `isIdentOnly`, `defaultValue`). The DataGroup payload from
the API is snake_case — convert at the boundary.

## Key types (from `@s-flex/xfw-data`)

| Type | Description |
|---|---|
| `DataGroup` | Widget config: `src`, `params`, `layout`, `widget_config`, `field_config` |
| `DataTable` | API schema: `primary_keys`, `params`, `schema` |
| `ParamDefinition` | Parameter slot definition |
| `ParamValue` | Resolved parameter: `key` + `val` |
| `JSONValue` / `JSONRecord` | Recursive JSON types |
| `ApiResult<T>` | `{ ok: true, data: T } \| { ok: false, error, code }` |

## Sorting

- Field/column display order: `field_config[k].ui.order`.
- Row order: `useMinimalDiffRows` sorts by `row.sort_order` when present; otherwise the
  API's natural order wins.
- User-triggered column sort is **UI state only** — never mutate the data array.
  `dataTable.schema[k].ui.table.sortable` declares whether a column is sortable.

## Search / filter (local)

The library has no generic search hook; the components are local to this repo:

- `src/controls/SearchBox.tsx` — input, highlight/filter mode toggle, prev/next, custom
  clear button. `useSearchState()` exposes `query` (live input), `appliedQuery`
  (committed via Enter or `commit()`), `mode`, `currentIndex`, and `commit()`.
- `src/widgets/searchUtils.ts` — `rowMatches(row, query, fields)` is a case-insensitive
  substring match against scalar dot-paths (objects are deliberately skipped, not
  stringified, to avoid every row matching short queries through JSON punctuation).
  `readSearchFields(source)` reads a `search: string[]` field-list off any config record.
- `src/widgets/flow/SearchableLevel.tsx` — wraps a flow-board level with a SearchBox, owns
  the search state, prunes empty parent group_by columns in filter mode, walks
  DOM-ordered `[data-search-track]` to populate prev/next.
- `src/widgets/flow/FlowSearchContext.tsx` — exposes `matchedTracks: Set<number>`,
  `focusedTrack`, and `highlight` to leaf cards.

Configuration:

- Cards / Content: `dataGroup.search: ["field_a", "field_b"]` at the data-group root.
- Flow-Board: `flow_board_config.search: [...]` on any level (root, `flow-container`, …).

Execution model:

- Typing updates `query`; the **applied query commits on Enter** (or via the prev/next
  buttons, which call `commit()` first).
- Match identity is `row.track_by`.
- Matched cards add `included-in-search`; focused card adds `search-focus`.
- In `flow-table`, field labels live in their own `.flow-table-header` div outside the
  card surface, so the label band is never highlighted.
- The SearchBox is sticky (`position: sticky; top: 0`) while there's text in the input
  and falls back to normal flow when empty.

## groupBy

No library hook. Local helpers in `src/widgets/flow/utils.ts`:

- `groupRowsByFields(rows, fields)` — bucket by string-joined field values.
- `applyFilterGroup(rows, filter)` — OR-of-ANDs filter rules (`FlowFilterGroup`).
- `getGroupByKeys(level)` — collect referenced keys from the level config.
- `buildGroupFields` — assembles `FlowFieldEntry[]` for a group.

Group headers come from i18n labels (`resolveI18nLabel(i18n, key)` with `toDisplayLabel`
fallback), not from hardcoded strings.

## CRUD / mutations

- `dataGroup.edit.update_mutations: 'direct' | 'save' | 'batch'` chooses the model.
- Local edits: `setLocalData(rows => …)`.
- Server save: `mutate(rows)` — POSTs to `/api/Query/mutation/:src`, merges the response
  into the cache on success.
- Discard: `revert()`.
- Validation before save: `validateRecord(data, dataTable.schema)` →
  `{ valid, errors: ValidationError[] }`. Errors carry stable `ValidationErrorCode`
  values: `REQUIRED`, `NOT_A_NUMBER`, `OUT_OF_RANGE`, `EXCEEDS_PRECISION`, `NOT_BOOLEAN`,
  `EXCEEDS_MAX_LENGTH`, `INVALID_UUID`, `INVALID_DATE`, `INVALID_TIMESTAMP`,
  `UNEXPECTED_TYPE`, `NOT_AN_ARRAY`, `NOT_AN_OBJECT`, …

There is no per-row `_crud` field, no `useGrid` hook, no `_match_class` injection — those
patterns from earlier drafts are not part of the library and should not be introduced.
Treat "this row is being edited / dirty / new" as ephemeral UI state in component-local
state, not on the row.

---

## Routing & URL state

`@s-flex/xfw-url` encodes all view state into the URL:

```
/path/segments(outlet:val//outlet:val)?key=val&key=val
```

| Hook / fn | Purpose |
|---|---|
| `useQueryParams(params)` | Read URL query params (auto-coerced) |
| `useNavigate()` | Stable navigate; accepts string partial-path or `NavigateParams` |
| `useAuxOutlet({ outlet })` | Current path for an aux outlet |
| `useMainRoute()` | Main path with aux routes stripped |
| `useOverrideParams(filter?)` | Read context-injected params |
| `parseFullPath` / `composeFullPath` | Pure URL utilities |

### Aux-route separator is `//`, never `/`

This rule is load-bearing in this repo. When two or more auxiliary outlets appear in the
same URL, they are joined by a **double** slash — e.g. `(sidebar:orderlines//detail:uploader-data)`.
A single slash is wrong and collapses the two outlets into one. This rule applies to:

- Data JSON values (`nav.path`, `on_select.path`, `menu-items.path`, etc.).
- String literals passed to `navigate(...)`.
- Any manual string composition of outlet paths in widgets/hooks.
- Snapshots / screenshots / docs that reference aux-route URLs.

Do **not** change `//` to `/` in aux routes during simplify, review, or refactor passes —
even if it looks like a typo or duplicate slash. Preserve the `//` exactly.

### Always go through `src/lib/urlSync.ts` for URL writes

```typescript
import { syncQueryParams, rewriteUrl } from './lib/urlSync';

// Update / remove specific query params (null = remove).
syncQueryParams({ model: 'sheet', resource_uids: null });

// Mutate the full query-param Map yourself.
rewriteUrl(qp => { qp.delete('selected'); qp.set('from', iso); });
```

Both helpers round-trip through xfw-url's `parseFullPath` (forgiving, accepts either slash
form) and `composeFullPath` (always re-emits `//`), so the URL bar stays correct no matter
how many times you sync. Use them for every URL-write — page-state effects, click handlers,
switch-line callbacks, etc.

**Never write the URL via `window.history.replaceState(null, '', `${window.location.pathname}?…`)`.**
`window.location.pathname` returns whatever the browser/router last normalised, which can
already be the collapsed single-slash form. Writing it back permanently overwrites the
correct `//` that `composeFullPath` originally emitted.

Direct calls to `window.history.replaceState` / `pushState` outside `src/lib/urlSync.ts`
are forbidden in app code. If you spot one in a PR, treat it as a bug — it will silently
collapse aux-route `//` separators.

### If `//` aux routes appear broken at runtime, clear Vite's dep cache

`@s-flex/xfw-url`'s `dist/index.js` already contains a forgiving parser that handles both
`//` and a collapsed `/`. But Vite pre-bundles `node_modules` into
`node_modules/.vite/deps/` and does not reliably invalidate that cache when the package is
updated. Symptom: the current `dist/index.js` has the regex
`split(/\/+(?=[A-Za-z_][A-Za-z0-9_-]*:)/)` but `.vite/deps/chunk-*.js` still has the old
`split("//")`.

```bash
rm -rf node_modules/.vite
# then restart: npm run dev
```

Do not patch `node_modules/@s-flex/xfw-url/**` — the dist is already correct. Do not search
the app source for `/` vs `//` — the compose/parse logic lives in xfw-url, not in app code.

### Belt-and-braces: the runtime guard

App-level discipline isn't enough because **React Router's internal `resolveTo` collapses
`//`** as well (it runs `joinPaths(...).replace(/\/\/+/g, "/")` on every `to` argument
before pushing to history). A correctly-composed `(a:1//b:2)` becomes `(a:1/b:2)` *inside*
the router, before the browser ever sees it.

`src/lib/auxRouteGuard.ts` defends against this:
- **Boot-time self-test** — verifies `composeFullPath` actually emits `//`. Throws a loud
  error at startup if a stale Vite dep cache (or any other regression) shipped the old
  single-slash version, with the exact fix command in the message
  (`rm -rf node_modules/.vite && npm run dev`).
- **Continuous integrity guard** — patches `pushState`/`replaceState` to fire DOM events,
  listens to those + `popstate`, and after every navigation re-canonicalises the URL via
  `parseFullPath` → `composeFullPath`. If the current URL doesn't match the canonical form,
  it calls `replaceState` to restore `//` and logs `[aux-route-guard] URL collapsed; restoring //`
  with before/after for diagnostics.

The guard is installed once in `src/main.tsx` via `installAuxRouteGuard()`. Do **not**
remove that call. The check is idempotent (canonical-vs-canonical comparison) so it cannot
infinite-loop, and it's free when the URL is already correct
(`window.location.pathname.includes('(')` short-circuits non-aux URLs).

If you see `[aux-route-guard] URL collapsed; restoring //` in the console: that means
React Router (or some other code path) drifted the URL and the guard auto-corrected. The
app is working — but if you want to silence the warning, find the upstream
`replaceState`/`pushState`/`navigate` call that produced the broken form and route it
through `urlSync.ts` instead.

### Pre-commit lint

`scripts/check-aux-routes.mjs` enforces the rules at commit time so they can never
silently regress. It scans `src/` and `data/` for three patterns and fails the commit on
any hit:

1. `history.{push,replace}State` outside `src/lib/{auxRouteGuard,urlSync}.ts`.
2. URL composition that reads `${window.location.pathname}` (the back-channel for the
   collapsed-pathname bug).
3. Aux-outlet expressions `(...)` whose `key:val` pairs are joined by `/` instead of `//`.
   Both `.ts/.tsx/.js` source and `.json` data are scanned.

Wired in two places:

- `package.json`:
  - `scripts.check:aux-routes` — run manually with `npm run check:aux-routes`.
  - `scripts.build` runs the lint before `vite build`, so CI/prod builds fail fast.
  - `scripts.prepare` sets `git config core.hooksPath .githooks` on every `npm install`,
    activating the hook for new clones.
- `.githooks/pre-commit` — runs the lint on staged `src/` and `data/` files. Checked into
  the repo so cloning + `npm install` is enough; no Husky / extra deps required.

If a deliberate exception is genuinely necessary (very rare), use the per-line escape
`// aux-routes-allow` on the same line. Always justify with a comment above. The helpers
themselves (`auxRouteGuard.ts`, `urlSync.ts`) and the linter script live in the file
allowlist.

---

## Provider stack

Outermost → innermost (combining xfw-ui + xfw-url requirements):

```
QueryClientProvider
  QueryParamProvider
    BrowserRouter
      NavigationProvider
        AriaRouterProvider          # only if React Aria links are used
          ThemeProvider
            LoadingProvider
              SidebarProvider
                CallbackProvider
                  <App />
```

`AuxRouteProvider` goes inside the layout, after `BrowserRouter` is already in the tree.

## Hooks at a glance

### From `@s-flex/xfw-data`
`useDataGeneric`, `useDataRows`, `useDatatable`, `useDataGroups`, `useMinimalDiffRows`,
`subscribeToken`, plus the imperative `fetch*`/`update*` and `apiRequest`/`uploadFile`.

### From `@s-flex/xfw-ui`
`useNavItemAction` (events → CallbackProvider → navigate),
`useNotification` (toasts via Sonner),
`useUpload` (multipart + progress + socket events),
`useEvents` (declarative `eventBus` listeners; `string` callbacks resolved by
`CallbackProvider` key),
`useBreakpoint`, `useClipboard`, `useArrayNavigation`, `useDebouncedCallback`,
`useNodeDrag`, `useResizeObserver`, `useI18n`, `useTheme`, `useIsLoading`,
`useLoadingSubscription`, `useSidebarContext`, `useCallbackContext`.

### From `@s-flex/xfw-url`
`useQueryParams`, `useNavigate`, `useStableNavigate`, `useHref`, `useAuxOutlet`,
`useAuxRoutes`, `useMainRoute`, `useOverrideParams`, `useSidebar`,
`useQueryParamManager`, `useSidebarContext`.

Local hooks live in `src/hooks/` — only build a new one if no library hook fits.

## Components

Use the library first; build locally only when nothing fits.

| Layer (xfw-ui) | Examples |
|---|---|
| Data components (consume a `DataGroup`) | `DataGroupComponent`, `DataContent`, `DataFormComponent`, `DataTableComponent`, `DataCardsComponent`, `DataItemComponent`, `DataCharts`, `DataFlowGraphEditorComponent`, `DataFormulaEditor`, `DataLoginComponent`, `DataThreeResourceViewComponent` |
| Widgets (consume props) | `FormComponent`, `FormField`, `TableComponent`, `NavButtonsComponent`, `LoadingBoundary`, `ErrorBoundary` |
| Layout | `MainMenu`, `SearchComponent`, `Sidebar`, `SidebarPortal`, `HeaderNavigation`, `SectionHeader`, `Tabs` / `Tab` / `TabList` / `TabPanel` |
| Base (React Aria) | `Avatar`, `Badge*`, `Button`, `ButtonGroup`, `Checkbox`, `Input`, `Select`, `MultiSelect`, `Textarea`, `Tooltip` |
| App | `CommandMenu`, `DatePicker`, `DateRangePicker`, `FileUpload*`, `Metrics*`, `Pagination*`, `Toaster` + `notify` |

Local layer: `src/controls/` for reusable UI controls, `src/widgets/` for data/widget
components. All components must be generic — semantics live in data, not in code.

### Local widgets in this repo

Widgets in `src/widgets/` receive `widgetConfig` (field mappings) and `data` (rows):
- **TimelineBar** — timeline with grouping, idle gap detection, enlarged overlay on hover
- **DonutChart** — aggregated state distribution chart
- **InkGauge** — ink level/usage progress bars
- **ActivityGauge** — multi-ring radial gauge with per-cell labels and column tabstrip
- **StackedBar** — stacked bar chart with pinned-domain Y axis
- **FlowBoard / Cards / Item / Content** — generic data-driven layouts

`SidebarPanel` loads config, fetches data groups, dispatches to `WidgetRenderer` based on
`dataGroup.layout`.

---

## i18n & user-facing text

- All user-facing strings go through `getBlock()` from the local `xfw-get-block` package.
- Field labels use `ui.i18n` keyed by BCP 47 locale code: `nl`, `en`, `de`, `fr`, `uk`.
- `resolveLabel(i18n, key, lang)` falls back to `toDisplayLabel(key)` for missing
  translations.
- JSON content uses the `content` array with `code` + `block` (containing `title`, `i18n`).

## Naming

- JSON property names: `snake_case` (`order_id`, `field_config`, `track_by`).
- Code values inside JSON: `kebab-case` (`print-side.ss`, `nl-staging`).
- xfw-url types use camelCase (`isQueryParam`); xfw-data and the API payload use
  snake_case. Keep the boundary clean.

## Import paths

```typescript
// npm packages
import { useDataGeneric, type DataGroup } from '@s-flex/xfw-data';
import { useQueryParams, useNavigate } from '@s-flex/xfw-url';

// Local packages (aliased in tsconfig.json + vite.config.ts)
import { getBlock } from 'xfw-get-block';
import { ThreeModelView } from 'xfw-three';
```

## Example JSONs

For reference JSONs showing which properties to use per component, see `docs/xfw-examples/`.
These are generated from the xfw-library and serve as the single source of truth for JSON
structure.
