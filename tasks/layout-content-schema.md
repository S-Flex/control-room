# Layout & content schema

## Overview

The system uses two separate datasets:

1. **Layout** — structure, grid, nesting. References content via `code`.
2. **Content** — flat array of blocks with text, images, navigation, and multilingual support.

This separation follows the project's data-driven architecture: layout defines *how* to display, content defines *what* to display. Content blocks use the same `code` + `block` pattern as the rest of the project (see CLAUDE.md "Data & i18n"). All user-facing text is resolved through `getBlock()` from `xfw-get-block`.

---

## Layout schema

### Page level

```json
{
  "code": "page.inhaker-support",
  "class_name": "page-transparent",
  "sections": [...]
}
```

| Field | Type | Description |
|---|---|---|
| `code` | `string` | Unique page identifier, kebab-case |
| `class_name` | `string` | Optional. CSS class applied to page container (defined in `app.css`) |
| `sections` | `Section[]` | Vertically stacked children |

### Section

A section is one of the following:

#### 1. Leaf — content

```json
{ "code": "inhaker-support.footplates.intro" }
```

#### 2. Leaf — data component

```json
{ "data_group": "login" }
```

A `data_group` can also be an array when multiple data tables should always render together:

```json
{ "data_group": ["components_inflow", "components_outflow"] }
```

#### 3. Leaf — content + data component

```json
{
  "code": "system.login-required",
  "data_group": "login"
}
```

#### 4. Vertical container — sections

```json
{
  "sections": [
    { "code": "block-a" },
    { "code": "block-b" }
  ]
}
```

#### 5. Horizontal container — grid + sections

```json
{
  "grid": "2fr 1fr",
  "sections": [
    { "code": "block-a" },
    { "code": "block-b" }
  ]
}
```

#### 6. Grid with areas

```json
{
  "grid": {
    "columns": "2fr 1fr",
    "rows": "auto 1fr",
    "gap": "1rem",
    "areas": [
      "content image",
      "nav image"
    ]
  },
  "sections": [
    { "area": "content", "code": "block-a" },
    { "area": "image", "code": "block-a.image" },
    { "area": "nav", "code": "block-a.nav" }
  ]
}
```

### Grid — full specification

`grid` is either a string or an object.

**String** — maps to `grid-template-columns`:

```json
{ "grid": "2fr 1fr" }
```

**Object** — full CSS grid mapping:

| Field | CSS property | Example |
|---|---|---|
| `columns` | `grid-template-columns` | `"2fr 1fr"` |
| `rows` | `grid-template-rows` | `"auto 1fr"` |
| `areas` | `grid-template-areas` | `["header header", "content sidebar"]` |
| `gap` | `gap` | `"1rem"` |
| `row_gap` | `row-gap` | `"0.5rem"` |
| `column_gap` | `column-gap` | `"1rem"` |

### Grid defaults

Common grid patterns can be expressed concisely. The renderer applies sensible defaults:

- `"grid": "1fr 1fr"` — two equal columns, default gap
- `"grid": "2fr 1fr"` — content + sidebar
- `"grid": "1fr"` — single column (full width)

When `grid` is a string, `gap` defaults to `1rem`. When using areas, `columns` and `rows` are inferred from the area template if omitted.

### Nesting

Grids are flat — one level deep. A grid section can contain nested `sections` (vertical stacking) but not another `grid`. This keeps layout predictable: one grid gives you any layout you need without recursive complexity.

```json
{
  "grid": "2fr 1fr",
  "sections": [
    {
      "sections": [
        { "code": "title" },
        { "code": "description" },
        { "data_group": "contactForm" }
      ]
    },
    { "code": "sidebar.image" }
  ]
}
```

### Section properties

| Field | Type | Description |
|---|---|---|
| `code` | `string` | Reference to content block |
| `data_group` | `string \| string[]` | Reference to DataGroup(s) (rendered via `WidgetRenderer`) |
| `nav` | `NavItem[]` | Optional. Navigation items (links, buttons with routing) |
| `area` | `string` | Grid area name (when parent uses `grid.areas`) |
| `class_name` | `string` | Optional. CSS class (defined in `app.css`) |
| `grid` | `string \| GridConfig` | Grid definition (turns children into a horizontal layout) |
| `sections` | `Section[]` | Children. Laid out as a grid when `grid` is present, otherwise stacked vertically. |
| `params` | `ParamValue[]` | Optional. Parameters for `data_group` (uses `ParamValue` from `xfw-data`) |

