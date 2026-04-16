# Dashboard: c-level management

## Purpose

A single page giving management a complete view of the factory in under 2 minutes.
No navigation required — everything visible without clicking. Drill-down via the existing sidebar.

---

## Stack

- React 19 + TypeScript
- Tailwind CSS 4
- `@s-flex/xfw-ui` components (re-exports UntitledUI)
- `@s-flex/xfw-data` API client
- `@s-flex/xfw-url` for routing and sidebar navigation
- `xfw-get-block` for localization
- Dark theme (PROBO standard)
- Refresh: every 5 minutes via TanStack Query polling (`refetchInterval`)

---

## Route

```
/management
```

---

## Data

All data comes from PostgreSQL via the existing API layer (`@s-flex/xfw-data`).
Components consume data via `useDataGeneric` from `@s-flex/xfw-ui` — no direct fetch calls.

### Endpoints

All endpoints use POST (see `@s-flex/xfw-data` API integration):

```
POST /api/Query/data-row/dashboard_management_summary
POST /api/Query/data-row/dashboard_management_halls
POST /api/Query/data-row/dashboard_management_alerts
POST /api/Query/data-row/dashboard_management_trend
```

Parameters are passed via `ParamValue[]`:

```typescript
[{ key: 'period', val: 'today' }]
```

### Summary response shape

```json
{
  "period": "today",
  "jobs_total": 1840,
  "jobs_done": 1203,
  "jobs_late": 47,
  "jobs_target": 1600,
  "sla_pct": 94.2,
  "sla_target": 95.0,
  "oee_pct": 81,
  "oee_target": 82,
  "elapsed_shift_pct": 62,
  "alerts_sla_risk": 2,
  "alerts_total": 4
}
```

### Halls response shape

```json
[
  {
    "hall_id": "H1",
    "i18n": {
      "nl": { "title": "Hal 1", "text": "Groot rol" },
      "en": { "title": "Hall 1", "text": "Large roll" },
      "de": { "title": "Halle 1", "text": "Großrolle" }
    },
    "oee": 81,
    "oee_target": 82,
    "sla": 93.1,
    "sla_target": 95,
    "machines_total": 14,
    "machines_active": 12,
    "alerts": 2,
    "trend_oee": [78, 80, 79, 83, 81, 80, 81]
  }
]
```

---

## Layout

The page consists of six vertical zones, top to bottom:

### Zone 1 — Header

- Left: title from `i18n` (e.g. `{ "en": { "title": "Production overview" }, "nl": { "title": "Productieoverzicht" } }`)
- Subline: date, shift, live timestamp
- Right: period toggle `today | week | month`
- The toggle updates the `period` URL query param (via `useNavigate`), which flows to all DataGroups via `is_query_param: true`

### Zone 2 — KPI strip

Five tiles side by side in a single card:

| Tile | Value | Subline |
|---|---|---|
| Jobs today | `jobs_total` | `jobs_done` done · `jobs_late` late |
| Progress | `jobs_done / jobs_target` as % | target: `jobs_target` jobs |
| Factory OEE | `oee_pct`% | target `oee_target`% · ▲/▼ on/below target |
| On-time SLA | `sla_pct`% | target `sla_target`% · `jobs_late` late |
| OEE trend | sparkline (7 values) | labels mon–sun |

All tile labels come from `i18n` objects in the DataGroup configuration.

Color logic (thresholds from data, not hardcoded):
- Green: on or above target
- Yellow: < 5% below target
- Red: > 5% below target

### Zone 3 — Progress bar

Full width, single bar:
- Filled portion = `jobs_done / jobs_target`
- Vertical marker at `elapsed_shift_pct` with label from `i18n`
- Color: green if `jobs_done / jobs_target >= elapsed_shift_pct - 5`, otherwise yellow

### Zone 4 — Hall table

One row per hall. Columns:

```
ID | Name + type | OEE (arc + %) | SLA (%) | Active machines | Status | 7-day trend
```

