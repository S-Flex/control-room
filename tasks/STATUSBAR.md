# Component: status bar

## Purpose

A persistent bar fixed to the top of every page in the application.
Gives any role — operator, line manager, director — an immediate read on the factory's
current state without navigating anywhere. Scannable in under 2 seconds.

---

## Stack

- React 19 + TypeScript
- Tailwind CSS 4
- `@s-flex/xfw-ui` components (`BadgeWithDot`, `MetricChangeIndicator`)
- `@s-flex/xfw-data` API client
- `@s-flex/xfw-url` for sidebar navigation (`useNavigate`)
- `xfw-get-block` for localization (`getLanguage`)
- Refresh: every 30 seconds via TanStack Query polling (`refetchInterval`)

---

## Data

All data is fetched via `useDataGeneric` from `@s-flex/xfw-ui` using a DataGroup configuration.
During development, `data/status_bar.json` is served by the Vite dev server.

### Endpoint

```
POST /api/Query/data-row/status_bar
```

No params required — the status bar always shows current factory state.

### Response shape

All labels, segment titles, and display text come from `i18n` objects in the DataGroup
`field_config`, resolved via `getLanguage()` from `xfw-get-block`.

```json
[
  {
    "machine_health": {
      "machines_producing": 81,
      "machines_total": 98,
      "machines_breakdown": 2
    },
    "shift": {
      "i18n": {
        "nl": { "title": "Dagdienst" },
        "en": { "title": "Day shift" }
      },
      "start": "06:00",
      "end": "18:00",
      "elapsed_pct": 0.52,
      "remaining_minutes": 252,
      "staff_present": 84,
      "staff_planned": 90
    },
    "production": {
      "jobs_done": 1203,
      "jobs_target": 1600,
      "on_schedule": false,
      "schedule_delta_pct": -8
    },
    "off_track": {
      "count": 8
    },
    "internal_repairs": {
      "done": 9,
      "total": 14
    },
    "alerts": {
      "breakdowns": 2,
      "total": 4,
      "first_breakdown_resource_uid": "H1-P03"
    }
  }
]
```

---

## Layout

Fixed bar, full width, 52px height, `z-index: 100`.
Single horizontal row of segments separated by dividers.

```
PROBO  12:34  |  Machine health  |  Shift  |  Production  |  Off-track  |  Repairs  |  ——  |  Alerts
```

Left side: stable context (brand, time, health, shift).
Right side: urgent items (off-track, repairs, alerts).
Alerts are always pinned to the far right.

Each segment is clickable and opens the sidebar via `useNavigate()` from `@s-flex/xfw-url`:

```typescript
navigate({
  outlets: [{ key: 'sidebar', val: 'kpi' }],
  queryParams: [{ key: 'kpi_code', val: 'machine-health' }],
});
```

---

## Segments

### Brand + time

```
PROBO  12:34
```

- Probo logo (`/img/probo.svg`) with link to home (same pattern as `DashboardHeader`)
- Live clock, updates every minute client-side
- Not clickable (except logo)
- Always visible, never hidden

---

### Machine health

```
Machine health
81 / 98  ████████░░  2× down
```

**Values from:** `machine_health`

| Field | Display |
|---|---|
| `machines_producing` / `machines_total` | `81 / 98` |
| `machines_breakdown` | `2× down` in red, only shown if > 0 — text from `i18n` |

Color of the fraction (thresholds from data):
- Green: `machines_breakdown === 0`
- Yellow: `machines_breakdown === 1`
- Red: `machines_breakdown >= 2`

**Sidebar on click:**

```typescript
navigate({
  outlets: [{ key: 'sidebar', val: 'kpi' }],
  queryParams: [{ key: 'kpi_code', val: 'machine-health' }],
});
```

---

### Shift

```
Day shift  06:00–18:00
○ arc      84 / 90 people
```

**Values from:** `shift`

| Field | Display |
|---|---|
| `i18n` | Shift name resolved via `getLanguage()` |
| `start` + `end` | `06:00–18:00` |
| `remaining_minutes` | Template from `i18n`: `{ "en": { "title": "{hours}h {minutes}m left" } }` |
| `staff_present` / `staff_planned` | `84 / 90` — label from `i18n` |