Rules:
- `sections` items cannot themselves have a `grid` (no recursive grids)
- A leaf has `code`, `data_group`, `nav`, or any combination — but no `sections`

---

## Content schema

Flat array following the project's `code` + `block` pattern. Resolved via `getBlock()` from `xfw-get-block`.

All text uses `i18n` (multilingual). The default language (nl) is included in the `i18n` object alongside other languages. Resolution uses a language priority list (e.g. `["nl", "en", "fr"]`) with dynamic fallback — if the preferred language is missing, the next in the list is used.

### Text block

```json
{
  "code": "inhaker-support.footplates.intro",
  "block": {
    "i18n": {
      "nl": { "title": "Voetplaten", "text": "Wanneer kies je voor welke voetplaat?" },
      "en": { "title": "Footplates", "text": "When do you choose which footplate?" },
      "de": { "title": "Fußplatten", "text": "Wann wählen Sie welche Fußplatte?" },
      "fr": { "title": "Plaques de base", "text": "Quand choisir le repose-pieds ?" }
    }
  }
}
```

### Image block

```json
{
  "code": "inhaker-support.freestanding-passive.image",
  "block": {
    "type": "image",
    "image_url": "https://xfw3.b-cdn.net/inhaker/productsupport/vrijstaande-inhaker-passief.jpg",
    "aspect_ratio": "5/5",
    "object_fit": "cover"
  }
}
```

### Text block with styling

```json
{
  "code": "inhaker-support.footplates.intro",
  "block": {
    "title_class": "border-left-thick",
    "text_class": "large",
    "i18n": {
      "nl": { "title": "Voetplaten", "text": "Wanneer kies je voor welke voetplaat?" },
      "en": { "title": "Footplates", "text": "When do you choose which footplate?" },
      "de": { "title": "Fußplatten", "text": "Wann wählen Sie welche Fußplatte?" },
      "fr": { "title": "Plaques de base", "text": "Quand choisir le repose-pieds ?" }
    }
  }
}
```

### System block

```json
{
  "code": "system.login-required",
  "block": {
    "i18n": {
      "nl": { "title": "Inloggen noodzakelijk", "text": "Om deze pagina te bekijken moet u ingelogd zijn." },
      "en": { "title": "Login required", "text": "To view this page you need to be logged in." },
      "de": { "title": "Anmeldung erforderlich", "text": "Um diese Seite anzuzeigen, müssen Sie eingeloggt sein." },
      "fr": { "title": "Connexion requise", "text": "Pour voir cette page, vous devez être connecté." }
    }
  }
}
```

### Content block properties

| Field | Type | Description |
|---|---|---|
| `i18n` | `Record<string, { title?, text? }>` | Multilingual text. All languages including default (nl). |
| `type` | `string` | Optional. Block type: `"image"`, `"video"`, etc. Default = text |
| `image_url` | `string` | Image URL |
| `aspect_ratio` | `string` | CSS aspect-ratio value |
| `object_fit` | `string` | CSS object-fit value |
| `title_class` | `string` | Optional. CSS class for title (defined in `app.css`) |
| `text_class` | `string` | Optional. CSS class for text (defined in `app.css`) |

> **Note:** Navigation (`nav`) is a layout concern, not content. Nav items are defined on the section in the layout schema, not in the content block. This keeps content purely display-oriented (text, images, translations) while routing behavior stays in the layout.

### Language resolution

Languages are resolved using a priority list per user, e.g. `["nl", "en", "fr"]`. The resolver walks the list and returns the first available translation:

```
resolveI18n(block.i18n, ["nl", "en", "fr"])
→ tries i18n.nl, then i18n.en, then i18n.fr
```

This replaces the old pattern of a separate default-language `title`/`text` with `i18n` for translations.

### Nav item properties (on Section, not on content block)

