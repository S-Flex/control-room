# PROBO production dashboards — project overview

## What this is

Three new pages added to the existing PROBO application. They share the existing
sidebar, routing, auth, and component library. No new infrastructure required.

---

## Pages

| Page | Route | Audience | Refresh |
|---|---|---|---|
| C-level management | `/management` | Directors, management | 5 min |
| Line manager | `/floor/:hall_id` | Hall supervisors | 30 sec |
| Operator | `/operator/:operator_id` | Machine operators | 10 sec |

---

## File structure

```
control-room/
│
├── tasks/
│   ├── PROJECT.md                    ← this file
│   └── specs/
│       ├── DASHBOARD-management.md   ← c-level page spec
│       ├── DASHBOARD-line-manager.md ← line manager page spec (todo)
│       └── DASHBOARD-operator.md     ← operator page spec
│
├── data/                             ← JSON data files served by vite dev server
│   ├── kpi-groups.json               ← all KPI groups, subgroups, graph types
│   ├── management.json               ← mock data for management page
│   ├── halls.json                    ← mock data for all halls + machines
│   ├── machines.json                 ← mock data for all individual machines
│   ├── operator.json                 ← mock data for operator config + machines
│   └── status-groups.json            ← machine state taxonomy (shared across all pages)
```

## Shared concepts

### Machine states

All pages use the same six machine states defined in `status-groups.json`.
Colors and labels come from data (via `i18n` objects), not from component code.

### Sidebar navigation

All three pages open the existing sidebar via auxiliary routes (see `@s-flex/xfw-url`):

```
(sidebar:hal)?model=model
(sidebar:resource)?resource_uid=resource_uid
(sidebar:kpi)?kpi_code=kpi_code
(sidebar:order)?order_id=order_id
```

Navigation uses `useNavigate()` from `@s-flex/xfw-url`:

```typescript
const navigate = useNavigate();

// Open sidebar with params
navigate({
  outlets: [{ key: 'sidebar', val: 'resource' }],
  queryParams: [{ key: 'resource_uid', val: resourceId }],
});
```

### KPI groups

Ten groups defined in `kpi-groups.json`. Each group has:
- A `code` (kebab-case)
- An `i18n` object with localized labels
- An `icon` (UntitledUI icon name)
- An array of `kpis` with graph type, unit, and thresholds

The management page surfaces three groups directly.
All ten are reachable via `(sidebar:kpi)?kpi_code={code}`.

### i18n

All user-facing text (labels, titles, descriptions, status names) must be in `i18n` objects,
resolved using `getLanguage()` from `xfw-get-block`:

```typescript
const lang = getLanguage();
const localized = i18n[lang] ?? i18n[Object.keys(i18n)[0]];
```

Never hardcode user-facing strings in component code.

### Color logic

One shared utility: `getStatusColor(value, target, thresholds) → 'green' | 'yellow' | 'red'`

Thresholds are defined in data, not in component code. Components receive
`value`, `target`, and `thresholds` — they do not calculate color themselves.

---

## Data strategy

All data is fetched via the existing `@s-flex/xfw-data` API layer using
`useDataGeneric` (from `@s-flex/xfw-ui`) and DataGroup configurations.

During development, JSON files in `data/` are served by the Vite dev server.
Switch to real endpoints by updating the DataGroup `src` configuration.
No changes to component code required — the data-driven architecture handles this.

```typescript
// Components consume data via DataGroups — no direct imports or fetch() calls
const { dataRows, isLoading, error } = useDataGeneric(dataGroup);
```

API endpoints use POST (see `@s-flex/xfw-data` README):
- `POST /api/Query/data-table/{src}` — Fetch schema
- `POST /api/Query/data-row/{src}` — Fetch data rows
- `POST /api/Query/mutation/{src}` — Write mutations

---

## Dependencies

- React 19 + TypeScript
- Tailwind CSS 4
- `@s-flex/xfw-ui` — Component library, data-driven layouts, hooks, providers
- `@s-flex/xfw-data` — API client, auth, data fetching hooks
- `@s-flex/xfw-url` — URL-driven state, aux routes, sidebar system
- `xfw-get-block` — Localization (local package)
- recharts — sparklines and bar charts
- TanStack Query v5 — data fetching and caching