- Hall name and type come from `i18n` on each hall record
- OEE column: small SVG arc (44px) + value + delta vs. target
- Status: badge with alert count (red if `alerts > 0`, green otherwise) — labels from `i18n`
- 7-day trend: sparkline, green if rising, red if falling
- Clicking a row navigates via `useNavigate()`:

```typescript
navigate({
  outlets: [{ key: 'sidebar', val: 'hal' }],
  queryParams: [{ key: 'model', val: hall_id }],
});
```

### Zone 5 — SLA risks

Only visible if `alerts_sla_risk > 0`.

Red-highlighted block, one row per alert:
- `machine_id` (monospace font)
- type (badge)
- downtime duration
- impact (e.g. "7 jobs delayed") — from `i18n` with template: `{ "en": { "title": "{count} jobs delayed" } }`

Clicking an alert navigates via `useNavigate()`:

```typescript
navigate({
  outlets: [{ key: 'sidebar', val: 'resource' }],
  queryParams: [{ key: 'resource_uid', val: machine_id }],
});
```

### Zone 6 — Footer

- Left: refresh interval + data source — labels from `i18n`
- Right: SLA status summarised in one line

---

## KPI groups

The ten KPI groups are available as sidebar drill-downs.
The main page only surfaces **Delivery**, **Capacity** and **Machine health**.
The remaining groups are reachable via sidebar navigation.

KPI groups as data (all labels in `i18n`, not as flat strings):

```json
[
  {
    "code": "delivery",
    "icon": "truck",
    "i18n": {
      "nl": { "title": "Levering" },
      "en": { "title": "Delivery" },
      "de": { "title": "Lieferung" }
    }
  },
  {
    "code": "quality",
    "icon": "check-circle",
    "i18n": {
      "nl": { "title": "Kwaliteit" },
      "en": { "title": "Quality" },
      "de": { "title": "Qualität" }
    }
  }
]
```

---

## Behaviour

- Period toggle persists the selected value as a URL query param `?period=today` (via `useNavigate`), not in `localStorage`
- Clicking a hall row: navigate to `(sidebar:hal)?model={hall_id}` via `useNavigate()`
- Clicking an alert: navigate to `(sidebar:resource)?resource_uid={machine_id}` via `useNavigate()`
- Clicking a KPI group: navigate to `(sidebar:kpi)?kpi_code={code}` via `useNavigate()`
- No own modal or popover — sidebar handles everything
- On load: skeleton loaders per zone (not per individual tile)

## Sidebar navigation

The sidebar opens via auxiliary routes (`@s-flex/xfw-url`). Use `useNavigate()`:

```typescript
const navigate = useNavigate();

// Click hall row
navigate({
  outlets: [{ key: 'sidebar', val: 'hal' }],
  queryParams: [{ key: 'model', val: 'H1' }],
});

// Click alert
navigate({
  outlets: [{ key: 'sidebar', val: 'resource' }],
  queryParams: [{ key: 'resource_uid', val: 'H1-P03' }],
});

// Click KPI group
navigate({
  outlets: [{ key: 'sidebar', val: 'kpi' }],
  queryParams: [{ key: 'kpi_code', val: 'delivery' }],
});
```

The sidebar parameter is part of the URL path (aux route), not a query param.
Closing the sidebar removes the aux route outlet.

---

## Color logic (data-driven, not hardcoded)

Thresholds are defined in the DataGroup configuration or data response, not in component code:

```json
{
  "thresholds": {
    "oee":  { "warn": -5, "danger": -10 },
    "sla":  { "warn": -2, "danger": -5 },
    "jobs": { "warn": -10, "danger": -20 }
  }
}
```

Components receive `value`, `target` and `thresholds` — they do not calculate color themselves.
Color calculation lives in a single utility function `getStatusColor(value, target, thresholds)`.

---

## What this page does not do

- No navigation to sub-pages (sidebar handles this)
- No filtering by hall or machine
- No historical charts larger than a sparkline
- No job detail
- No actions or buttons other than the period toggle
