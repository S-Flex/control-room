# Flow board — build specification

## Overview

A recursive, data-driven board. The root is `FlowBoard.tsx`. Each level renders child instances using a purely visual layout component. All levels share the same data from the root. The hierarchy, grouping, and displayed fields are defined entirely in `flow_board_config`.

**Stack**: React · TypeScript · Vite · `app.css` (project uses plain CSS, not Tailwind)

**Principle**: Semantics in data, not in code. Layout components (`flow-grid`, `flow-container`, `flow-cards`, `flow-table`) have no semantic meaning — they are interchangeable visual wrappers. Any level can be skipped or replaced by another layout. Other layouts can be added without changing the data model.

**State**: All navigational UI state (selection, expanded instances, active filters) is managed through URL parameters via `xfw-url` (`useQueryParams`, `useNavigate`). Local transient state (e.g. drag preview) uses `useState`.

---

## 1. Configuration

### 1.1 `data_group` example

```json
{
  "widget_id": "production_job_flow",
  "src": "get_production_jobs",
  "params": [],
  "layout": "flow-board",
  "field_config": {
    "job_id": {
      "aggregate": "count",
      "ui": {
        "i18n": { "nl": { "title": "Jobs" }, "en": { "title": "Jobs" } },
        "order": 1
      }
    },
    "quantity": {
      "aggregate": "sum",
      "ui": {
        "i18n": { "nl": { "title": "Aantal" }, "en": { "title": "Qty" } },
        "order": 2
      }
    },
    "state_json.state": {
      "ui": {
        "control": "badge",
        "i18n": { "nl": { "title": "Status" }, "en": { "title": "State" } },
        "order": 3
      }
    },
    "customer":  { "ui": { "i18n": { "nl": { "title": "Klant"     }, "en": { "title": "Customer" } }, "order": 4 } },
    "location":  { "ui": { "i18n": { "nl": { "title": "Locatie"   }, "en": { "title": "Location" } }, "order": 5 } },
    "label":     { "ui": { "i18n": { "nl": { "title": "Omschrijving" }, "en": { "title": "Label"  } }, "order": 6 } },
    "priority":  { "ui": { "i18n": { "nl": { "title": "Prioriteit" }, "en": { "title": "Priority" } }, "order": 7 } }
  },
  "flow_board_config": {
    "layout": "flow-grid",
    "group_by": "state_json.state",
    "order": ["start", "pending", "done"],
    "filter": [],
    "fields": {
      "state_json.state": {}
    },
    "children": {
      "layout": "flow-container",
      "group_by": "customer",
      "filter": [],
      "fields": {
        "customer": {},
        "quantity": {},
        "job_id":   {}
      },
      "children": {
        "layout": "flow-cards",
        "group_by": "location",
        "filter": [],
        "fields": {
          "location": {},
          "quantity": {},
          "job_id":   {}
        },
        "children": {
          "layout": "flow-table",
          "filter": [],
          "fields": {
            "label":    {},
            "priority": {},
            "quantity": {}
          }
        }
      }
    }
  }
}
```

---

### 1.2 Configuration rules

**`data_group.field_config`**
- Only fields listed here are displayed anywhere in the board.
- `aggregate` — function applied to this field at every level where it appears: `sum`, `count`, `avg`, `min`, `max`.
- `ui.i18n` — localized display label used in headers and aggregate chips. Resolved using `getBlock()` from `xfw-get-block` where possible, or `ui.i18n[locale].title` for inline labels.
- `ui.control` — rendering hint (`"badge"`, `"date"`, etc.). `"badge"` reads `row[parent].class_name` as CSS classes.
- `ui.order` — default display order.

**`flow_board_config`**
- Always starts with `layout: "flow-grid"`.
- `group_by` — field key that partitions rows into child instances. Any field in `field_config` can be used.
- `order` — explicit list of `group_by` values to show and in what sequence. Values absent from `order` are hidden.
- `filter` — `FilterRule[]` applied before grouping at this level.
- `fields` — map of `{ [field_key]: FieldConfig }`. Keys must exist in `data_group.field_config`. The per-level `FieldConfig` may override `ui` properties from the parent `field_config`. Only fields listed here are shown at this level.
- `children` — next level config. Absent on `flow-table`.
- Layout types are purely visual. They carry no business meaning and are interchangeable. New layout types can be added without changing the data model.

**No `editable_fields`.** Editability is derived from the field and context, not declared separately.

---

### 1.3 Data structures

