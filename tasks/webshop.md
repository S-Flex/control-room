# Probo Webshop — Simplified Architecture Proposal

## 1. Waarom dit document

De huidige FigJam-architectuur (7 pagina's, 6 domeinen, ~40 componenten) beschrijft een
systeem dat gebouwd is alsof alles tegelijk live moet. Het bevat dubbele pricing-engines
(WASM client + server-side), een apart AI-agentsysteem met 3 search-lagen, een los
event-store, een BOM-engine, een aparte Atlas-sync, Redis voor caching/queues/sessions,
ActiveCampaign, Storyblok CMS, SFlex web-component, Entra SSO, GTM Server-Side, Clarity,
LangSmith monitoring — en dat alles voor een B2B-shop met ~600 producten.

Dit voorstel beschrijft een architectuur die **dezelfde kernfunctionaliteit** levert met
een fractie van de complexiteit, maar wél zo is opgezet dat AI-agents, MCP-tooling en
generatieve UI er native in passen.

---

## 2. Scope van de eerste versie

| Wel                                  | Niet (nog niet)                        |
|--------------------------------------|----------------------------------------|
| Productcatalogus op SKU-niveau       | BOM Engine / Bill of Materials         |
| Configurator met live pricing        | WASM Rust pricing in browser           |
| File uploader met preview            | SFlex web-component                    |
| Relatiebeheer (bedrijf + gebruiker)  | ActiveCampaign / RFM                   |
| Factuur- en orderoverzichten         | Event Store (append-only analytics)    |
| Mollie betalingen                    | Entra Admin SSO                        |
| Cognito authenticatie                | Redis / ElastiCache                    |
| MCP-ready API-laag                   | LangSmith monitoring                   |
| Agent2UI-ready frontend              | GTM Server-Side / Clarity              |
|                                      | Storyblok CMS                          |
|                                      | 3-layer search architecture            |

---

## 3. Architectuurprincipes

### 3.1 Semantische data als fundament

Elke entiteit in het systeem heeft een **semantisch schema** — geen ad-hoc velden, geen
"metadata bags". Dit betekent:

- **Producten** worden beschreven met getypeerde optie-bomen: elke optie heeft een `kind`
  (materiaal, afmeting, finishing, kleur), een `constraint`-set, en een `pricing_effect`.
  Een product is geen platte rij; het is een boom van configureerbare dimensies.

- **SKU's** zijn deterministisch afleidbaar uit een configuratie. De SKU is een functie
  van gekozen opties → geen aparte "SKU Generator" nodig, maar een pure mapping-functie
  in de domain-laag.

- **Prijzen** zijn semantisch gekoppeld aan optie-combinaties via staffel-regels. Eén
  pricing-tabel, één berekeningsfunctie, server-side. Geen dubbele engine.

- **Orders** dragen hun volledige configuratie-snapshot mee als gestructureerde data
  (niet als losse velden), zodat elke downstream-consumer (dispatch, factuur, agent) de
  order kan interpreteren zonder extra lookups.

- **Klanten** zijn gemodelleerd als `Organization → User`-hiërarchie met een `tier`,
  `market`, en `currency` op organisatieniveau — direct uit het Cognito JWT.

Het voordeel: als de data semantisch rijk is, hoeft de UI niet slim te zijn. Een
generieke FieldRenderer kan elke configurator renderen. Een AI-agent kan elke order
interpreteren. Een MCP-tool kan elk product doorzoeken.

### 3.2 Generieke componenten, geen productkennis in de frontend

De frontend bevat **nul productspecifieke logica**. Alle intelligence zit in de
configuratie-data:

- **`<FieldRenderer>`** — Neemt een JSON optie-boom en rendert formuliervelden. Kent
  geen producten, alleen veldtypen (select, number, color, upload, toggle). Visibility-
  rules en validatie zitten in de data.

- **`<PriceDisplay>`** — Abonneert op een pricing-endpoint. Stuurt de huidige
  configuratie-state, krijgt een prijs terug. Geen lokale berekening.

- **`<FileUploader>`** — Generiek upload-component met preview. Accepteert constraints
  uit de product-config (toegestane formaten, max DPI, kleurruimte). Genereert een
  preview-thumbnail client-side.

- **`<DataTable>`** — Generiek tabel/lijst-component voor orders, facturen, relaties.
  Configureerbaar via een column-definitie. Sorteren, filteren, pagineren.

- **`<ChatWidget>`** — AG-UI protocol widget. Bidirectioneel met de backend. Kan
  generatieve UI-fragmenten renderen (productkaarten, configuratie-samenvattingen).

### 3.3 Agent2UI & MCP als eersteklas burgers

In plaats van een AI-systeem als apart domein (Detail C in het huidige ontwerp) met eigen
LangGraph orchestratie, eigen MCP-server, eigen WebSocket-server en 3 search-lagen,
bouwen we de hele API zo dat een agent er direct mee kan werken:

- **Elke API-route is een potentiële MCP-tool.** De REST API wordt beschreven met
  OpenAPI 3.1 + semantische annotaties. Een MCP-server is dan slechts een dunne adapter
  die OpenAPI-specs vertaalt naar MCP tool-definities — geen aparte "Data Enrichment"
  laag nodig.

- **De frontend spreekt AG-UI protocol.** De ChatWidget is niet een los ding; het is een
  rendering-target voor agent-output. De agent kan via hetzelfde protocol productkaarten
  tonen, configuraties voorstellen, en cart-acties uitvoeren.

- **Zoeken is één ding.** Typesense full-text search met facetten. Geen 3-lagen-
  architectuur met intent-classifier. De agent kan direct Typesense queries bouwen via
  een MCP-tool. Voor de MVP is dit meer dan voldoende met 600 producten.

- **Autonomie-grenzen zitten in de API, niet in de agent.** De API bepaalt wat een agent
  mag (read-only of write), niet een aparte "autonomy boundaries JSON ruling".

---

## 4. Systeemoverzicht
```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND                             │
│        Next.js + React + TypeScript + SSR                │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐  │
│  │FieldRen- │ │FileUp-   │ │Price-  │ │ ChatWidget   │  │
│  │derer     │ │loader    │ │Display │ │ (AG-UI)      │  │
│  └──────────┘ └──────────┘ └────────┘ └──────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────┐ │
│  │DataTable │ │Cart/     │ │ Pagina's: Catalogus,     │ │
│  │(generiek)│ │Checkout  │ │ PDP, Cart, Account,      │ │
│  └──────────┘ └──────────┘ │ Orders, Facturen         │ │
│                             └──────────────────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS / REST
┌────────────────────▼────────────────────────────────────┐
│                    API LAYER                              │
│          Node.js / Hono of Fastify                       │
│          OpenAPI 3.1 spec (= MCP bron)                   │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Domein-modules (niet aparte services):              │ │
│  │                                                     │ │
│  │  catalog/    → producten, optie-bomen, SKU-mapping  │ │
│  │  pricing/    → staffel, tier, berekening            │ │
│  │  cart/       → cart CRUD, line items, configuratie   │ │
│  │  checkout/   → validatie, lock, Mollie sessie       │ │
│  │  order/      → order creatie, status, dispatch      │ │
│  │  customer/   → organisatie, gebruikers, tiers       │ │
│  │  upload/     → file handling, validatie, S3 upload  │ │
│  │  invoice/    → factuuroverzicht, PDF generatie      │ │
│  │  search/     → Typesense queries                    │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐                      │
│  │ Cognito Auth │  │ Mollie PSP   │                      │
│  │ middleware   │  │ integration  │                       │
│  └──────────────┘  └──────────────┘                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │ MCP Adapter                                       │   │
│  │ Leest OpenAPI spec → exposeert MCP tools          │   │
│  │ Geen aparte "data enrichment" of "MCP server"     │   │
│  └──────────────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   DATA LAYER                             │
│                                                          │
│  ┌──────────────────────┐  ┌────────────────────────┐   │
│  │ PostgreSQL (single)  │  │ Typesense Cloud        │   │
│  │                      │  │ ~600 producten          │   │
│  │ • products           │  │ facetten, synoniemen    │   │
│  │ • option_trees       │  └────────────────────────┘   │
│  │ • pricing_rules      │                               │
│  │ • sku_mappings       │  ┌────────────────────────┐   │
│  │ • customers/orgs     │  │ S3 / R2                │   │
│  │ • carts + line_items │  │ uploads, previews,     │   │
│  │ • orders             │  │ gegenereerde PDFs      │   │
│  │ • invoices           │  └────────────────────────┘   │
│  │ • dispatch_log       │                               │
│  └──────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Domein-modules in detail

### 5.1 `catalog/` — Productcatalogus op SKU-niveau

Eén tabel `products` met een JSONB `option_tree` kolom. De optie-boom beschrijft alle
configureerbare dimensies van een product semantisch:
```json
{
  "product_id": "canvas-print",
  "name": { "nl": "Canvas Print", "de": "Leinwanddruck" },
  "option_tree": [
    {
      "key": "size",
      "kind": "dimension",
      "label": { "nl": "Formaat", "de": "Format" },
      "options": [
        { "value": "20x30", "sku_segment": "2030" },
        { "value": "40x60", "sku_segment": "4060" }
      ]
    },
    {
      "key": "material",
      "kind": "material",
      "label": { "nl": "Materiaal" },
      "options": [
        { "value": "cotton", "sku_segment": "COT", "pricing_modifier": 1.0 },
        { "value": "poly", "sku_segment": "POL", "pricing_modifier": 0.85 }
      ]
    },
    {
      "key": "finishing",
      "kind": "finishing",
      "depends_on": { "material": ["cotton"] },
      "options": [...]
    }
  ]
}
```

De **SKU is een pure functie**: `sku = product_prefix + join(geselecteerde sku_segments)`.
Geen aparte SKU Generator service, geen Mapping Table, geen Atlas Sync. De catalogus is
de single source of truth, en Typesense wordt gesynchroniseerd via een simpele
database-trigger of scheduled job.

### 5.2 `pricing/` — Eén pricing engine, server-side

Geen WASM-module in de browser, geen aparte client-side engine. Eén endpoint:
```
POST /api/pricing/calculate
Body: { product_id, configuration: { size: "40x60", material: "cotton", ... }, quantity, customer_tier }
Response: { unit_price, staffel_prices: [...], total, currency }
```

De pricing-logica:

- Basis: `base_price` per product
- Opties: elke optie heeft een `pricing_modifier` (factor) of `pricing_addition` (vast bedrag)
- Staffel: hoeveelheidskorting per tier (`[ {min: 1, factor: 1.0}, {min: 10, factor: 0.92}, ... ]`)
- Tier: klantniveau-korting (reseller, groothandel)
- Alles in één SQL-query + applicatielogica. Bij 600 producten geen caching nodig.

De frontend roept dit endpoint aan bij elke configuratiewijziging (debounced). Geen
dubbele validatie, geen WASM, geen Redis pricing cache.

### 5.3 `cart/` + `checkout/` — Eenvoudige winkelwagen

Een cart bevat line_items, elk met:
- `product_id`
- `configuration` (volledige snapshot van gekozen opties)
- `sku` (afgeleid)
- `quantity`
- `unit_price` (op moment van toevoegen, herberekend bij checkout)
- `upload_refs[]` (verwijzingen naar geüploade bestanden in S3)

Checkout-flow:
1. **Lock**: snapshot alle prijzen, herbereken server-side, vergelijk met cart-prijzen
2. **Validate**: alle configuraties produceerbaar? alle uploads aanwezig?
3. **Mollie sessie**: creëer betaling (iDEAL, SEPA, creditcard, Klarna, on-account)
4. **Webhook**: Mollie bevestigt → order aanmaken
5. **Dispatch**: order + configuratie + bestanden doorsturen naar ProboView/productie

Geen "Multi-Cart Container", geen "PaymentGroup", geen apart "Events (collects from
steps 2, 3, 5)". Eén lineair flow, één transactie.

### 5.4 `upload/` — File uploader met preview

Constraints komen uit de product-config:
```json
{
  "upload_spec": {
    "accepted_formats": ["pdf", "png", "jpg", "tiff"],
    "max_size_mb": 100,
    "min_dpi": 150,
    "color_space": "CMYK",
    "bleed_mm": 3
  }
}
```

Upload-flow:
1. Client-side: formaat-check, bestandsgrootte-check, thumbnail-generatie
2. Presigned S3 URL → directe upload naar S3 (geen file door de API)
3. Server-side async: DPI-check, kleurruimte-validatie, PDF-naar-SVG extractie voor
   individualisering (als nodig)
4. Preview-URL terug naar frontend

Geen aparte "SFlex Web Component" voor Type C producten. De uploader is generiek; de
constraints komen uit de data.

### 5.5 `customer/` — Relatiebeheer

Cognito levert het JWT met: `organization_id`, `role`, `tier`, `market`, `locale`,
`currency`.

De database houdt bij:
- `organizations`: bedrijfsnaam, adres(sen), BTW-nummer, tier, betaalcondities
- `users`: gekoppeld aan organization, rol (admin/besteller/viewer)
- `addresses`: factuur- en afleveradressen per organisatie

Geen Entra SSO (dat is voor intern admin, niet voor de shop). Geen aparte "Company entity"
en "User entity" als losstaande concepten — het zijn gewoon tabellen met een relatie.

VIES BTW-validatie: simpele API-call bij registratie, resultaat opslaan.

### 5.6 `order/` + `invoice/` — Overzichten

Orders en facturen zijn views op dezelfde data:

- **Orderoverzicht**: lijst met status (betaald, in productie, verzonden, geleverd),
  filterable op datum, status, product
- **Factuuroverzicht**: gekoppeld aan orders, met PDF-download (gegenereerd bij
  order-creatie, opgeslagen in S3)
- **Orderdetail**: volledige configuratie-snapshot, uploads, tracking-info

De `<DataTable>` component rendert beide overzichten met verschillende column-definities.
Geen aparte "Parts Resolver", geen "Event Collector".

### 5.7 `search/` — Typesense, meer niet

Eén Typesense-collectie met alle producten. Facetten op: categorie, materiaal, formaat,
prijs-range. Synoniemen en typo-tolerantie out of the box.

De frontend gebruikt de Typesense InstantSearch client (server-side rendered voor SEO).
Geen 3-lagen intent classifier. Geen apart "Layer 1 navigational" vs "Layer 3
conversational". Zoeken is zoeken. De AI-agent kan dezelfde Typesense API aanroepen via
een MCP-tool.

---

## 6. MCP & Agent-integratie

### 6.1 MCP Adapter — automatisch uit OpenAPI

De hele API is beschreven in OpenAPI 3.1 met semantische `x-mcp-*` annotaties:
```yaml
paths:
  /api/catalog/products:
    get:
      x-mcp-tool: search_products
      x-mcp-description: "Doorzoek de productcatalogus met optionele filters"
      parameters:
        - name: q
          x-mcp-param-description: "Zoekterm, bijv. 'canvas print' of 'visitekaartjes'"
  /api/pricing/calculate:
    post:
      x-mcp-tool: calculate_price
      x-mcp-description: "Bereken de prijs voor een productconfiguratie"
  /api/cart/{cart_id}/items:
    post:
      x-mcp-tool: add_to_cart
      x-mcp-description: "Voeg een geconfigureerd product toe aan de winkelwagen"
```

Een simpel script leest de OpenAPI-spec en genereert MCP tool-definities. Geen aparte
MCP Server service, geen "Data Enrichment" laag. De API ís de tool-definitie.

### 6.2 AG-UI protocol in de ChatWidget

De `<ChatWidget>` implementeert het AG-UI protocol:

- **Streaming responses**: server-sent events voor real-time agent-output
- **Bidirectionele state-sync**: de agent weet wat de gebruiker in de configurator
  heeft staan (huidige product, gekozen opties, cart-inhoud)
- **Generatieve UI**: de agent kan structured output sturen die de frontend rendert
  als productkaarten, prijsvergelijkingen, of configuratie-suggesties — met dezelfde
  `<FieldRenderer>` en `<PriceDisplay>` componenten die de rest van de app ook gebruikt
- **Tool-calls zichtbaar**: als de agent een prijs opvraagt of iets aan de cart
  toevoegt, ziet de gebruiker dit als een UI-actie (human-in-the-loop)

### 6.3 Wat de agent kan (V1)

Met de MCP-tools die automatisch uit de API komen:

1. **Producten zoeken en aanbevelen** — `search_products` + semantisch begrip van de
   optie-bomen
2. **Prijzen berekenen** — `calculate_price` voor elke configuratie
3. **Configuraties voorstellen** — op basis van klantbeschrijving ("ik wil een groot
   canvas voor buiten") de juiste opties selecteren
4. **Cart beheren** — items toevoegen, wijzigen, verwijderen
5. **Orderstatus opvragen** — `get_orders` met filters

Geen aparte LangGraph orchestratie met "autonomy boundaries JSON ruling". De
beperkingen zitten in de API-permissies (Cognito roles).

---

## 7. Technologiekeuzes

| Laag             | Keuze                    | Waarom                                              |
|------------------|--------------------------|-----------------------------------------------------|
| Frontend         | Next.js + React + TS     | SSR voor SEO, RSC voor performance                  |
| API              | Node.js + Hono           | Lichtgewicht, OpenAPI-native, edge-ready             |
| Auth             | AWS Cognito              | B2B JWT met org/role/tier claims, hosted UI          |
| Betaling         | Mollie                   | iDEAL, SEPA, creditcard, Klarna, on-account         |
| Database         | PostgreSQL (single)      | JSONB voor optie-bomen, alles in één DB              |
| Search           | Typesense Cloud          | Hosted, snel, facetten, typo-tolerant                |
| File storage     | S3                       | Presigned uploads, goedkoop, betrouwbaar             |
| Hosting          | ECS Fargate of SST       | Container of serverless, afhankelijk van voorkeur    |
| MCP              | Auto-generated uit API   | Geen aparte service                                  |
| Agent LLM        | Claude via API            | Geen LangGraph/LangSmith overhead voor V1           |
| i18n             | next-intl                | Standaard, route-based (/nl/, /de/, /en/)            |

**Bewust niet:**

| Niet                  | Waarom niet (nog)                                             |
|-----------------------|---------------------------------------------------------------|
| Redis                 | 600 producten, pricing is snel genoeg zonder cache            |
| WASM Pricing          | Eén server-side engine is genoeg, geen dubbele logica         |
| Medusa Commerce       | Te veel abstractie voor wat een custom API sneller kan        |
| Storyblok CMS         | Productcontent zit in de DB, marketingpages kunnen later      |
| ActiveCampaign        | CRM/RFM kan later, eerst orders draaien                       |
| Event Store           | Simpele audit-log in PostgreSQL is genoeg voor V1             |
| Entra SSO             | Alleen voor intern, niet nodig voor de B2B-shop               |
| BOM Engine            | Productie-integratie via dispatch, geen runtime BOM nodig     |
| LangGraph/LangSmith   | Claude direct aanroepen, agent-logic in applicatiecode        |
| 3-layer search        | Eén Typesense-index, agent kan dezelfde API gebruiken         |
| SFlex Web Component   | Generieke uploader met constraints uit product-config         |
| GTM SS / Clarity      | Analytics later, eerst het product bouwen                     |

---

## 8. Data-model (kerntabellen)
```sql
-- Producten met semantische optie-bomen
CREATE TABLE products (
    id              UUID PRIMARY KEY,
    slug            TEXT UNIQUE NOT NULL,
    sku_prefix      TEXT NOT NULL,
    name            JSONB NOT NULL,         -- {"nl": "...", "de": "...", "en": "..."}
    description     JSONB,
    option_tree     JSONB NOT NULL,         -- volledige configuratie-schema
    pricing_rules   JSONB NOT NULL,         -- staffels, tier-kortingen, optieprijzen
    upload_spec     JSONB,                  -- constraints voor file uploads
    category        TEXT NOT NULL,
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Organisaties (B2B klanten)
CREATE TABLE organizations (
    id              UUID PRIMARY KEY,
    cognito_org_id  TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    vat_number      TEXT,
    vat_verified    BOOLEAN DEFAULT false,
    tier            TEXT NOT NULL DEFAULT 'standard',  -- standard, reseller, wholesale
    market          TEXT NOT NULL,                      -- nl, de, be, ...
    currency        TEXT NOT NULL DEFAULT 'EUR',
    payment_terms   TEXT DEFAULT 'prepaid',             -- prepaid, net30, net60
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Gebruikers (gekoppeld aan organisatie)
CREATE TABLE users (
    id              UUID PRIMARY KEY,
    cognito_user_id TEXT UNIQUE NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    email           TEXT NOT NULL,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'orderer',    -- admin, orderer, viewer
    locale          TEXT NOT NULL DEFAULT 'nl'
);

-- Adressen
CREATE TABLE addresses (
    id              UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    type            TEXT NOT NULL,   -- billing, shipping
    line1           TEXT, city TEXT, postal_code TEXT, country TEXT,
    is_default      BOOLEAN DEFAULT false
);

-- Winkelwagen
CREATE TABLE carts (
    id              UUID PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    status          TEXT DEFAULT 'active',  -- active, checked_out, expired
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cart_items (
    id              UUID PRIMARY KEY,
    cart_id         UUID REFERENCES carts(id) ON DELETE CASCADE,
    product_id      UUID REFERENCES products(id),
    configuration   JSONB NOT NULL,          -- snapshot van gekozen opties
    derived_sku     TEXT NOT NULL,            -- berekend uit configuratie
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit_price      NUMERIC(10,2),           -- laatst berekende prijs
    upload_refs     JSONB DEFAULT '[]',      -- S3 keys van geüploade bestanden
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Orders
CREATE TABLE orders (
    id              UUID PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    status          TEXT NOT NULL DEFAULT 'pending_payment',
    mollie_payment_id TEXT,
    shipping_address_id UUID REFERENCES addresses(id),
    billing_address_id  UUID REFERENCES addresses(id),
    subtotal        NUMERIC(10,2),
    vat_amount      NUMERIC(10,2),
    total           NUMERIC(10,2),
    currency        TEXT DEFAULT 'EUR',
    dispatch_status TEXT DEFAULT 'pending',   -- pending, dispatched, in_production, shipped, delivered
    dispatch_ref    TEXT,                     -- referentie naar ProboView/productie
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_items (
    id              UUID PRIMARY KEY,
    order_id        UUID REFERENCES orders(id),
    product_id      UUID REFERENCES products(id),
    configuration   JSONB NOT NULL,
    derived_sku     TEXT NOT NULL,
    quantity        INTEGER NOT NULL,
    unit_price      NUMERIC(10,2) NOT NULL,
    upload_refs     JSONB DEFAULT '[]'
);

-- Facturen
CREATE TABLE invoices (
    id              UUID PRIMARY KEY,
    order_id        UUID REFERENCES orders(id),
    invoice_number  TEXT UNIQUE NOT NULL,
    pdf_s3_key      TEXT,
    amount          NUMERIC(10,2) NOT NULL,
    status          TEXT DEFAULT 'open',      -- open, paid, overdue
    due_date        DATE,
    created_at      TIMESTAMPTZ DEFAULT now()
);
```

De kracht van dit model: **elke tabel is semantisch volledig**. Een order_item bevat de
volledige configuratie als JSONB — geen joins nodig naar een apart config-systeem. De
`option_tree` in `products` is het schema; de `configuration` in `cart_items` en
`order_items` is een instantie van dat schema.

---

## 9. Vergelijking: huidig vs. voorstel

| Aspect                    | Huidig ontwerp              | Dit voorstel                      |
|---------------------------|-----------------------------|------------------------------------|
| Pricing engines           | 2 (WASM + server)          | 1 (server-side)                   |
| Databases                 | 6 (Commerce, Config, Event, Redis, Typesense, S3) | 3 (PostgreSQL, Typesense, S3) |
| Aparte services           | ~8 (Medusa, ProboHub, MCP Server, Atlas, BOM, ...) | 1 monoliet met modules     |
| Search architectuur       | 3 lagen + intent classifier | 1 Typesense index                 |
| CMS systemen              | 2 (Storyblok + i18n JSON)  | 1 (i18n JSON in codebase)         |
| Auth providers             | 2 (Cognito + Entra)        | 1 (Cognito)                       |
| Analytics/tracking        | 4 (GTM SS, Clarity, ActiveCampaign, Event Store) | Later toevoegen      |
| Agent-integratie           | Apart domein (Detail C)    | Native via OpenAPI → MCP          |
| Frontend product-kennis    | Ja (SFlex, WASM)           | Nee (generieke componenten)       |
| Deploy-complexiteit        | Multi-service ECS           | Single container + static frontend|
| Verwachte time-to-market   | 6-9 maanden                | 2-3 maanden                       |

---

## 10. Groeipad

Het voorstel is bewust minimaal, maar het fundament (semantische data, generieke
componenten, OpenAPI-als-MCP) maakt uitbreiding triviaal:

1. **Redis toevoegen** — als performance dat vereist (pricing cache, session store).
   Eén config-wijziging.

2. **Event Store** — PostgreSQL tabel met append-only events. Geen apart systeem,
   gewoon een extra module.

3. **ActiveCampaign / CRM** — webhook bij order-creatie, stuurt klant- en orderdata.
   Eén integratie-module.

4. **BOM Engine** — als productie dat nodig heeft. Extra JSONB-kolom op product met
   material-breakdown.

5. **WASM Pricing** — als 600 producten 6000 worden en latency een probleem is. Dan
   kun je de pricing-functie compileren naar WASM, maar met dezelfde logica.

6. **Storyblok / CMS** — voor marketing-pagina's, landingspages, blog. Niet voor
   productcontent.

7. **Entra SSO** — voor intern admin-panel, apart van de B2B-shop.

8. **Advanced Agent** — LangGraph orchestratie als de use cases complexer worden.
   Het MCP-fundament is er al.

---

## 11. Samenvatting

Stop met het bouwen van 7 systemen die met elkaar praten. Bouw één systeem met rijke
data, generieke componenten, en een API die zo goed beschreven is dat zowel een
frontend als een AI-agent er direct mee kan werken. De complexiteit zit in de data,
niet in de architectuur.