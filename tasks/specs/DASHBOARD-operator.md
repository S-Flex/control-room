# Dashboard: operator

## Purpose

A personal screen per operator showing only the machines they are running today.
Large, high-contrast, readable from 2–3 metres. Works on touchscreen and wall-mounted TV.
No primary navigation — everything directly visible. Sidebar available for machine detail.

---

## Stack

- React 19 + TypeScript
- Tailwind CSS 4
- `@s-flex/xfw-ui` components (re-exports UntitledUI)
- `@s-flex/xfw-data` API client
- `@s-flex/xfw-url` for routing and sidebar navigation
- `xfw-get-block` for localization
- Dark theme (PROBO standard)
- Refresh: every 10 seconds via TanStack Query polling (`refetchInterval`)

---

## Route

```
/operator/:operator_id
```

The `operator_id` comes purely from the URL. No auth, no session, no login required.
The page relies entirely on the URL parameter to fetch the correct config.

---

## Data

All data is fetched via `useDataGeneric` from `@s-flex/xfw-ui` using DataGroup configurations.
During development, JSON files in `data/` are served by the Vite dev server.

### Endpoints

All endpoints use POST (see `@s-flex/xfw-data` API integration):

```
POST /api/Query/data-row/operator_config        — fetch config for operator
POST /api/Query/mutation/operator_config         — save machine selection
POST /api/Query/data-row/operator_machines       — live data for configured machines
POST /api/Query/data-row/machines_available      — all machines for selection screen
```

Parameters are passed via `ParamValue[]`:

```typescript
[{ key: 'operator_id', val: operatorId }]
```

Saving machine selection uses mutation:

```typescript
const { mutate } = useDataGeneric(dataGroup);
mutate([{ operator_id: operatorId, machine_ids: selectedIds }]);
```

Response shapes match the structure in `data/operator.json`.

---

## Two modes

A button in the top-right corner switches between modes.

### Mode 1 — Work (default)
Live machine cards for all configured machines.

### Mode 2 — Configuration
Full-screen machine selection. Returns to mode 1 after saving.

---

## Mode 1: work

### Card grid

Cards scale automatically:

| Configured machines | Layout |
|---|---|
| 1 | Full width |
| 2 | 2 columns |
| 3–4 | 2 columns, 2 rows |
| 5–6 | 3 columns |

Maximum 6 machines. Warn in configuration mode if more than 6 are selected.

### Card content

```
┌─────────────────────────────────┐
│ H1-P03          Durst P5 350    │  ← machine_id mono + brand
│                                 │
│  ● BREAKDOWN                    │  ← state label from i18n, large, status color
│  Active since 07:34 (2h 20m)   │  ← state_since relative time
│                                 │
│  ────────────────────────────── │
│  Current job                    │  ← label from i18n
│  — none —                       │  ← current_job or placeholder from i18n
│                                 │
│  Next job                       │  ← label from i18n
│  J-48291                        │
│  Janssen Displays               │
│  50× Roll-up banner 85×200      │
│  Step: Printing                 │
│  SLA: 14:00  (1h 48m left)     │  ← deadline + remaining, SLA color
└─────────────────────────────────┘
```

All labels ("Current job", "Next job", "Active since", etc.) come from `i18n` objects
in the DataGroup configuration, resolved via `getLanguage()` from `xfw-get-block`.

Tapping a card navigates via `useNavigate()` from `@s-flex/xfw-url`:

```typescript
navigate({
  outlets: [{ key: 'sidebar', val: 'resource' }],
  queryParams: [{ key: 'resource_uid', val: machine_id }],
});
```

### Status colors

Colors come from `data/status-groups.json` via `i18n` objects. Do not hardcode them in components.

| State | Background | Border | Dot |
|---|---|---|---|
| `producing` | `#052e16` | `#22c55e` | `#4ade80` pulsing |
| `starved` | `#1a1400` | `#eab308` | `#facc15` |
| `blocked` | `#1c0a00` | `#f97316` | `#fb923c` |
| `setup` | `#0c1a2e` | `#3b82f6` | `#60a5fa` |
| `breakdown` | `#1f0000` | `#ef4444` | `#f87171` pulsing |
| `idle` | `#111111` | `#374151` | `#9ca3af` |

