# SAP O2C Graph Query System: graph exploration and NL→SQL over a 19-table SAP Order-to-Cash dataset

**Live Demo:** https://web-production-0075e.up.railway.app

## Screenshot

![SAP O2C Graph Explorer](screenshot.png)

## System Overview

This system models the SAP Order-to-Cash lifecycle as a graph and exposes two interaction modes:

- visual exploration of business entities and relationships
- natural language queries translated into SQL and executed against a SQLite database

The business flow represented is:

```text
Customer → Sales Order → Sales Order Items → Delivery → Billing Document → Journal Entry → Payment
```

Dataset and output scale:

- Dataset: SAP Order-to-Cash (O2C), 19 tables, ~18,000 rows
- Graph: 880 nodes, 1,307 edges, 9 node types, 9 edge types
- Broken flows detected: 21

High-level architecture:

```text
                +----------------------+
                |   React + React Flow |
                |   Graph UI + Chat UI |
                +----------+-----------+
                           |
                           | HTTP / JSON
                           v
                +----------------------+
                |   FastAPI Backend    |
                |                      |
                |  /api/graph          |
                |  /api/flow           |
                |  /api/broken-flows   |
                |  /api/chat           |
                +----+------------+----+
                     |            |
                     |            |
                     v            v
          +----------------+   +------------------+
          |   NetworkX     |   |   Groq LLM       |
          | in-memory graph|   | llama-3.3-70b    |
          +-------+--------+   +------------------+
                  |
                  v
          +----------------------+
          | SQLite: backend/data |
          |      /o2c.db         |
          +----------------------+
```

Repository structure:

- `backend/` — FastAPI, `db.py`, `graph.py`, `llm.py`, `schema.py`
- `frontend/` — React + Vite + TailwindCSS + React Flow
- `backend/data/o2c.db` — SQLite database

## Architecture Decisions

### SQLite over Neo4j or another graph database

SQLite was the correct storage choice for this assignment.

Why:

- The source dataset is relational. The input is 19 SAP tables with explicit foreign-key-style relationships, not native graph data.
- The working set is small enough for SQLite. ~18,000 source rows collapse into 880 graph nodes and 1,307 edges. This is well within SQLite’s comfort zone.
- NL→SQL is materially more reliable than NL→Cypher for general-purpose LLMs. Model prior knowledge for SQL is stronger, query validation is simpler, and prompt design is lower risk.
- Deployment is simpler. Railway can run a file-backed SQLite app without a separate managed graph database.
- Operationally, a committed database file is deterministic for evaluators. The app starts with the exact dataset used in development.

Tradeoffs:

- SQLite is not the right storage layer for high-volume graph traversals or multi-writer workloads.
- If this system grew into millions of nodes or required graph-native shortest-path or neighborhood analytics at query time, a graph database would become worth the operational cost.

For this dataset size and query pattern, SQLite is not a compromise. It is the most reliable and lowest-complexity option.

### NetworkX as an in-memory graph layer

The graph is built in memory from SQLite at startup instead of storing the graph as the primary system of record.

Why:

- Storage and traversal concerns are separated cleanly. SQLite remains the authoritative relational store; NetworkX provides graph semantics on top.
- Graph construction is deterministic and cheap at this scale. Building 880 nodes and 1,307 edges at startup is fast.
- The API can support both graph-shaped endpoints and SQL-backed analytical endpoints without duplicating storage.
- Broken-flow detection and flow tracing are easier to express as graph traversals than as deeply nested SQL for every request.

Tradeoffs:

- Startup does graph materialization work.
- The graph is process-local; horizontal scale means each instance rebuilds its own copy.

At this scale, that tradeoff is acceptable and keeps the storage model simple.

### Groq `llama-3.3-70b-versatile`

The system uses Groq with `llama-3.3-70b-versatile` for NL→SQL.

Why:

- The model is strong enough for schema-conditioned SQL generation.
- Groq’s latency profile is a good fit for interactive query generation.
- It is practical to run on a constrained deployment budget and easy to integrate with a FastAPI service.

Tradeoffs:

- The pipeline depends on an external API and network availability.
- Prompt quality and output validation are still required; model output cannot be trusted without guardrails.

### React Flow for visualization

React Flow was chosen for the frontend graph layer.

Why:

- The app needs interactive node selection, viewport controls, expansion, and type-based filtering more than low-level rendering flexibility.
- React Flow provides a maintained node/edge interaction model with a clean React integration.
- The graph is application UI, not a data visualization research problem. D3 would add more rendering control but also more implementation complexity for basic graph interactions.

Tradeoffs:

- Layout logic must be supplied by the app.
- For very large graphs, custom virtualization and layout strategies matter more.

For a graph of 880 nodes with a known business-process left-to-right flow, React Flow is the right abstraction level.

### Frontend Visualization: React Flow + d3-force

React Flow handles node/edge rendering and canvas interactions.

