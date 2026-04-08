# Layout & content schema

## Overview

The system uses two separate datasets:

1. **Layout** — structure, grid, nesting. References content via `code`.
2. **Content** — flat array of blocks with text, images, navigation, and i18n.

This separation follows the project's data-driven architecture: layout defines *how* to display, content defines *what* to display. Content blocks use the same `code` + `block` (with `i18n`) pattern as the rest of the project (see CLAUDE.md "Data & i18n"). All user-facing text is resolved through `getBlock()` from `xfw-get-block`.

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

#### 5. Horizontal container — grid + cols

```json
{
  "grid": "2fr 1fr",
  "cols": [
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
  "cols": [
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

### Recursion

Any item in `sections` or `cols` can itself contain `sections` or `cols`:

```json
{
  "sections": [
    { "code": "intro" },
    {
      "grid": "2fr 1fr",
      "cols": [
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
  ]
}
```

### Section properties

| Field | Type | Description |
|---|---|---|
| `code` | `string` | Reference to content block |
| `data_group` | `string` | Reference to a `DataGroup` (rendered via `WidgetRenderer`) |
| `nav` | `NavItem[]` | Optional. Navigation items (links, buttons with routing) |
| `area` | `string` | Grid area name (when using `grid.areas`) |
| `class_name` | `string` | Optional. CSS class (defined in `app.css`) |
| `grid` | `string \| GridConfig` | Grid definition (turns children into a horizontal layout) |
| `cols` | `Section[]` | Horizontal children (requires `grid`) |
| `sections` | `Section[]` | Vertical children |
| `params` | `ParamValue[]` | Optional. Parameters for `data_group` (uses `ParamValue` from `xfw-data`) |

Rules:
- `cols` and `sections` are mutually exclusive at the same level
- `cols` requires `grid`
- A leaf has `code`, `data_group`, `nav`, or any combination — but no `cols`/`sections`

---

## Content schema

Flat array following the project's `code` + `block` (with `i18n`) pattern. Resolved via `getBlock()` from `xfw-get-block`.

### Text block

```json
{
  "code": "inhaker-support.footplates.intro",
  "block": {
    "title": "Voetplaten",
    "text": "Wanneer kies je voor welke voetplaat?",
    "i18n": {
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

### Text block (navigation is in layout, not here)

```json
{
  "code": "inhaker-support.freestanding-passive",
  "block": {
    "title": "Vrijstaande Inhaker (passief)",
    "text": "Heb je een vrijstaande Inhaker waar geen legplanken of 'interactieve' elementen aan zitten, dan is de Inhaker voet 400 x 400 x 6 mm een prima oplossing.",
    "i18n": {
      "en": {
        "title": "Freestanding Inhaker (passive)",
        "text": "If you have a freestanding Inhaker without shelves or 'interactive' elements, the Inhaker base 400 x 400 x 6 mm is a great solution."
      },
      "de": {
        "title": "Freistehender Inhaker (passiv)",
        "text": "Wenn Sie einen freistehenden Inhaker haben, der keine Ablagen oder 'interaktive' Elemente hat, ist der Inhaker Sockel 400 x 400 x 6 mm eine großartige Lösung."
      },
      "fr": {
        "title": "Inhaker (passif)",
        "text": "Si vous avez un Inhaker autoportant sans étagères ou éléments 'interactifs', le Inhaker base 400 x 400 x 6 mm est une excellente solution."
      }
    }
  }
}
```

The navigation for this block lives in the layout:

```json
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
}
```

### System block

```json
{
  "code": "system.login-required",
  "block": {
    "title": "Inloggen noodzakelijk",
    "text": "Om deze pagina te bekijken moet u ingelogd zijn.",
    "i18n": {
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
| `title` | `string` | Title (default language) |
| `text` | `string` | Body text (default language) |
| `type` | `string` | Optional. Block type: `"image"`, `"video"`, etc. Default = text |
| `image_url` | `string` | Image URL |
| `aspect_ratio` | `string` | CSS aspect-ratio value |
| `object_fit` | `string` | CSS object-fit value |
| `title_class` | `string` | Optional. CSS class for title (defined in `app.css`) |
| `text_class` | `string` | Optional. CSS class for text (defined in `app.css`) |
| `i18n` | `Record<string, { title?, text?, ... }>` | Translations per language code |

> **Note:** Navigation (`nav`) is a layout concern, not content. Nav items are defined on the section in the layout schema, not in the content block. This keeps content purely display-oriented (text, images, translations) while routing behavior stays in the layout.

### Nav item properties (on Section, not on content block)

| Field | Type | Description |
|---|---|---|
| `text` | `string` | Link text (default language) |
| `icon` | `string` | Icon identifier |
| `path` | `string` | URL template with `{lang}` placeholder |
| `params` | `ParamValue[]` | Query/route parameters (uses `ParamValue` from `xfw-data`) |
| `i18n` | `Record<string, { text?, path? }>` | Translations per language code |

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
      "cols": [
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
      "cols": [
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
      "title": "Voetplaten",
      "title_class": "border-left-thick",
      "text": "Wanneer kies je voor welke voetplaat?",
      "text_class": "large",
      "i18n": {
        "en": { "title": "Footplates", "text": "When do you choose which footplate?" },
        "de": { "title": "Fußplatten", "text": "Wann wählen Sie welche Fußplatte?" },
        "fr": { "title": "Plaques de base", "text": "Quand choisir le repose-pieds ?" }
      }
    }
  },
  {
    "code": "inhaker-support.freestanding-passive",
    "block": {
      "title": "Vrijstaande Inhaker (passief)",
      "text": "Heb je een vrijstaande Inhaker waar geen legplanken of 'interactieve' elementen aan zitten, dan is de Inhaker voet 400 x 400 x 6 mm een prima oplossing.",
      "i18n": {
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
      "title": "Inloggen noodzakelijk",
      "text": "Om deze pagina te bekijken moet u ingelogd zijn.",
      "i18n": {
        "en": { "title": "Login required", "text": "To view this page you need to be logged in." },
        "de": { "title": "Anmeldung erforderlich", "text": "Um diese Seite anzuzeigen, müssen Sie eingeloggt sein." },
        "fr": { "title": "Connexion requise", "text": "Pour voir cette page, vous devez être connecté." }
      }
    }
  },
  {
    "code": "inhaker-support.stand-construction",
    "block": {
      "title": "Standbouw",
      "text": "Bij standbouw kies je voor de Inhaker zware voet 250 x 250 x 20 mm.",
      "i18n": {
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
  if section.grid + section.cols:
    create grid container with grid-template-columns (and areas/rows/gap if object)
    for each col: renderSection(col)
  if section.sections:
    for each child: renderSection(child)
  if section.code:
    look up content block by code → render block (resolve i18n via getBlock())
  if section.data_group:
    load DataGroup → render via WidgetRenderer
  if section.nav:
    render navigation items (links/buttons with routing via xfw-url)
```

---

## Integration with existing architecture

- **Content blocks** use the same `code` + `block` + `i18n` pattern as `data/ui-labels.json`, `data/materials.json` content arrays, etc. Resolved via `getBlock()` from `xfw-get-block`.
- **Data components** (`data_group`) are rendered through `WidgetRenderer` (`src/widgets/WidgetRenderer.tsx`), which dispatches based on `DataGroup.layout`.
- **Parameters** on nav items and data groups use `ParamValue` from `xfw-data`, consistent with the existing parameter system.
- **CSS classes** referenced in `class_name`, `title_class`, `text_class` are defined in `src/app.css` — no Tailwind or external CSS frameworks.
- **Routing** — nav item `path` values with `{lang}` placeholder integrate with `xfw-url` routing system.