| Field | Type | Description |
|---|---|---|
| `text` | `string` | Link text (default language) |
| `icon` | `string` | Icon identifier |
| `path` | `string` | URL template with `{lang}` placeholder |
| `params` | `ParamValue[]` | Query/route parameters (uses `ParamValue` from `xfw-data`) |
| `i18n` | `Record<string, { text?, path? }>` | Multilingual overrides |

---

## Content types

Most page content is the **multicol** pattern — text blocks, images, and grids as described above. Windows and sidebars also use multicol.

Other visual components are **data_groups** — they are referenced from layout but rendered by `WidgetRenderer` based on `DataGroup.layout`:

- **Cards** — card grid (`layout: "cards"`)
- **Flow board** — recursive board widget (`layout: "flow-board"`)
- **Timeline bar** — timeline visualization (`layout: "timeline-bar"`)
- **Donut chart** — chart widget (`layout: "donut-chart"`)
- **Ink gauge** — progress bars (`layout: "ink-gauge"`)
- **Slider / carousel** — composite widget with navigation
- **Fusion / Sketchfab** — 3D viewers embedded as data_groups
- **Collapse list** — expandable/collapsible list
- **Content list** — scrollable content list

Data_groups are self-contained: they fetch their own data, define their own field_config, and render through existing widget infrastructure. Layout only needs to place them.

---

## Full example

### Layout

```json
{
  "code": "page.inhaker-support.footplates",
  "class_name": "page-transparent",
  "sections": [
    {
      "code": "inhaker-support.footplates.intro"
    },
    {
      "grid": "2fr 1fr",
      "sections": [
        {
          "code": "inhaker-support.freestanding-passive",
          "nav": [
            {
              "text": "Voetplaat 400 x 400 x 6",
              "icon": "arrow-right",
              "path": "/xfw/{lang}/onderdeel",
              "params": [{ "key": "object", "val": "06-0600-1191", "is_query_param": true }],
              "i18n": {
                "en": { "text": "Footplate 400 x 400 x 6", "path": "/xfw/{lang}/part" },
                "de": { "text": "Fußplatte 400 x 400 x 6", "path": "/xfw/{lang}/part" },
                "fr": { "text": "Plaque de base 400 x 400 x 6", "path": "/xfw/{lang}/part" }
              }
            }
          ]
        },
        { "code": "inhaker-support.freestanding-passive.image" }
      ]
    },
    {
      "code": "system.login-required",
      "data_group": "login"
    },
    {
      "grid": "2fr 1fr",
      "sections": [
        {
          "code": "inhaker-support.stand-construction",
          "nav": [
            {
              "text": "Voetplaat 250 x 250 x 20",
              "icon": "arrow-right",
              "path": "/xfw/{lang}/onderdeel",
              "params": [{ "key": "object", "val": "06-0600-1249", "is_query_param": true }],
              "i18n": {
                "en": { "text": "Foot plate 250 x 250 x 20", "path": "/xfw/{lang}/part" },
                "de": { "text": "Fußplatte 250 x 250 x 20", "path": "/xfw/{lang}/part" },
                "fr": { "text": "Plaque de pied 250 x 250 x 20", "path": "/xfw/{lang}/part" }
              }
            }
          ]
        },
        { "code": "inhaker-support.stand-construction.image" }
      ]
    }
  ]
}
```

### Content

