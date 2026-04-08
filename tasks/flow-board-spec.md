# Flow board — build specification

## Overview

A recursive, data-driven board. The root is `FlowBoard.tsx`. Each level renders child instances using a purely visual layout component. All levels share the same data from the root. The hierarchy, grouping, and displayed fields are defined entirely in `flow_board_config`.

**Stack**: React · TypeScript · Vite · `app.css` (project uses plain CSS, not Tailwind)

**Principle**: Semantics in data, not in code. Layout components (`flow-grid`, `flow-container`, `flow-cards`, `flow-table`) have no semantic meaning — they are interchangeable visual wrappers. Any level can be skipped or replaced by another layout. Other layouts can be added without changing the data model.

**State**: All navigational UI state (selection, expanded instances, active filters) is managed through URL parameters via `@s-flex/xfw-url` (`useQueryParams`, `useNavigate`). Local transient state (e.g. drag preview) uses `useState`.

---

## 1. Configuration

### 1.1 `data_group` example

```json
{
  "widget_id": "components_inflow",
  "src": "get_components_inflow",
  "params": [
    { "key": "reference_date", "val": "" },
    { "key": "from", "val": "" },
    { "key": "material_id", "val": "" },
    { "key": "domain_id", "val": "" },
    { "key": "look_ahead_days", "val": "10" },
    { "key": "threshold", "val": "5" }
  ],
  "layout": "flow-board",
  "field_config": {
    "production_date": {
      "ui": {
        "control": "date",
        "i18n": { "nl": { "title": "Productiedatum" }, "en": { "title": "Production date" } },
        "order": 1
      }
    },
    "direction": {
      "ui": {
        "control": "badge",
        "i18n": { "nl": { "title": "Richting" }, "en": { "title": "Direction" } },
        "order": 2
      }
    },
    "order_location": {
      "ui": {
        "i18n": { "nl": { "title": "Locatie" }, "en": { "title": "Location" } },
        "order": 3
      }
    },
    "state": {
      "ui": {
        "control": "badge",
        "i18n": { "nl": { "title": "Status" }, "en": { "title": "State" } },
        "order": 4
      }
    },
    "order_id": {
      "ui": {
        "i18n": { "nl": { "title": "Order" }, "en": { "title": "Order" } },
        "order": 5
      }
    },
    "material_id": {
      "ui": {
        "i18n": { "nl": { "title": "Materiaal" }, "en": { "title": "Material" } },
        "order": 6
      }
    },
    "order_line_count": {
      "ui": {
        "i18n": { "nl": { "title": "Orderregels" }, "en": { "title": "Order lines" } },
        "order": 7
      }
    },
    "product_amount": {
      "ui": {
        "i18n": { "nl": { "title": "Aantal" }, "en": { "title": "Qty" } },
        "order": 8
      }
    },
    "total_product_amount": {
      "ui": {
        "i18n": { "nl": { "title": "Totaal aantal" }, "en": { "title": "Total qty" } },
        "order": 9
      }
    },
    "sqm": {
      "ui": {
        "i18n": { "nl": { "title": "m\u00b2" }, "en": { "title": "m\u00b2" } },
        "order": 10
      }
    },
    "threshold": {
      "ui": {
        "i18n": { "nl": { "title": "Drempel" }, "en": { "title": "Threshold" } },
        "order": 11
      }
    }
  },
  "flow_board_config": {
    "layout": "flow-grid",
    "group_by": [
      [
        { "field": "order_location", "op": "eq", "value": "NL" },
        { "field": "state", "op": "eq", "value": "pending-release" }
      ],
      [
        { "field": "order_location", "op": "eq", "value": "DE" },
        { "field": "state", "op": "eq", "value": "pending-release" }
      ],
      [
        { "field": "order_location", "op": "eq", "value": "NL" },
        { "field": "state", "op": "eq", "value": "staging" }
      ],
      [
        { "field": "order_location", "op": "eq", "value": "DE" },
        { "field": "state", "op": "eq", "value": "staging" }
      ]
    ],
    "children": {
      "layout": "flow-container",
      "group_by": ["production_date", "direction"],
      "field_config": {
        "production_date": {
          "ui": {
            "control": "date",
            "i18n": { "nl": { "title": "Productiedatum" }, "en": { "title": "Production date" } }
          }
        },
        "direction": {
          "ui": {
            "control": "badge",
            "i18n": { "nl": { "title": "Richting" }, "en": { "title": "Direction" } }
          }
        },
        "order_id": {
          "aggregate": "count",
          "ui": {
            "i18n": { "nl": { "title": "Orders" }, "en": { "title": "Orders" } }
          }
        },
        "total_product_amount": {
          "aggregate": "sum",
          "ui": {
            "i18n": { "nl": { "title": "Totaal aantal" }, "en": { "title": "Total qty" } }
          }
        },
        "sqm": {
          "aggregate": "sum",
          "ui": {
            "i18n": { "nl": { "title": "m\u00b2" }, "en": { "title": "m\u00b2" } }
          }
        }
      },
      "children": {
        "layout": "flow-cards",
        "group_by": ["order_id"],
        "field_config": {
          "order_id": {
            "ui": {
              "i18n": { "nl": { "title": "Order" }, "en": { "title": "Order" } }
            }
          },
          "order_line_count": {
            "ui": {
              "i18n": { "nl": { "title": "Orderregels" }, "en": { "title": "Order lines" } }
            }
          },
          "total_product_amount": {
            "aggregate": "sum",
            "ui": {
              "i18n": { "nl": { "title": "Totaal aantal" }, "en": { "title": "Total qty" } }
            }
          },
          "sqm": {
            "aggregate": "sum",
            "ui": {
              "i18n": { "nl": { "title": "m\u00b2" }, "en": { "title": "m\u00b2" } }
            }
          }
        },
        "children": {
          "layout": "flow-table"
        }
      }
    }
  }
}
```