**Dot-notation keys** — `state_json.state` resolves by walking `row` field-by-field: `row["state_json"]["state"]`. The `class_name` sibling is always at `row["state_json"]["class_name"]` — fixed convention, no config needed.

**Data traversal pattern** — the renderer walks data as:
```typescript
rows.forEach(row => {
  fields.forEach(field => {
    // render row[field.key] using field_config
  })
})
```

**Aggregated data shape** — computed per level, per group instance:
```typescript
aggregated[level_key] = {
  rows:   Row[],           // rows in scope for this instance
  fields: {
    [field_key]: {
      value: number,
      fn:    AggregateFn,
      label: string        // from ui.i18n[locale].title
    }
  }
}
```

Aggregates recompute over `selected_rows` when a row selection is active; otherwise over all `rows` in the instance.

**Example data row:**
```json
{
  "job_id": "j1",
  "customer": "Acme",
  "state_json": { "state": "pending", "class_name": "flow-badge-amber" },
  "location": "nl",
  "quantity": 100,
  "label": "Banner A",
  "priority": 1
}
```

---

## 2. Component architecture

```
<FlowBoard />
  ├── <FlowToolbar />
  ├── <FlowGrid />            — layout: flow-grid  (always root)
  │     └── <FlowContainer /> — layout: flow-container
  │           └── <FlowCards /> — layout: flow-cards
  │                 └── <FlowTable />  — layout: flow-table (leaf)
  │                       └── <FlowRow /> (×n)
  └── <FlowDragLayer />
```

Each level component is a standalone file. `FlowBoard` holds all shared state and provides `FlowContext`. Layout components are purely visual — `FlowGrid`, `FlowContainer`, `FlowCards`, and `FlowTable` can be reordered, skipped, or replaced by future layout types without any change to the data model. The level rendered is determined by `level_config.children.layout`.

---

## 3. Types

### 3.1 Generic (extend `packages/xfw-data/types/index.ts`)

> **Note**: `packages/` is a protected directory. These changes require explicit permission before editing.

Add to the existing types file:

```typescript
export type AggregateFn = 'sum' | 'count' | 'avg' | 'min' | 'max';

export type FilterOp = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'like';

export type FilterRule = {
    field: string;
    op:    FilterOp;
    value: JSONValue;
};
```

### 3.2 Extend existing `FieldConfig` and `DataGroup`

Add `aggregate` to the existing `FieldConfig`:

```typescript
export type FieldConfig = {
    type?: string;
    field_type?: string;
    input_data?: InputData;
    ui?: Partial<UI>;
    aggregate?: AggregateFn;   // NEW — aggregation function for flow-board levels
};
```

Add `flow_board_config` to the existing `DataGroup`:

```typescript
// Add to existing DataGroup type:
flow_board_config?: FlowBoardLevelConfig;
```

The `layout` field already accepts `string`, so `"flow-board"` works without changes.

### 3.3 Flow-specific (`src/widgets/flow/types.ts`)

```typescript
import type { FilterRule, AggregateFn, FieldConfig, JSONValue, DataGroup, DataTable, PgField } from 'xfw-data';

export type FlowLayoutType = 'flow-grid' | 'flow-container' | 'flow-cards' | 'flow-table' | string;

export type DragKind = 'instance' | 'selection';

export type FlowBoardLevelConfig = {
    layout:    FlowLayoutType;
    group_by?: string;
    order?:    string[];
    filter?:   FilterRule[];
    fields:    Record<string, FieldConfig>;   // key → per-level field config override
    children?: FlowBoardLevelConfig;
};

export type ResolvedField = {
    key:        string;
    pg_field:   PgField;
    aggregate?: AggregateFn;
    i18n?:      Record<string, Record<string, string>>;
    control?:   string;
    order?:     number;
};

export type FieldMap = Record<string, ResolvedField>;

export type AggregatedField = {
    value: number;
    fn:    AggregateFn;
    label: string;
};

export type LevelAggregated = {
    rows:   Record<string, JSONValue>[];
    fields: Record<string, AggregatedField>;
};

export type ResolvedFlowConfig = {
    data_group:        DataGroup;
    data_table:        DataTable;
    field_map:         FieldMap;
    flow_board_config: FlowBoardLevelConfig;
};

export type ActionChange = {
    primary_key:  string;
    field:        string;
    value_before: JSONValue;
    value_after:  JSONValue;
};

export type DragData = {
    kind:      DragKind;
    group_key: string;
    rows:      Record<string, JSONValue>[];
    depth:     number;
};

export type FlowContextValue = {
    resolved:     ResolvedFlowConfig;
    rows:         Record<string, JSONValue>[];
    locale:       string;
    handleAction: (changes: ActionChange[]) => Promise<void>;
};
```

