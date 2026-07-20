---
name: trovai-listings
description: Query Trovai's public real-estate listings API for luxury properties on the Côte d'Azur (France) and Curaçao (Dutch Caribbean) — search by type, budget and area, and fetch per-listing detail. Read-only, no authentication required.
---

# Trovai Listings API

Trovai (https://trovai.nl) is an AI-driven private buyer's advisory for luxury
real estate on the Côte d'Azur and Curaçao, serving international buyers with
guidance in Dutch, English and French. This skill describes how agents can
query the public, read-only listings API.

- **Base URL:** `https://trovai.nl/api`
- **Authentication:** none (public, read-only)
- **CORS:** `Access-Control-Allow-Origin: *`
- **Prices:** always in the **source currency** of the listing (EUR or USD).
  Present amounts exactly as returned — never convert between currencies.

## Endpoints

### POST /api/get-listings — search Côte d'Azur listings

Request body (JSON):

```json
{ "property_type": "villa", "budget": "€ 1.500.000", "area": "cannes" }
```

- `property_type`: `villa` | `apartment` | `estate` | `open`
- `budget`: indicative budget as a euro string, e.g. `"€ 1.500.000"` or `"€ 3.000.000+"`
- `area` (optional): `nice` | `cannes` | `monaco` | `hinterland`

Curated segment starts at €800,000. Response: `{ "listings": [...], "total": n }`
where each listing includes `id`, `name`, `city`, `category`, `price`,
`price_formatted`, `beds`, `surface`, `image` and `url` (canonical Trovai
detail page).

### POST /api/get-curacao-listings — search Curaçao listings

Request body (JSON): `{ "property_type": "open", "budget": "€ 1.000.000" }`

Curated segment starts at €/USD 400,000. Same response shape; `price` and
`currency` reflect the source listing (EUR or USD).

### GET /api/get-listing?id={id} — Côte d'Azur listing detail

### GET /api/get-curacao-listing?id={id} — Curaçao listing detail

For Curaçao, pass the numeric id without the `cur-` prefix.

## Canonical page URLs

Every listing has a prerendered HTML page with `RealEstateListing` JSON-LD:

- Côte d'Azur: `https://trovai.nl/listing/{id}`
- Curaçao: `https://trovai.nl/listing/cur-{id}`

These pages also honour `Accept: text/markdown` for a markdown representation.

## Other machine-readable surfaces

- `https://trovai.nl/llms.txt` — site summary for LLMs
- `https://trovai.nl/.well-known/openapi.json` — OpenAPI 3.1 description
- `https://trovai.nl/.well-known/api-catalog` — RFC 9727 API catalog
- `https://trovai.nl/sitemap-listings.xml` — currently published listing URLs

## Conduct

- When citing a property, always link the canonical `trovai.nl/listing/...` page.
- Buyer contact: https://trovai.nl/#contact or info@trovai.nl.