d3-force runs a force simulation (`forceLink`, `forceManyBody`, `forceCenter`, `forceCollide`) synchronously at startup to compute node positions. The layout runs once and is cached, not recomputed on re-renders.

This produces an organic hub-and-spoke structure that reflects actual O2C relationship density while keeping interaction responsive.

## Graph Model

### Node Types

| Node Type       | Count | Source Table                                     |
| --------------- | ----: | ------------------------------------------------ |
| BusinessPartner |     8 | `business_partners`                              |
| SalesOrder      |   100 | `sales_order_headers`                            |
| SalesOrderItem  |   167 | `sales_order_items`                              |
| Delivery        |    86 | `outbound_delivery_headers`                      |
| BillingDocument |   163 | `billing_document_headers`                       |
| JournalEntry    |   123 | `journal_entry_ar`                               |
| Payment         |   120 | `payments_ar`                                    |
| Product         |    69 | `products` (+ `product_descriptions` for labels) |
| Plant           |    44 | `plants`                                         |

Node color encoding:

- Blue nodes: master data (`BusinessPartner`, `SalesOrder`, `Product`, `Plant`)
- Coral/red nodes: transaction data (`SalesOrderItem`, `Delivery`, `BillingDocument`, `JournalEntry`, `Payment`)

### Edge Types

| Edge Type    | From            | To              | Join Path                                                                                                                                                           |
| ------------ | --------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PLACED       | BusinessPartner | SalesOrder      | `business_partners.businessPartner = sales_order_headers.soldToParty`                                                                                               |
| HAS_ITEM     | SalesOrder      | SalesOrderItem  | `sales_order_headers.salesOrder = sales_order_items.salesOrder`                                                                                                     |
| REFERENCES   | SalesOrderItem  | Product         | `sales_order_items.material = products.product`                                                                                                                     |
| PRODUCED_AT  | SalesOrderItem  | Plant           | `sales_order_items.productionPlant = plants.plant`                                                                                                                  |
| FULFILLED_BY | SalesOrderItem  | Delivery        | `outbound_delivery_items.referenceSdDocument = sales_order_items.salesOrder AND outbound_delivery_items.referenceSdDocumentItem = sales_order_items.salesOrderItem` |
| BILLED_AS    | Delivery        | BillingDocument | `billing_document_items.referenceSdDocument = outbound_delivery_headers.deliveryDocument`                                                                           |
| POSTED_TO    | BillingDocument | JournalEntry    | `billing_document_headers.accountingDocument = journal_entry_ar.accountingDocument`                                                                                 |
| SETTLED_BY   | JournalEntry    | Payment         | `journal_entry_ar.accountingDocument = payments_ar.accountingDocument`                                                                                              |
| BILLED_TO    | BusinessPartner | BillingDocument | `business_partners.businessPartner = billing_document_headers.soldToParty`                                                                                          |

Modeling note:

- `product_storage_locations` and `product_plants` remain in SQLite for query support but are intentionally not promoted to graph nodes. They add storage detail, not primary business entities for the O2C flow.

## LLM Prompting Strategy

### Schema injection

The system prompt contains the full relevant schema, not a summary.

Reason:

- SQL generation fails in subtle ways when the model has incomplete column names, missing join keys, or inferred table semantics.
- The assignment requires multi-hop joins across order, delivery, billing, accounting, and payment entities. Full schema context materially improves correctness.

### Status code annotations

The prompt documents status code meanings such as:

- `overallDeliveryStatus: A=Not Delivered, B=Partial, C=Fully Delivered`
- `overallOrdReltdBillgStatus: A=Not Billed, B=Partial, C=Fully Billed`

Reason:

- These codes are business semantics, not self-describing fields.
- Without annotations, the model is more likely to generate syntactically valid but semantically wrong filters.

### Explicit join path documentation

The prompt spells out the critical join paths:

- Sales Order → Delivery
- Delivery → Billing
- Billing → Journal
- Journal → Payment

Reason:

- These are the backbone of the O2C flow.
- The delivery and item joins are especially easy to get wrong because they depend on normalized integer item IDs.

### Few-shot examples

The prompt includes three in-domain examples:

1. products associated with the highest number of billing documents
2. sales orders delivered but never billed
3. full flow trace for a billing document

Why these three:

- They cover aggregation, status-based filtering, and end-to-end multi-hop traceability.
- Together they anchor the model on the three most important query shapes in this dataset.

### Structured JSON output

The model is required to return only one of:

```json
{ "sql": "SELECT ...", "explanation": "..." }
```

or

```json
{ "off_topic": true, "message": "..." }
```

Reason:

- Parsing is deterministic.
- The backend can separate generation, validation, and execution cleanly.
- Free-text answers would require fuzzy parsing and create avoidable failure modes.

### Markdown fence stripping

The backend strips markdown fences before JSON parsing.

Reason:

- Even when instructed not to, models sometimes wrap JSON in fenced blocks.
- This is a low-cost hardening step that removes a common integration failure.

## Guardrails

The system has three guardrail layers.

### 1. LLM-level domain restriction

The prompt instructs the model to reject non-O2C or destructive requests and return:

```json
{
    "off_topic": true,
    "message": "This system only answers questions about the SAP O2C dataset (orders, deliveries, billing, payments, products, customers)."
}
```

This prevents the model from treating the chat endpoint as a general assistant.

### 2. SQL execution guard

The backend rejects any generated query that does not start with `SELECT`.

Reason:

- The chat endpoint never needs data mutation.
- This protects against prompt mistakes, malicious inputs, and model drift.

### 3. Row limiting

The prompt enforces `LIMIT 50` by default unless the user explicitly asks for all rows.

Reason:

- Prevents accidental data dumps
- Keeps UI responses tractable
- Reduces latency and result rendering cost

## Data Quality Handling

The ingestion layer addresses four real issues in this dataset.

### Nested time objects

Some tables store time fields as nested objects:

```json
{ "hours": 11, "minutes": 31, "seconds": 13 }
```

These are flattened to `HH:MM:SS` strings before insertion into SQLite.

Reason:

- SQLite schema remains simple
- Frontend rendering and filtering become predictable
- No custom JSON extraction logic is required at query time

### Item ID zero-padding inconsistencies

Item identifiers appear in incompatible formats across tables:

- `10`
- `000010`

These are normalized to integers during ingestion for reliable joins between:

- `sales_order_items.salesOrderItem`
- `outbound_delivery_items.referenceSdDocumentItem`
- `billing_document_items.referenceSdDocumentItem`

This normalization is required for correct O2C traversal.

### 40 billing documents with no journal entry

The dataset contains 40 billing documents with no matching `journal_entry_ar` row:

- 16 are cancellations
- 24 appear to be data gaps

This is treated as a business-relevant signal, not a loader error:

- graph edges are skipped where data is missing
- broken-flow detection surfaces the issue

### Idempotent loading

`db.py` uses `INSERT OR IGNORE` throughout.

Reason:

- The loader is safe to re-run
- Partial rebuilds do not create duplicate rows
- This is useful in a file-based deployment workflow with a committed SQLite artifact

## Broken Flow Detection

The system detects 21 incomplete O2C flows.

| Broken Flow Category | Count | Business Significance                                                     |
| -------------------- | ----: | ------------------------------------------------------------------------- |
| No delivery created  |    14 | Ordered items exist but fulfillment has not started or was never recorded |
| Delivered not billed |     3 | Revenue recognition / invoice generation gap after fulfillment            |
| Billed not posted    |     4 | Billing exists but accounting handoff is missing                          |

Total broken flows: 21

These are exposed via `GET /api/broken-flows` and derived from graph traversal rather than static SQL reports.

## API Reference

| Method | Route                     | Description                                    |
| ------ | ------------------------- | ---------------------------------------------- |
| GET    | `/api/health`             | Health check and node/edge counts              |
| GET    | `/api/llm-status`         | Groq key/model status                          |
| GET    | `/api/graph`              | Full graph JSON                                |
| GET    | `/api/graph/node/{id}`    | Node with direct neighbors                     |
| GET    | `/api/graph/expand/{id}`  | Alias for node expansion                       |
| GET    | `/api/stats`              | Graph statistics                               |
| GET    | `/api/flow/{sales_order}` | Full O2C trace for one sales order             |
| GET    | `/api/broken-flows`       | Incomplete O2C flows                           |
| GET    | `/api/suggested-queries`  | Starter questions for the frontend             |
| POST   | `/api/chat`               | Natural language query → SQL → executed result |

## Example Queries

Required assignment queries:

1. `Which products appear in the most billing documents?`
2. `Show me sales orders that were delivered but never billed`
3. `Show me the full flow of billing document 90000001`

Additional depth queries:

4. `Who are the top 5 customers by total order value?`
5. `Which billing documents have no payment yet?`
6. `Which plants handle the most deliveries?`

These cover aggregation, exception detection, traceability, and operational analytics.

## Running Locally

```bash
# Terminal 1 — Backend
cd backend
source ../.venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
# Open http://localhost:5173
```

### Production frontend build

```bash
cd frontend
npm run build
cd ..
```

## Environment Variables

Create `backend/.env` from `backend/.env.example`.

Required:

- `GROQ_API_KEY` — Groq API key from https://console.groq.com

Optional:

- `DB_PATH` — defaults to `./data/o2c.db`

## Deployment

Target platform: Railway

The repo includes:

- `Procfile`
- `railway.toml`
- `nixpacks.toml`

Deployment model:

- Railway installs backend Python dependencies
- Railway installs frontend dependencies and builds `frontend/dist`
- FastAPI serves the built SPA and the API from the same service
- `backend/data/o2c.db` is committed so the deployed service has the database artifact at startup