```json
[
  {
    "code": "inhaker-support.footplates.intro",
    "block": {
      "title_class": "border-left-thick",
      "text_class": "large",
      "i18n": {
        "nl": { "title": "Voetplaten", "text": "Wanneer kies je voor welke voetplaat?" },
        "en": { "title": "Footplates", "text": "When do you choose which footplate?" },
        "de": { "title": "Fußplatten", "text": "Wann wählen Sie welche Fußplatte?" },
        "fr": { "title": "Plaques de base", "text": "Quand choisir le repose-pieds ?" }
      }
    }
  },
  {
    "code": "inhaker-support.freestanding-passive",
    "block": {
      "i18n": {
        "nl": { "title": "Vrijstaande Inhaker (passief)", "text": "Heb je een vrijstaande Inhaker waar geen legplanken of 'interactieve' elementen aan zitten, dan is de Inhaker voet 400 x 400 x 6 mm een prima oplossing." },
        "en": { "title": "Freestanding Inhaker (passive)", "text": "If you have a freestanding Inhaker without shelves or 'interactive' elements, the Inhaker base 400 x 400 x 6 mm is a great solution." },
        "de": { "title": "Freistehender Inhaker (passiv)", "text": "Wenn Sie einen freistehenden Inhaker haben, der keine Ablagen oder 'interaktive' Elemente hat, ist der Inhaker Sockel 400 x 400 x 6 mm eine großartige Lösung." },
        "fr": { "title": "Inhaker (passif)", "text": "Si vous avez un Inhaker autoportant sans étagères ou éléments 'interactifs', le Inhaker base 400 x 400 x 6 mm est une excellente solution." }
      }
    }
  },
  {
    "code": "inhaker-support.freestanding-passive.image",
    "block": {
      "type": "image",
      "image_url": "https://xfw3.b-cdn.net/inhaker/productsupport/vrijstaande-inhaker-passief.jpg",
      "aspect_ratio": "5/5",
      "object_fit": "cover"
    }
  },
  {
    "code": "system.login-required",
    "block": {
      "i18n": {
        "nl": { "title": "Inloggen noodzakelijk", "text": "Om deze pagina te bekijken moet u ingelogd zijn." },
        "en": { "title": "Login required", "text": "To view this page you need to be logged in." },
        "de": { "title": "Anmeldung erforderlich", "text": "Um diese Seite anzuzeigen, müssen Sie eingeloggt sein." },
        "fr": { "title": "Connexion requise", "text": "Pour voir cette page, vous devez être connecté." }
      }
    }
  },
  {
    "code": "inhaker-support.stand-construction",
    "block": {
      "i18n": {
        "nl": { "title": "Standbouw", "text": "Bij standbouw kies je voor de Inhaker zware voet 250 x 250 x 20 mm." },
        "en": { "title": "Stand construction", "text": "For stand construction, choose the Inhaker heavy foot 250 x 250 x 20 mm." },
        "de": { "title": "Standbau", "text": "Für den Standbau wählen Sie den Inhaker schweren Fuß 250 x 250 x 20 mm." },
        "fr": { "title": "Construction du stand", "text": "Pour la construction du support, choisissez le Inhaker pied lourd 250 x 250 x 20 mm." }
      }
    }
  },
  {
    "code": "inhaker-support.stand-construction.image",
    "block": {
      "type": "image",
      "image_url": "https://xfw3.b-cdn.net/inhaker/productsupport/standbouw.jpg",
      "aspect_ratio": "5/5",
      "object_fit": "cover"
    }
  }
]
```

---

## Renderer logic (pseudo)

```
renderSection(section):
  if section.sections:
    if section.grid: create grid container with grid-template-columns (and areas/rows/gap if object)
    else: stack children vertically
    for each child: renderSection(child)  // children cannot have nested grids
  if section.code:
    look up content block by code → resolve i18n using language priority list
  if section.data_group:
    if array: render each DataGroup in sequence
    else: load DataGroup → render via WidgetRenderer
  if section.nav:
    render navigation items (links/buttons with routing via xfw-url)
```

---

## Integration with existing architecture

- **Content blocks** use the same `code` + `block` pattern as `data/ui-labels.json`, `data/materials.json` content arrays, etc. Resolved via `getBlock()` from `xfw-get-block`.
- **Multilingual** — all text uses `i18n` with a language priority list for fallback. No separate default-language fields.
- **Data components** (`data_group`) are rendered through `WidgetRenderer` (`src/widgets/WidgetRenderer.tsx`), which dispatches based on `DataGroup.layout`. Multiple related data tables can be grouped in a `data_group` array.
- **Parameters** on nav items and data groups use `ParamValue` from `xfw-data`, consistent with the existing parameter system.
- **CSS classes** referenced in `class_name`, `title_class`, `text_class` are defined in `src/app.css` — no Tailwind or external CSS frameworks.
- **Routing** — nav item `path` values with `{lang}` placeholder integrate with `xfw-url` routing system.