---

### 1.2 Configuration rules

**`data_group.field_config`**
- Master field registry. Only fields listed here are displayed anywhere in the board.
- `aggregate` — function applied to this field at levels where it appears: `sum`, `count`, `avg`, `min`, `max`.
- `ui.i18n` — localized display label. Resolved using `getBlock()` from `xfw-get-block` where possible, or `ui.i18n[locale].title` for inline labels.
- `ui.control` — rendering hint (`"badge"`, `"date"`, etc.).
- `ui.order` — default display order.

**`flow_board_config`**
- Always starts with `layout: "flow-grid"`.
- `group_by` — determines how rows are partitioned into child instances. Two forms:
  1. **Compound filter arrays** (root level): `FilterRule[][]` — each sub-array is a set of conditions that define one group. Rows matching all conditions in a sub-array belong to that group. This allows groups defined by combinations of field values (e.g. location + state).
  2. **Field name array** (child levels): `string[]` — rows are grouped by the composite key of these field values. E.g. `["production_date", "direction"]` groups by unique combinations of date and direction.
- `field_config` — per-level field configuration. Keys must exist in `data_group.field_config`. Declares which fields are shown at this level and may add `aggregate` functions or override `ui` properties. Only fields listed here are shown at this level.
- `children` — next level config. Absent on `flow-table` (leaf level). `flow-table` inherits all fields from `data_group.field_config` that are not used as grouping or aggregate fields at ancestor levels.
- Layout types are purely visual. They carry no business meaning and are interchangeable. New layout types can be added without changing the data model.

**No `editable_fields`.** Editability is derived from the field and context, not declared separately.

---

### 1.3 `group_by` — compound filters vs field grouping

**Compound filter `group_by`** (used at flow-grid level):

Each element is a `FilterRule[]` — all rules must match (AND). The array index determines column order.

```typescript
// Group 0: NL + pending-release
[{ field: "order_location", op: "eq", value: "NL" }, { field: "state", op: "eq", value: "pending-release" }]

// Group 1: DE + pending-release
[{ field: "order_location", op: "eq", value: "DE" }, { field: "state", op: "eq", value: "pending-release" }]
```

The column header is derived from the filter values + their `field_config` i18n labels.

**Field name `group_by`** (used at child levels):

```typescript
// Group by composite key: production_date + direction
["production_date", "direction"]
```