### 3.4 Config resolution

```typescript
function resolveFlowBoardConfig(dataGroup: DataGroup, dataTable: DataTable): ResolvedFlowConfig {
    const fieldMap: FieldMap = Object.fromEntries(
        Object.entries(dataGroup.field_config ?? {}).map(([key, fc]) => {
            const parts = key.split('.');
            const pgField = parts.reduce(
                (pf: PgField | undefined, part) => pf?.fields?.[part] ?? dataTable.schema[part],
                undefined
            ) ?? dataTable.schema[key];
            return [key, {
                key,
                pg_field:  pgField!,
                aggregate: fc.aggregate,
                i18n:      fc.ui?.i18n,
                control:   fc.ui?.control,
                order:     fc.ui?.order,
            }];
        })
    );
    return { data_group: dataGroup, data_table: dataTable, field_map: fieldMap, flow_board_config: dataGroup.flow_board_config! };
}
```

Only fields present in `data_group.field_config` appear in `field_map`. Only fields in `field_map` are rendered.

---

## 4. State — URL params

All navigational and selection state lives in the URL. No `useState` for these concerns.

| URL param | Type | Description |
|---|---|---|
| `expanded` | `string[]` | Encoded list of expanded instance keys |
| `selected` | `string[]` | Selected row primary keys |
| `filter[n]` | `FilterRule` | Active runtime filter overrides per level |

`FlowBoard` reads these on mount and writes them on change via the router. Components read from context, not directly from URL.

---

## 5. `<FlowBoard>`

**File:** `FlowBoard.tsx`

**Props:**
```typescript
interface FlowBoardProps {
    data_group:  DataGroup;
    data_table:  DataTable;
    data:        Record<string, JSONValue>[];
    fetch_fn?:   () => Promise<Record<string, JSONValue>[]>;
}
```

Responsibilities:
- Call `resolveFlowBoardConfig` on mount.
- Hold `rows` in state (from `data` prop or `fetch_fn`).
- Read/write URL params for selection and expanded state.
- Provide `FlowContext` to all descendants.
- Wrap everything in `<DndContext>`.
- Render `<FlowGrid>` as the first level, passing `flow_board_config` as `level_config`.

---

## 6. Level components

All level components share the same props shape:

```typescript
interface FlowLevelProps {
    level_config: FlowBoardLevelConfig;
    rows:         Record<string, JSONValue>[];
    group_key?:   string;    // value this instance represents; absent at root level
}
```

Each component:
1. Applies `level_config.filter` to `rows`.
2. Groups filtered rows by `level_config.group_by` in `level_config.order` sequence.
3. Computes `LevelAggregated` per group from `level_config.fields` + `field_map`.
4. Renders each group using its visual structure.
5. For each group, renders the child level by switching on `level_config.children.layout`:
   ```typescript
   const child_map: Record<string, ComponentType<FlowLevelProps>> = {
       'flow-grid':      FlowGrid,
       'flow-container': FlowContainer,
       'flow-cards':     FlowCards,
       'flow-table':     FlowTable,
   }
   const ChildComponent = child_map[level_config.children.layout]
   ```