Staff color (thresholds from data):
- Green: `staff_present >= staff_planned * 0.95`
- Yellow: `staff_present >= staff_planned * 0.85`
- Red: `staff_present < staff_planned * 0.85`

**Sidebar on click:**

```typescript
navigate({
  outlets: [{ key: 'sidebar', val: 'kpi' }],
  queryParams: [{ key: 'kpi_code', val: 'people' }],
});
```

---

### Production

```
Production
1.203 / 1.600  ▼ 8% behind
```

**Values from:** `production`

| Field | Display |
|---|---|
| `jobs_done` / `jobs_target` | `1.203 / 1.600` |
| `on_schedule` | `MetricChangeIndicator` from `@s-flex/xfw-ui`: on track (green) or behind (yellow/red) — labels from `i18n` |
| `schedule_delta_pct` | Shown in badge when not on schedule |

Badge color (thresholds from data):
- Green: `on_schedule === true`
- Yellow: `schedule_delta_pct >= -10`
- Red: `schedule_delta_pct < -10`

**Sidebar on click:**

```typescript
navigate({
  outlets: [{ key: 'sidebar', val: 'kpi' }],
  queryParams: [{ key: 'kpi_code', val: 'capacity' }],
});
```

---

### Off-track

```
Off-track
8 orders
```

**Values from:** `off_track`

| Field | Display |
|---|---|
| `count` | Number of orders currently off-track — label from `i18n` |

Color (thresholds from data):
- Green: `count === 0`
- Yellow: `count <= 5`
- Red: `count > 5`

Segment gets a red left-border accent when `count > 5`.

**Sidebar on click:**

```typescript
navigate({
  outlets: [{ key: 'sidebar', val: 'kpi' }],
  queryParams: [{ key: 'kpi_code', val: 'delivery' }],
});
```

---

### Internal repairs

```
Internal repairs
9 / 14
```

**Values from:** `internal_repairs`

| Field | Display |
|---|---|
| `done` / `total` | `9 / 14` — label from `i18n` |

Color of the fraction (thresholds from data):
- Green: `done === total`
- Yellow: `done / total >= 0.5`
- Red: `done / total < 0.5`

**Sidebar on click:**

```typescript
navigate({
  outlets: [{ key: 'sidebar', val: 'kpi' }],
  queryParams: [{ key: 'kpi_code', val: 'quality' }],
});
```

---

### Alerts (pinned right)

```
● 2 breakdown   ⚠ 4 alerts
```

**Values from:** `alerts`

| Field | Display |
|---|---|
| `breakdowns` | `BadgeWithDot` from `@s-flex/xfw-ui` — red pulsing dot + count — only shown if > 0, label from `i18n` |
| `total` | Warning badge + count — only shown if > 0, label from `i18n` |

The entire segment has a red left-border accent when `breakdowns > 0`.

This segment is always the rightmost item regardless of viewport width.

**Sidebar on click:**

```typescript
navigate({
  outlets: [{ key: 'sidebar', val: 'resource' }],
  queryParams: [{ key: 'resource_uid', val: first_breakdown_resource_uid }],
});
```

---

## Behaviour

### Clickable segments

Every segment is clickable. On click, navigate via `useNavigate()` to the corresponding
sidebar aux route. Hover state: subtle background highlight.

### Refresh

TanStack Query `refetchInterval: 30000` on the status bar DataGroup.
Update values in place — no flash, no skeleton on refresh.
On first load: show skeleton for each segment until data arrives.

### Urgency order (left to right)

```
Stable ←————————————————————→ Urgent
Brand  Health  Shift  Production  Off-track  Repairs  Alerts
```

Items on the right demand attention. Items on the left provide context.

### Responsive

On narrow screens (< 1024px), collapse secondary visual accents.
Show numbers only. Never hide Alerts or Off-track.

### Offline

When the API cannot be reached, show a dim indicator on the brand segment.
Text from `i18n`. Last known values remain visible until connection is restored.

---

## What this component does not do

- No drill-down of its own — sidebar handles everything
- No filters or toggles
- No historical data
- No job-level detail