Rows are grouped by the concatenation of their values for these fields. The group header shows each field's value rendered according to its `field_config`.

---

### 1.4 Data structures

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
  "order_id": "ORD-001",
  "material_id": 42,
  "order_location": "NL",
  "state": "pending-release",
  "production_date": "2026-04-10",
  "direction": "inbound",
  "order_line_count": 3,
  "product_amount": 150,
  "total_product_amount": 450,
  "sqm": 12.5,
  "threshold": 5
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

### 3.1 Generic types (from `@s-flex/xfw-data`)

Types used from the npm package:

```typescript
import type { DataGroup, DataTable, FieldConfig, JSONValue, JSONRecord, PgField } from '@s-flex/xfw-data';
```

### 3.2 Flow-specific (`src/widgets/flow/types.ts`)

```typescript
import type { FieldConfig, JSONValue, DataGroup, DataTable, PgField } from '@s-flex/xfw-data';

export type AggregateFn = 'sum' | 'count' | 'avg' | 'min' | 'max';

export type FilterOp = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'like';

export type FilterRule = {
    field: string;
    op:    FilterOp;
    value: JSONValue;
};

export type FlowLayoutType = 'flow-grid' | 'flow-container' | 'flow-cards' | 'flow-table' | string;

export type DragKind = 'instance' | 'selection';

/**
 * group_by has two forms:
 * - FilterRule[][] — compound filter groups (each sub-array defines one group via AND conditions)
 * - string[]       — field name grouping (rows grouped by composite key of field values)
 */
export type FlowGroupBy = FilterRule[][] | string[];

export type FlowLevelFieldConfig = Record<string, FieldConfig & { aggregate?: AggregateFn }>;

export type FlowBoardLevelConfig = {
    layout:       FlowLayoutType;
    group_by?:    FlowGroupBy;
    field_config?: FlowLevelFieldConfig;
    children?:    FlowBoardLevelConfig;
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

### 3.3 Determining `group_by` form

```typescript
function isFilterGroupBy(groupBy: FlowGroupBy): groupBy is FilterRule[][] {
    return groupBy.length > 0 && Array.isArray(groupBy[0]);
}
```

When `isFilterGroupBy` returns `true`, each element is a `FilterRule[]` (compound filter defining one group). Otherwise, each element is a field name string.

### 3.4 Config resolution

```typescript
function resolveFlowBoardConfig(dataGroup: DataGroup, dataTable: DataTable): ResolvedFlowConfig {
    const fieldMap: FieldMap = Object.fromEntries(
        Object.entries(dataGroup.field_config ?? {}).map(([key, fc]) => {
            const pgField = dataTable.schema[key];
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
1. Groups rows using `level_config.group_by`:
   - **Compound filter** (`FilterRule[][]`): For each filter set, select rows where all conditions match. Column order follows array index.
   - **Field name array** (`string[]`): Group rows by composite key of field values. E.g. `["production_date", "direction"]` produces a group for each unique `(date, direction)` pair.
2. Computes `LevelAggregated` per group from `level_config.field_config` + `field_map`.
3. Renders each group using its visual structure.
4. For each group, renders the child level by switching on `level_config.children.layout`:
   ```typescript
   const child_map: Record<string, ComponentType<FlowLevelProps>> = {
       'flow-grid':      FlowGrid,
       'flow-container': FlowContainer,
       'flow-cards':     FlowCards,
       'flow-table':     FlowTable,
   }
   const ChildComponent = child_map[level_config.children.layout]
   ```
5. Passes child `rows` (the group's subset) and `level_config.children` to the child component.

**No level component knows what it is in the hierarchy.** The `child_map` lookup is the only dispatch logic.

### `<FlowGrid>` — `FlowGrid.tsx`
Horizontal grid of equal-width columns. Each column = one group defined by its compound filter or field value. Column header shows the filter field values (e.g. "NL — pending-release") using i18n labels from `field_config`. Column body = child component. Sticky column headers. Horizontal scroll on overflow. Columns are `useDroppable` targets.

### `<FlowContainer>` — `FlowContainer.tsx`
Vertical stack of full-width collapsible sections. Header shows group field values (e.g. production date + direction badge) + aggregate chips + expand toggle + drag handle. `useDraggable` on header, `useDroppable` on body.

### `<FlowCards>` — `FlowCards.tsx`
Wrapping flex row of card tiles. Each card shows the group field values (e.g. order_id) + aggregate chips + expand toggle + drag handle. `useDraggable` + `useDroppable`.

### `<FlowTable>` — `FlowTable.tsx`
Leaf. No `group_by`, no children, no `field_config`. Renders a `<table>` with columns from all remaining fields in the root `data_group.field_config` that are not grouping keys at ancestor levels. One `<FlowRow>` per row. `<FlowActionBar>` when rows are selected.

---

## 7. `<FlowRow>`

**File:** `FlowRow.tsx`

Renders one data row. For each field in the resolved field set:

```typescript
resolvedFields.forEach(field => {
    const value = row[field.key];
    // render based on field.control, field.pg_field.pg_type
})
```

For `"badge"` control, reads `row[field_key]` as the value and applies CSS class from a `class_name` sibling if present.

Checkbox on the left — toggles row into URL `selected` param.

---

## 8. `<FlowActionBar>`

**File:** `FlowActionBar.tsx`

Appears inside any level instance when descendant rows are selected (read from URL `selected` param).

- Label: `{n} geselecteerd`
- One setter per field in `level_config.field_config` that is not an aggregate field. Shows shared value across selected rows or `—` if mixed.
- On change: `handleAction` via context.
- Drag handle: `kind: 'selection'`.
- Style: `.flow-action-bar` class in `app.css` (amber-tinted background, bottom border, slide-in transition).

---

## 9. `<FlowToolbar>`

**File:** `FlowToolbar.tsx`

| Element | Behaviour |
|---|---|
| Selected count | From URL `selected`. Clear button resets URL param. |
| Undo | Calls `handleAction` with reversed changes. Count from URL or server. |
| Vastleggen | Confirm dialog — commits pending changes. |

---

## 10. Drag and drop

**Library:** `@dnd-kit/core`

Two drag kinds:

| Kind | Handle | Rows moved |
|---|---|---|
| `instance` | Level component header | All rows in this group instance |
| `selection` | Action bar | Only URL-selected rows |

On drop:
1. Identify target instance's group values.
2. Build `ActionChange[]` — one entry per affected field per row (skip no-ops).
3. Call `handleAction`.

Auto-grouping requires no special logic. After `handleAction` updates `rows`, each level component re-derives its groups from the new data. Moved rows appear in the correct instance automatically.

**`<FlowDragLayer>`** — `DragOverlay` ghost. `instance` kind: card silhouette. `selection` kind: pill showing `{n} rijen`.

---

## 11. Field rendering

| `control` / `pg_type` | Rendered as |
|---|---|
| `control: "badge"` | Badge — value from key, CSS from `class_name` sibling if present |
| `control: "date"` | Locale-formatted date |
| `aggregate` set | Stat chip: `{i18n[locale].title}: {value}` |
| `pg_type: int4/int8/numeric` | Number, right-aligned |
| `pg_type: date/timestamptz` | Locale-formatted |
| `pg_type: bool` | Checkbox |
| all others | Plain text |

Only fields in `data_group.field_config` are ever rendered. Fields not in `field_config` are invisible throughout the board.

Level-config `field_config` may provide per-level `ui` and `aggregate` overrides merged on top of the parent `data_group.field_config`:
```typescript
function mergeFieldConfig(resolved: ResolvedField, levelFc: FieldConfig & { aggregate?: AggregateFn }): ResolvedField {
    return {
        ...resolved,
        aggregate: levelFc.aggregate ?? resolved.aggregate,
        control:   levelFc.ui?.control ?? resolved.control,
        order:     levelFc.ui?.order   ?? resolved.order,
        i18n:      levelFc.ui?.i18n    ?? resolved.i18n,
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

1. `src/widgets/flow/types.ts` — all flow-specific types (`AggregateFn`, `FilterRule`, `FlowGroupBy`, `FlowBoardLevelConfig`, etc.)
2. `src/widgets/flow/utils.ts` — `resolveFlowBoardConfig`, `isFilterGroupBy`, `applyFilterGroup`, `groupRowsBy`, `computeAggregates`, `mergeFieldConfig`
3. `FlowContext.ts`
4. `FlowRow.tsx`
5. `FlowActionBar.tsx`
6. `FlowTable.tsx`
7. `FlowCards.tsx`, `FlowContainer.tsx`, `FlowGrid.tsx` — each uses `child_map` dispatch
8. `FlowToolbar.tsx`, `FlowDragLayer.tsx`
9. `FlowBoard.tsx` — resolution, context, URL state, DndContext
10. Register `'flow-board'` in `src/widgets/WidgetRenderer.tsx` switch statement
11. Wire drag handles + drop targets
12. Add `flow-*` CSS classes to `src/app.css`
13. Integration test (§15)

---

## 15. Integration test

**Sample data:**
```typescript
const rows = [
  { order_id: 'ORD-001', material_id: 42, order_location: 'NL', state: 'pending-release', production_date: '2026-04-10', direction: 'inbound',  order_line_count: 3, product_amount: 150, total_product_amount: 450, sqm: 12.5, threshold: 5 },
  { order_id: 'ORD-002', material_id: 42, order_location: 'NL', state: 'pending-release', production_date: '2026-04-10', direction: 'outbound', order_line_count: 2, product_amount: 80,  total_product_amount: 160, sqm: 6.0,  threshold: 5 },
  { order_id: 'ORD-003', material_id: 42, order_location: 'DE', state: 'pending-release', production_date: '2026-04-11', direction: 'inbound',  order_line_count: 5, product_amount: 200, total_product_amount: 1000, sqm: 30.0, threshold: 5 },
  { order_id: 'ORD-004', material_id: 42, order_location: 'NL', state: 'staging',         production_date: '2026-04-10', direction: 'inbound',  order_line_count: 1, product_amount: 50,  total_product_amount: 50,  sqm: 2.0,  threshold: 5 },
  { order_id: 'ORD-005', material_id: 42, order_location: 'DE', state: 'staging',         production_date: '2026-04-10', direction: 'inbound',  order_line_count: 4, product_amount: 120, total_product_amount: 480, sqm: 15.0, threshold: 5 },
  { order_id: 'ORD-006', material_id: 42, order_location: 'NL', state: 'pending-release', production_date: '2026-04-11', direction: 'inbound',  order_line_count: 2, product_amount: 90,  total_product_amount: 180, sqm: 7.5,  threshold: 5 },
]
```

**Expected hierarchy:**
```
flow-grid: compound filter groups
├── NL + pending-release (ORD-001, ORD-002, ORD-006)
│   ├── flow-container: 2026-04-10 + inbound
│   │   └── flow-cards: ORD-001 → flow-table (3 lines, 450 qty, 12.5 m²)
│   ├── flow-container: 2026-04-10 + outbound
│   │   └── flow-cards: ORD-002 → flow-table (2 lines, 160 qty, 6.0 m²)
│   └── flow-container: 2026-04-11 + inbound
│       └── flow-cards: ORD-006 → flow-table (2 lines, 180 qty, 7.5 m²)
├── DE + pending-release (ORD-003)
│   └── flow-container: 2026-04-11 + inbound
│       └── flow-cards: ORD-003 → flow-table (5 lines, 1000 qty, 30.0 m²)
├── NL + staging (ORD-004)
│   └── flow-container: 2026-04-10 + inbound
│       └── flow-cards: ORD-004 → flow-table (1 line, 50 qty, 2.0 m²)
└── DE + staging (ORD-005)
    └── flow-container: 2026-04-10 + inbound
        └── flow-cards: ORD-005 → flow-table (4 lines, 480 qty, 15.0 m²)
```

**Aggregate — NL + pending-release:**
- Orders: 3 · Total qty: 790 · m²: 26.0

**Aggregate — NL + pending-release / 2026-04-10 + inbound:**
- Orders: 1 · Total qty: 450 · m²: 12.5

**Drag — ORD-004 from NL + staging → NL + pending-release:**
- `state: staging → pending-release` on ORD-004
- One `ActionChange`, one log entry, one undo step