### SLA color on next job

Thresholds are data-driven (from DataGroup configuration), not hardcoded:

| Remaining | Color |
|---|---|
| > 2 hours | green |
| < 2 hours | yellow |
| < 30 min or overdue | red |

### No jobs in queue

Placeholder text comes from `i18n`:

```json
{
  "i18n": {
    "nl": { "title": "Geen opdracht in de wachtrij" },
    "en": { "title": "No job in queue" },
    "de": { "title": "Kein Auftrag in der Warteschlange" }
  }
}
```

---

## Mode 2: configuration

Full-screen overlay, not a modal.

Header and sub text come from `i18n`:

```json
{
  "i18n": {
    "nl": {
      "title": "Mijn machines",
      "text": "Selecteer de machines die u vandaag bedient. Maximaal 6 machines. Wijzigingen worden opgeslagen na bevestiging."
    },
    "en": {
      "title": "My machines",
      "text": "Select the machines you are running today. Maximum 6 machines. Changes are saved on confirm."
    }
  }
}
```

### Machine list

Grouped by hall, sourced from `available_machines` DataGroup:

```
Hall 1 — Large roll                    ← hall name from i18n
  [x] H1-P03  Durst P5 350   Breakdown     ← selected
  [ ] H1-P01  Durst P5 350   Producing     ← state label from i18n
  [ ] H1-P05  HP Latex 630   Waiting
  [x] H1-C02  Zünd G3        Blocked       ← selected
  ...

Hall 2 — Small roll
  [ ] H2-P01  Durst P5 350   Producing
  ...
```

- Selected machines appear first within each hall group
- State shown as a badge using colors from `status-groups.json`
- Checkbox toggles selection client-side; nothing saved until **Save** is clicked

### Save

- Uses mutation via `useDataGeneric`:

```typescript
mutate([{ operator_id: operatorId, machine_ids: selectedIds }]);
```

- On success: return to mode 1
- More than 6 selected: **Save** button disabled, inline error from `i18n`

---

## Sidebar navigation

The operator page supports sidebar navigation for machine detail.
Tapping a machine card opens the sidebar via `useNavigate()`:

```typescript
navigate({
  outlets: [{ key: 'sidebar', val: 'resource' }],
  queryParams: [{ key: 'resource_uid', val: machine_id }],
});
```

Unlike the management page, there is no hall or KPI drill-down from this page.

---

## Behaviour

### Automatic refresh

- Every 10 seconds: TanStack Query `refetchInterval` on the machines DataGroup
- No full page reload — update card data in place
- On state change: card border briefly flashes to draw attention

### Relative time for `state_since`

Calculate and display client-side, update every 30 seconds without an API call:

| Duration | Display |
|---|---|
| < 1 minute | i18n: `{ "en": { "title": "just now" }, "nl": { "title": "zojuist" } }` |
| 1–59 minutes | template: `{ "en": { "title": "{minutes}m" } }` |
| ≥ 1 hour | template: `{ "en": { "title": "{hours}h {minutes}m" } }` |

### Remaining SLA time

Display as `HH:MM (Xh Ym left)` or `HH:MM (Xm overdue)`.
Labels ("left", "overdue") come from `i18n`. Update every 30 seconds client-side.

### Empty state (no machines configured)

Text and button label come from `i18n`:

```json
{
  "i18n": {
    "nl": { "title": "U heeft nog geen machines geselecteerd.", "text": "Machines instellen" },
    "en": { "title": "You have not selected any machines yet.", "text": "Set up machines" }
  }
}
```

Button switches directly to mode 2.

### Offline / connection lost

Banner at the top with text from `i18n`:

```json
{
  "i18n": {
    "nl": { "title": "Geen verbinding — gegevens van {time} worden getoond" },
    "en": { "title": "No connection — showing data from {time}" }
  }
}
```

Cards remain visible with last known data, dimmed to indicate staleness.

---

## What this page does not do

- No OEE charts or historical trends
- No hall overview
- No list of multiple queued jobs (only current + next)
- No job actions (no confirm, no complete)
- No KPI group navigation