6. Passes child `rows` (the group's subset) and `level_config.children` to the child component.

**No level component knows what it is in the hierarchy.** The `child_map` lookup is the only dispatch logic.

### `<FlowGrid>` — `FlowGrid.tsx`
Horizontal grid of equal-width columns. Each column = one group. Column header shows `fields` + aggregate chips. Column body = child component. Sticky column headers. Horizontal scroll on overflow. Columns are `useDroppable` targets.

### `<FlowContainer>` — `FlowContainer.tsx`
Vertical stack of full-width collapsible sections. Header + aggregate chips + expand toggle + drag handle ⠿. `useDraggable` on header, `useDroppable` on body.

### `<FlowCards>` — `FlowCards.tsx`
Wrapping flex row of card tiles. Each card has header + aggregate chips + expand toggle + drag handle ⠿. `useDraggable` + `useDroppable`.

### `<FlowTable>` — `FlowTable.tsx`
Leaf. No `group_by`, no children. Renders a `<table>` with columns from `level_config.fields`. One `<FlowRow>` per row. `<FlowActionBar>` when rows are selected.

---

## 7. `<FlowRow>`

**File:** `FlowRow.tsx`

Renders one data row. For each field in `level_config.fields`:

```typescript
Object.entries(level_config.fields).forEach(([key, level_fc]) => {
    const resolved = field_map[key]        // from context
    const value    = getNestedValue(row, key)  // walk dot-notation path
    const merged   = mergeFieldConfig(resolved, level_fc)
    // render based on merged.control, merged.pg_field.pg_type
})
```

`getNestedValue(row, key)` splits `key` on `.` and walks the row object. For `"badge"` control, it also reads the `class_name` sibling.

Checkbox on the left — toggles row into URL `selected` param.

---

## 8. `<FlowActionBar>`

**File:** `FlowActionBar.tsx`

Appears inside any level instance when descendant rows are selected (read from URL `selected` param).

- Label: `{n} geselecteerd`
- One setter per field in `level_config.fields` that is not an aggregate field. Shows shared value across selected rows or `—` if mixed.
- On change: `handleAction` via context.
- ⠿ drag handle: `kind: 'selection'`.
- Style: `.flow-action-bar` class in `app.css` (amber-tinted background, bottom border, slide-in transition).

---

## 9. `<FlowToolbar>`

**File:** `FlowToolbar.tsx`

| Element | Behaviour |
|---|---|
| Selected count | From URL `selected`. Clear button resets URL param. |
| Undo | Calls `handleAction` with reversed changes. Count from URL or server. |
| Vastleggen | Confirm dialog → commits pending changes. |

---

## 10. Drag and drop

**Library:** `@dnd-kit/core`

Two drag kinds:

| Kind | Handle | Rows moved |
|---|---|---|
| `instance` | Level component header ⠿ | All rows in this group instance |
| `selection` | Action bar ⠿ | Only URL-selected rows |

On drop:
1. Identify target instance's `group_by` value.
2. Build `ActionChange[]` — one entry per affected field per row (skip no-ops).
3. Call `handleAction`.

Auto-grouping requires no special logic. After `handleAction` updates `rows`, each level component re-derives its groups from the new data. Moved rows appear in the correct instance automatically.

**`<FlowDragLayer>`** — `DragOverlay` ghost. `instance` kind: card silhouette. `selection` kind: pill showing `{n} rijen`.

---

## 11. Field rendering

| `control` / `pg_type` | Rendered as |
|---|---|
| `control: "badge"` | Badge — value from key, CSS from `class_name` sibling |
| `aggregate` set | Stat chip: `{i18n[locale].title}: {value}` |
| `pg_type: int4/int8/numeric` | Number, right-aligned |
| `pg_type: date/timestamptz` | Locale-formatted |
| `pg_type: bool` | Checkbox |
| all others | Plain text |

Only fields in `data_group.field_config` are ever rendered. Fields not in `field_config` are invisible throughout the board.

Level-config `fields` may provide per-level `ui` overrides merged on top of the parent `field_config`:
```typescript
function mergeFieldConfig(resolved: ResolvedField, level_fc: FieldConfig): ResolvedField {
    return {
        ...resolved,
        control: level_fc.ui?.control ?? resolved.control,
        order:   level_fc.ui?.order   ?? resolved.order,
        i18n:    level_fc.ui?.i18n    ?? resolved.i18n,
    }
}
```

---

## 12. Visual design

All styles go in `src/app.css` using CSS classes with `flow-` prefix. Use CSS variables from the existing design system (`var(--text)`, `var(--bg)`, `var(--border)`, `var(--brand)`, `var(--radius-md)`, etc.).

**`.flow-grid`** — horizontal scroll, equal-width columns, sticky headers, `gap: 16px`.

**`.flow-container`** — full-width sections, `max-height` collapse transition, `gap: 8px`.

**`.flow-cards`** — flex-wrap, `gap: 12px`, card with `border-radius: var(--radius-md)`, box-shadow, `padding: 12px 16px`.

**`.flow-table`** — compact `<table>`, small font size, alternating row background.

**All instances** — `depth % 2` alternates `var(--bg)` / `var(--bg-muted)`. Selected: `outline: 2px solid var(--brand)`. Dragging: `opacity: 0.4`. Drop target: `border: 2px dashed var(--brand); opacity: 0.6`.

**`.flow-aggregate-chip`** — small font, `font-weight: 500`, muted background, `border-radius: 4px`, `padding: 2px 8px`.

**`.flow-action-bar`** — amber-tinted background, bottom border, small font, slide-in via `transition: all 0.15s`.

---

## 13. File structure

```
src/
  widgets/
    flow/
      FlowBoard.tsx
      FlowGrid.tsx
      FlowContainer.tsx
      FlowCards.tsx
      FlowTable.tsx
      FlowRow.tsx
      FlowActionBar.tsx
      FlowToolbar.tsx
      FlowDragLayer.tsx
      FlowContext.ts
      utils.ts
      types.ts
      index.ts
  app.css                — flow-* styles added here (project uses single CSS file)
```

---

## 14. Build order

1. Extend `packages/xfw-data/types/index.ts` — add `AggregateFn`, `FilterOp`, `FilterRule`, `FieldConfig.aggregate`, `DataGroup.flow_board_config` (**requires permission to edit packages/**)
2. `src/widgets/flow/types.ts` — all flow-specific types
3. `src/widgets/flow/utils.ts` — `resolveFlowBoardConfig`, `getNestedValue`, `applyFilter`, `groupRowsBy`, `computeAggregates`, `mergeFieldConfig`
4. `FlowContext.ts`
5. `FlowRow.tsx`
6. `FlowActionBar.tsx`
7. `FlowTable.tsx`
8. `FlowCards.tsx`, `FlowContainer.tsx`, `FlowGrid.tsx` — each uses `child_map` dispatch
9. `FlowToolbar.tsx`, `FlowDragLayer.tsx`
10. `FlowBoard.tsx` — resolution, context, URL state, DndContext
11. Register `'flow-board'` in `src/widgets/WidgetRenderer.tsx` switch statement
12. Wire drag handles + drop targets
13. Add `flow-*` CSS classes to `src/app.css`
14. Integration test (§15)

---

## 15. Integration test

**Sample data:**
```typescript
const rows = [
  { job_id: 'j1', customer: 'Acme', state_json: { state: 'start',   class_name: 'flow-badge-blue'  }, location: 'nl', quantity: 100, label: 'Banner A', priority: 1 },
  { job_id: 'j2', customer: 'Acme', state_json: { state: 'start',   class_name: 'flow-badge-blue'  }, location: 'nl', quantity:  50, label: 'Banner B', priority: 2 },
  { job_id: 'j3', customer: 'Acme', state_json: { state: 'start',   class_name: 'flow-badge-blue'  }, location: 'be', quantity:  75, label: 'Poster A', priority: 3 },
  { job_id: 'j4', customer: 'Beta', state_json: { state: 'start',   class_name: 'flow-badge-blue'  }, location: 'nl', quantity: 200, label: 'Roll-up',  priority: 1 },
  { job_id: 'j5', customer: 'Acme', state_json: { state: 'pending', class_name: 'flow-badge-amber' }, location: 'nl', quantity: 120, label: 'Banner C', priority: 1 },
  { job_id: 'j6', customer: 'Beta', state_json: { state: 'pending', class_name: 'flow-badge-amber' }, location: 'nl', quantity:  80, label: 'Sign A',   priority: 2 },
]
```

> `class_name` values are CSS classes defined in `app.css`, not Tailwind utilities. Badge classes (e.g. `.flow-badge-blue`, `.flow-badge-amber`) set background + text color.

**Expected hierarchy:**
```
flow-grid: state_json.state → ["start", "pending", "done"]
├── start
│   ├── flow-container: customer = Acme
│   │   ├── flow-cards: location = nl → flow-table: j1, j2
│   │   └── flow-cards: location = be → flow-table: j3
│   └── flow-container: customer = Beta
│       └── flow-cards: location = nl → flow-table: j4
└── pending
    ├── flow-container: customer = Acme
    │   └── flow-cards: location = nl → flow-table: j5
    └── flow-container: customer = Beta
        └── flow-cards: location = nl → flow-table: j6
```

**Aggregate — start/Acme:**
- Jobs: 3 · Qty: 225
- Select j1 + j2 → Jobs: 2 / 3 · Qty: 150 (recomputed at all ancestor levels)

**Drag — Beta/start → pending column:**
- `state_json.state: start → pending` on j4
- One `ActionChange`, one log entry, one undo step

**Badge — j1 state:**
- `getNestedValue(j1, 'state_json.state')` → `"start"`
- `getNestedValue(j1, 'state_json.class_name')` → `"flow-badge-blue"`
- Applied directly as CSS class to badge element, no mapping needed
