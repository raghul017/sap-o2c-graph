# Codex CLI — Prompts Log

**Tool:** OpenAI Codex CLI  
**Project:** SAP O2C Graph Query System — Forward Deployed Engineer Assignment  
**Date:** March 22–23, 2026

---

## Prompt 1 — Dataset Exploration

I am building a FastAPI backend for an SAP Order-to-Cash (O2C)
graph query system. Before writing any code, I need you to
explore and understand the dataset structure.

## Your Task

The dataset is located at: ./dataset/
It contains 18 subfolders. Each subfolder is a table name.
Each subfolder contains one or more .jsonl files (one JSON
object per line).

Please do the following:

1. List all subfolders inside ./dataset/
2. For each subfolder, read the first 2 lines of the first
   .jsonl file and print all field names (keys)
3. Identify the primary key field for each table
   (usually an ID field like salesOrder, deliveryDocument, etc.)
4. Identify foreign key relationships between tables
   (fields that appear in multiple tables linking them together)
5. Flag any nested JSON fields (objects inside objects,
   like time fields with {hours, minutes, seconds}) —
   these need to be flattened when loading into SQLite
6. Report the approximate row count per table (count lines
   in all .jsonl files per folder)

## Output Format

Give me a clean report like this for each table:

TABLE: sales_order_headers
Files: 3 .jsonl files, ~300 rows total
Fields: salesOrder, salesOrderType, soldToParty, ...
Primary Key: salesOrder
Foreign Keys: soldToParty → business_partners.businessPartner
Nested Fields: none

After the report, summarize:

- The full O2C relationship chain you discovered
- Any data quality issues (nulls, missing links, inconsistent IDs)
- Which tables have the most rows (these need efficient indexing)

Do NOT write any application code yet.
Only explore and report.

---

## Prompt 2 — db.py

Now build db.py — the SQLite data loader for the SAP O2C system.

## Dataset Location

./sap-o2c-data/ (19 subfolders, each with .jsonl files)

## Requirements

### 1. Flatten nested time fields

These tables have nested {hours, minutes, seconds} objects — flatten them to a single string "HH:MM:SS":

- billing_document_cancellations.creationTime
- billing_document_headers.creationTime
- business_partners.creationTime
- outbound_delivery_headers.actualGoodsMovementTime
- outbound_delivery_headers.creationTime

### 2. Normalize item IDs for joins

Cross-table joins on item numbers fail due to inconsistent zero-padding.
Apply this normalization before inserting:

- Convert all item number fields to integer (strip leading zeros)
- Affected fields:
    - sales_order_items.salesOrderItem
    - outbound_delivery_items.referenceSdDocumentItem → normalize to int
    - billing_document_items.referenceSdDocumentItem → normalize to int

### 3. Create all 19 SQLite tables with this exact DDL:

```sql
CREATE TABLE IF NOT EXISTS business_partners (
  businessPartner TEXT PRIMARY KEY,
  customer TEXT,
  businessPartnerCategory TEXT,
  businessPartnerFullName TEXT,
  businessPartnerName TEXT,
  industry TEXT,
  businessPartnerIsBlocked INTEGER,
  isMarkedForArchiving INTEGER,
  creationDate TEXT,
  creationTime TEXT
);

CREATE TABLE IF NOT EXISTS business_partner_addresses (
  businessPartner TEXT,
  addressId TEXT,
  cityName TEXT,
  country TEXT,
  postalCode TEXT,
  region TEXT,
  streetName TEXT,
  PRIMARY KEY (businessPartner, addressId)
);

CREATE TABLE IF NOT EXISTS customer_company_assignments (
  customer TEXT,
  companyCode TEXT,
  paymentTerms TEXT,
  reconciliationAccount TEXT,
  deletionIndicator INTEGER,
  PRIMARY KEY (customer, companyCode)
);

CREATE TABLE IF NOT EXISTS customer_sales_area_assignments (
  customer TEXT,
  salesOrganization TEXT,
  distributionChannel TEXT,
  division TEXT,
  currency TEXT,
  customerPaymentTerms TEXT,
  deliveryPriority TEXT,
  supplyingPlant TEXT,
  PRIMARY KEY (customer, salesOrganization, distributionChannel, division)
);

CREATE TABLE IF NOT EXISTS sales_order_headers (
  salesOrder TEXT PRIMARY KEY,
  salesOrderType TEXT,
  salesOrganization TEXT,
  distributionChannel TEXT,
  organizationDivision TEXT,
  soldToParty TEXT,
  totalNetAmount REAL,
  transactionCurrency TEXT,
  overallDeliveryStatus TEXT,
  overallOrdReltdBillgStatus TEXT,
  creationDate TEXT,
  requestedDeliveryDate TEXT,
  headerBillingBlockReason TEXT,
  deliveryBlockReason TEXT,
  customerPaymentTerms TEXT
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  salesOrder TEXT,
  salesOrderItem INTEGER,
  salesOrderItemCategory TEXT,
  material TEXT,
  requestedQuantity REAL,
  requestedQuantityUnit TEXT,
  netAmount REAL,
  transactionCurrency TEXT,
  materialGroup TEXT,
  productionPlant TEXT,
  storageLocation TEXT,
  itemBillingBlockReason TEXT,
  salesDocumentRjcnReason TEXT,
  PRIMARY KEY (salesOrder, salesOrderItem)
);

CREATE TABLE IF NOT EXISTS sales_order_schedule_lines (
  salesOrder TEXT,
  salesOrderItem INTEGER,
  scheduleLine TEXT,
  confirmedDeliveryDate TEXT,
  orderQuantityUnit TEXT,
  confdOrderQtyByMatlAvailCheck REAL,
  PRIMARY KEY (salesOrder, salesOrderItem, scheduleLine)
);

CREATE TABLE IF NOT EXISTS outbound_delivery_headers (
  deliveryDocument TEXT PRIMARY KEY,
  shippingPoint TEXT,
  overallGoodsMovementStatus TEXT,
  overallPickingStatus TEXT,
  overallProofOfDeliveryStatus TEXT,
  headerBillingBlockReason TEXT,
  deliveryBlockReason TEXT,
  hdrGeneralIncompletionStatus TEXT,
  creationDate TEXT,
  creationTime TEXT,
  actualGoodsMovementDate TEXT,
  actualGoodsMovementTime TEXT,
  lastChangeDate TEXT
);

CREATE TABLE IF NOT EXISTS outbound_delivery_items (
  deliveryDocument TEXT,
  deliveryDocumentItem TEXT,
  referenceSdDocument TEXT,
  referenceSdDocumentItem INTEGER,
  material TEXT,
  actualDeliveryQuantity REAL,
  deliveryQuantityUnit TEXT,
  plant TEXT,
  storageLocation TEXT,
  itemBillingBlockReason TEXT,
  batch TEXT,
  PRIMARY KEY (deliveryDocument, deliveryDocumentItem)
);

CREATE TABLE IF NOT EXISTS billing_document_headers (
  billingDocument TEXT PRIMARY KEY,
  billingDocumentType TEXT,
  soldToParty TEXT,
  accountingDocument TEXT,
  totalNetAmount REAL,
  transactionCurrency TEXT,
  billingDocumentIsCancelled INTEGER,
  cancelledBillingDocument TEXT,
  companyCode TEXT,
  fiscalYear TEXT,
  creationDate TEXT,
  creationTime TEXT,
  billingDocumentDate TEXT
);

CREATE TABLE IF NOT EXISTS billing_document_items (
  billingDocument TEXT,
  billingDocumentItem TEXT,
  material TEXT,
  billingQuantity REAL,
  billingQuantityUnit TEXT,
  netAmount REAL,
  transactionCurrency TEXT,
  referenceSdDocument TEXT,
  referenceSdDocumentItem INTEGER,
  PRIMARY KEY (billingDocument, billingDocumentItem)
);

CREATE TABLE IF NOT EXISTS billing_document_cancellations (
  billingDocument TEXT PRIMARY KEY,
  billingDocumentType TEXT,
  soldToParty TEXT,
  accountingDocument TEXT,
  totalNetAmount REAL,
  transactionCurrency TEXT,
  billingDocumentIsCancelled INTEGER,
  cancelledBillingDocument TEXT,
  companyCode TEXT,
  fiscalYear TEXT,
  creationDate TEXT,
  creationTime TEXT
);

CREATE TABLE IF NOT EXISTS journal_entry_ar (
  companyCode TEXT,
  fiscalYear TEXT,
  accountingDocument TEXT,
  accountingDocumentItem TEXT,
  glAccount TEXT,
  referenceDocument TEXT,
  customer TEXT,
  amountInTransactionCurrency REAL,
  transactionCurrency TEXT,
  amountInCompanyCodeCurrency REAL,
  companyCodeCurrency TEXT,
  postingDate TEXT,
  documentDate TEXT,
  accountingDocumentType TEXT,
  clearingDate TEXT,
  clearingAccountingDocument TEXT,
  financialAccountType TEXT,
  PRIMARY KEY (companyCode, fiscalYear, accountingDocument, accountingDocumentItem)
);

CREATE TABLE IF NOT EXISTS payments_ar (
  companyCode TEXT,
  fiscalYear TEXT,
  accountingDocument TEXT,
  accountingDocumentItem TEXT,
  customer TEXT,
  clearingDate TEXT,
  clearingAccountingDocument TEXT,
  amountInTransactionCurrency REAL,
  transactionCurrency TEXT,
  amountInCompanyCodeCurrency REAL,
  companyCodeCurrency TEXT,
  postingDate TEXT,
  documentDate TEXT,
  glAccount TEXT,
  financialAccountType TEXT,
  PRIMARY KEY (companyCode, fiscalYear, accountingDocument, accountingDocumentItem)
);

CREATE TABLE IF NOT EXISTS products (
  product TEXT PRIMARY KEY,
  productType TEXT,
  baseUnit TEXT,
  grossWeight REAL,
  netWeight REAL,
  weightUnit TEXT,
  productGroup TEXT,
  division TEXT,
  industrySector TEXT,
  isMarkedForDeletion INTEGER,
  creationDate TEXT
);

CREATE TABLE IF NOT EXISTS product_descriptions (
  product TEXT,
  language TEXT,
  productDescription TEXT,
  PRIMARY KEY (product, language)
);

CREATE TABLE IF NOT EXISTS plants (
  plant TEXT PRIMARY KEY,
  plantName TEXT,
  salesOrganization TEXT,
  distributionChannel TEXT,
  division TEXT,
  language TEXT,
  isMarkedForArchiving INTEGER
);

CREATE TABLE IF NOT EXISTS product_plants (
  product TEXT,
  plant TEXT,
  countryOfOrigin TEXT,
  profitCenter TEXT,
  mrpType TEXT,
  availabilityCheckType TEXT,
  PRIMARY KEY (product, plant)
);

CREATE TABLE IF NOT EXISTS product_storage_locations (
  product TEXT,
  plant TEXT,
  storageLocation TEXT,
  physicalInventoryBlockInd TEXT,
  PRIMARY KEY (product, plant, storageLocation)
);
```

### 4. Create these indexes after loading:

```sql
CREATE INDEX IF NOT EXISTS idx_soi_salesorder ON sales_order_items(salesOrder);
CREATE INDEX IF NOT EXISTS idx_odi_refsddoc ON outbound_delivery_items(referenceSdDocument);
CREATE INDEX IF NOT EXISTS idx_bdi_refsddoc ON billing_document_items(referenceSdDocument);
CREATE INDEX IF NOT EXISTS idx_bdh_accountingdoc ON billing_document_headers(accountingDocument);
CREATE INDEX IF NOT EXISTS idx_je_refdoc ON journal_entry_ar(referenceDocument);
CREATE INDEX IF NOT EXISTS idx_pay_accountingdoc ON payments_ar(accountingDocument);
CREATE INDEX IF NOT EXISTS idx_pp_product ON product_plants(product);
CREATE INDEX IF NOT EXISTS idx_psl_product ON product_storage_locations(product);
```

### 5. Loader function spec

Write a function `load_all_data(db_path, dataset_path)` that:

- Iterates all 19 folders in dataset_path
- Maps folder name → table name (e.g. journal_entry_items_accounts_receivable → journal_entry_ar, payments_accounts_receivable → payments_ar)
- Reads all .jsonl files per folder
- Flattens nested time fields using a helper flatten_record(record, table_name)
- Normalizes item number fields to int using safe_int(val)
- Inserts with INSERT OR IGNORE (idempotent — safe to run multiple times)
- Prints row count per table after loading
- Skips unknown columns silently (only inserts columns defined in schema)

### 6. Add a verify_data() function that prints:

- Row count per table
- Sample JOIN check: how many outbound_delivery_items rows successfully join to sales_order_items after normalization
- How many billing_document_headers have a matching journal_entry_ar row

### 7. Entry point

If run directly (if **name** == "**main**"), call load_all_data() then verify_data().

Database file location: ./data/o2c.db (create ./data/ if not exists)

---

## Prompt 3 — graph.py

Now build graph.py — the NetworkX graph layer for the SAP O2C system.
The SQLite database is at ./data/o2c.db (already built and verified).

## What This File Must Do

Build an in-memory NetworkX DiGraph from the SQLite data at startup,
then expose functions that the FastAPI app will call.

## Node Types and Their Source Tables

Build nodes for these 9 types:

1. BusinessPartner → business_partners
   id: businessPartner
   label: businessPartnerFullName or businessPartnerName
   meta: customer, industry, businessPartnerIsBlocked

2. SalesOrder → sales_order_headers
   id: salesOrder
   label: "SO-{salesOrder}"
   meta: totalNetAmount, transactionCurrency, overallDeliveryStatus, overallOrdReltdBillgStatus, creationDate, soldToParty

3. SalesOrderItem → sales_order_items
   id: "{salesOrder}-{salesOrderItem}"
   label: "Item {salesOrderItem}"
   meta: material, requestedQuantity, netAmount, productionPlant

4. Delivery → outbound_delivery_headers
   id: deliveryDocument
   label: "DEL-{deliveryDocument}"
   meta: overallGoodsMovementStatus, overallPickingStatus, creationDate, shippingPoint

5. BillingDocument → billing_document_headers
   id: billingDocument
   label: "BILL-{billingDocument}"
   meta: totalNetAmount, transactionCurrency, billingDocumentIsCancelled, accountingDocument, soldToParty, creationDate

6. JournalEntry → journal_entry_ar
   id: "{companyCode}-{fiscalYear}-{accountingDocument}"
   label: "JE-{accountingDocument}"
   meta: amountInTransactionCurrency, transactionCurrency, postingDate, referenceDocument

7. Payment → payments_ar
   id: "{companyCode}-{fiscalYear}-{accountingDocument}-{accountingDocumentItem}"
   label: "PAY-{accountingDocument}"
   meta: amountInTransactionCurrency, transactionCurrency, clearingDate, customer

8. Product → products joined with product_descriptions (language='EN')
   id: product
   label: productDescription (from product_descriptions) or product
   meta: productType, baseUnit, grossWeight, productGroup

9. Plant → plants
   id: plant
   label: plantName or plant
   meta: salesOrganization, distributionChannel

## Edges (Relationships)

Build these directed edges:

1. BusinessPartner -[PLACED]→ SalesOrder
   JOIN: business_partners.businessPartner = sales_order_headers.soldToParty

2. SalesOrder -[HAS_ITEM]→ SalesOrderItem
   JOIN: sales_order_headers.salesOrder = sales_order_items.salesOrder

3. SalesOrderItem -[REFERENCES]→ Product
   JOIN: sales_order_items.material = products.product

4. SalesOrderItem -[PRODUCED_AT]→ Plant
   JOIN: sales_order_items.productionPlant = plants.plant

5. SalesOrderItem -[FULFILLED_BY]→ Delivery
   JOIN: outbound_delivery_items.referenceSdDocument = sales_order_items.salesOrder
   AND outbound_delivery_items.referenceSdDocumentItem = sales_order_items.salesOrderItem
   Edge goes: SalesOrderItem → Delivery

6. Delivery -[BILLED_AS]→ BillingDocument
   JOIN: billing_document_items.referenceSdDocument = outbound_delivery_headers.deliveryDocument

7. BillingDocument -[POSTED_TO]→ JournalEntry
   JOIN: billing_document_headers.accountingDocument = journal_entry_ar.accountingDocument
   Note: only 123/163 billing docs have a match — skip non-matching silently

8. JournalEntry -[SETTLED_BY]→ Payment
   JOIN: journal_entry_ar.accountingDocument = payments_ar.accountingDocument

9. BusinessPartner -[BILLED_TO]→ BillingDocument
   JOIN: business_partners.businessPartner = billing_document_headers.soldToParty

## Functions to Implement

### build_graph(db_path) → nx.DiGraph

- Connects to SQLite
- Adds all nodes with attributes: type, label, and all meta fields
- Adds all edges with attribute: relation (the edge label string)
- Returns the graph
- Print summary: total nodes, total edges, breakdown by node type

### get_full_graph_json(G) → dict

Returns:
{
"nodes": [{"id": "...", "type": "SalesOrder", "label": "SO-740506", "data": {...}}],
"edges": [{"source": "...", "target": "...", "relation": "HAS_ITEM"}]
}

### get_node_neighbors(G, node_id) → dict

Returns the node itself plus all its direct neighbors (both in and out edges):
{
"node": { id, type, label, data },
"neighbors": [{ "node": {...}, "relation": "HAS_ITEM", "direction": "out" }]
}

### get_o2c_flow(G, db_path, sales_order_id) → dict

Traces the complete O2C flow for a given sales order with full nesting.

### get_broken_flows(G, db_path) → list

Returns sales orders with incomplete O2C flows.
Check: delivered_not_billed, billed_not_posted, no_delivery, paid_not_cleared

### get_graph_stats(G) → dict

Returns total_nodes, total_edges, by_type breakdown, top_customers, top_products.

## Module Entry Point

If run directly:

1. Call build_graph('./data/o2c.db')
2. Print get_graph_stats()
3. Print get_node_neighbors() for first SalesOrder node
4. Print get_broken_flows() count by issue type

## Important Notes

- Store graph in module-level variable with get_graph() singleton pattern
- Use sqlite3 directly, not SQLAlchemy
- All node IDs must be strings
- Handle None/null values gracefully
- Do NOT add product_storage_locations (16,723 rows) as nodes
- Do NOT add product_plants (3,036 rows) as nodes
- Only add the 69 Product nodes and 44 Plant nodes

---

## Prompt 4 — llm.py + main.py

Now build llm.py and main.py — the Groq NL→SQL pipeline and
FastAPI app for the SAP O2C graph query system.

## llm.py

### Groq Setup

- Model: llama-3.3-70b-versatile
- API key from env: GROQ_API_KEY
- Use the groq Python SDK: from groq import Groq
- max_tokens: 1024
- temperature: 0

### System Prompt (inject this exactly)

You are a data analyst for an SAP Order-to-Cash (O2C) system.
You have access to a SQLite database with the following schema:

TABLE: sales_order_headers
salesOrder (PK), salesOrderType, salesOrganization, soldToParty,
totalNetAmount, transactionCurrency, overallDeliveryStatus,
overallOrdReltdBillgStatus, creationDate, requestedDeliveryDate,
headerBillingBlockReason, deliveryBlockReason, customerPaymentTerms
STATUS CODES: overallDeliveryStatus: A=Not Delivered, B=Partial, C=Fully Delivered
STATUS CODES: overallOrdReltdBillgStatus: A=Not Billed, B=Partial, C=Fully Billed

TABLE: sales_order_items
salesOrder (FK→sales_order_headers), salesOrderItem (int),
material (FK→products), requestedQuantity, netAmount,
transactionCurrency, productionPlant (FK→plants)
NOTE: salesOrderItem is stored as integer (no leading zeros)

TABLE: sales_order_schedule_lines
salesOrder, salesOrderItem (int), scheduleLine,
confirmedDeliveryDate, confdOrderQtyByMatlAvailCheck

TABLE: outbound_delivery_headers
deliveryDocument (PK), shippingPoint, overallGoodsMovementStatus,
overallPickingStatus, creationDate, actualGoodsMovementDate
STATUS CODES: overallGoodsMovementStatus: A=Not Started, B=Partial, C=Complete

TABLE: outbound_delivery_items
deliveryDocument (FK→outbound_delivery_headers), deliveryDocumentItem,
referenceSdDocument (FK→sales_order_headers.salesOrder),
referenceSdDocumentItem (int, FK→sales_order_items.salesOrderItem),
material, actualDeliveryQuantity, plant (FK→plants)
NOTE: referenceSdDocumentItem is stored as integer for joining

TABLE: billing_document_headers
billingDocument (PK), billingDocumentType, soldToParty,
accountingDocument (FK→journal_entry_ar), totalNetAmount,
transactionCurrency, billingDocumentIsCancelled (0/1),
companyCode, fiscalYear, creationDate

TABLE: billing_document_items
billingDocument (FK→billing_document_headers), billingDocumentItem,
material (FK→products), billingQuantity, netAmount,
referenceSdDocument (FK→outbound_delivery_headers.deliveryDocument),
referenceSdDocumentItem (int)

TABLE: billing_document_cancellations
billingDocument (PK), soldToParty, accountingDocument,
totalNetAmount, billingDocumentIsCancelled, cancelledBillingDocument

TABLE: journal_entry_ar
companyCode, fiscalYear, accountingDocument, accountingDocumentItem (PK together),
referenceDocument (FK→billing_document_headers.billingDocument),
customer, amountInTransactionCurrency, transactionCurrency, postingDate

TABLE: payments_ar
companyCode, fiscalYear, accountingDocument, accountingDocumentItem (PK together),
customer, clearingDate, amountInTransactionCurrency,
transactionCurrency, postingDate

TABLE: business_partners
businessPartner (PK), customer, businessPartnerFullName,
businessPartnerName, industry, businessPartnerIsBlocked

TABLE: products
product (PK), productType, baseUnit, grossWeight, productGroup

TABLE: product_descriptions
product (FK→products), language, productDescription
NOTE: Use language='EN' for English descriptions

TABLE: plants
plant (PK), plantName, salesOrganization

TABLE: product_plants
product, plant (PK together), countryOfOrigin, profitCenter

KEY JOIN PATHS:

- Sales Order → Delivery:
  sales_order_items.salesOrder + salesOrderItem
  = outbound_delivery_items.referenceSdDocument + referenceSdDocumentItem
- Delivery → Billing:
  outbound_delivery_headers.deliveryDocument
  = billing_document_items.referenceSdDocument
- Billing → Journal:
  billing_document_headers.accountingDocument
  = journal_entry_ar.accountingDocument
- Journal → Payment:
  journal_entry_ar.accountingDocument
  = payments_ar.accountingDocument

RULES:

1. Return ONLY a JSON object. No markdown, no explanation outside JSON.
2. For answerable queries return:
   {"sql": "SELECT ...", "explanation": "...one sentence..."}
3. For off-topic queries return:
   {"off_topic": true, "message": "This system only answers questions
   about the SAP O2C dataset (orders, deliveries, billing, payments,
   products, customers)."}
4. ONLY generate SELECT statements. Never DROP, DELETE, UPDATE, INSERT, ALTER.
5. Always LIMIT results to 50 rows unless user asks for all.
6. Use proper JOINs. Never assume data exists without joining.
7. For product names always JOIN product_descriptions with language='EN'.
8. Item number joins: salesOrderItem and referenceSdDocumentItem are integers.

FEW-SHOT EXAMPLES:

Q: Which products are associated with the highest number of billing documents?
A: {"sql": "SELECT p.product, pd.productDescription, COUNT(DISTINCT bi.billingDocument) as billing_count FROM billing_document_items bi JOIN products p ON bi.material = p.product LEFT JOIN product_descriptions pd ON p.product = pd.product AND pd.language = 'EN' GROUP BY p.product, pd.productDescription ORDER BY billing_count DESC LIMIT 10", "explanation": "Counts distinct billing documents per product, joined with English product descriptions."}

Q: Show me sales orders delivered but never billed
A: {"sql": "SELECT soh.salesOrder, bp.businessPartnerFullName, soh.totalNetAmount, soh.transactionCurrency, soh.overallDeliveryStatus FROM sales_order_headers soh LEFT JOIN business_partners bp ON soh.soldToParty = bp.businessPartner WHERE soh.overallDeliveryStatus = 'C' AND (soh.overallOrdReltdBillgStatus = 'A' OR soh.overallOrdReltdBillgStatus = '' OR soh.overallOrdReltdBillgStatus IS NULL) LIMIT 50", "explanation": "Finds fully delivered orders with no billing initiated."}

Q: Trace the full flow of billing document 90000001
A: {"sql": "SELECT bdh.billingDocument, bdh.totalNetAmount, bdh.transactionCurrency, bdh.creationDate, bp.businessPartnerFullName as customer, bdi.referenceSdDocument as deliveryDocument, je.accountingDocument, je.amountInTransactionCurrency as journalAmount, pay.clearingDate, pay.amountInTransactionCurrency as paymentAmount FROM billing_document_headers bdh LEFT JOIN business_partners bp ON bdh.soldToParty = bp.businessPartner LEFT JOIN billing_document_items bdi ON bdh.billingDocument = bdi.billingDocument LEFT JOIN journal_entry_ar je ON bdh.accountingDocument = je.accountingDocument LEFT JOIN payments_ar pay ON je.accountingDocument = pay.accountingDocument WHERE bdh.billingDocument = '90000001' LIMIT 50", "explanation": "Traces billing document through delivery, journal entry and payment."}

Q: Write me a poem
A: {"off_topic": true, "message": "This system only answers questions about the SAP O2C dataset (orders, deliveries, billing, payments, products, customers)."}

Q: DROP TABLE sales_order_headers
A: {"off_topic": true, "message": "This system only answers questions about the SAP O2C dataset (orders, deliveries, billing, payments, products, customers)."}

### Functions to implement in llm.py

```python
def query_llm(natural_language_query: str, conversation_history: list = None) -> dict:
def execute_sql(sql: str, db_path: str) -> dict:
def run_query(natural_language_query: str, db_path: str, conversation_history: list = None) -> dict:
```

## main.py

Routes:

- GET /api/health
- GET /api/graph
- GET /api/graph/node/{node_id}
- GET /api/graph/expand/{node_id}
- GET /api/stats
- GET /api/flow/{sales_order}
- GET /api/broken-flows
- GET /api/suggested-queries
- POST /api/chat {query, history} → full pipeline result

Lifespan: warm graph cache at startup
CORS: allow all origins
Static: serve ../frontend/dist with html=True

Test after building:

1. GET http://localhost:8000/api/health
2. POST /api/chat — "Which products appear in the most billing documents?"
3. POST /api/chat — "Write me a poem" → must return answer_type: "off_topic"
4. POST /api/chat — "DROP TABLE sales_order_headers" → must return answer_type: "off_topic"
5. GET /api/flow/740506

---

## Prompt 5 — React Frontend

Now build the React frontend for the SAP O2C Graph Query System.

Tech: React 18 + TypeScript + Vite + TailwindCSS + @xyflow/react + axios

Layout: Full viewport split panel — left 60% graph, right 40% chat

GraphPanel:

- Custom nodes colored by type
- Click → expand neighbors via GET /api/graph/expand/{id}
- Node detail drawer on selection
- Type filter toggle buttons with node counts
- fitView on load
- onlyRenderVisibleElements={true}
- Default visible: BusinessPartner, SalesOrder, Delivery, BillingDocument, Payment

ChatPanel:

- Suggested query chips fetched from /api/suggested-queries
- User/assistant message styling
- SQL collapsible block
- Results table
- Off-topic: amber warning card
- Error: red card
- Conversation history (last 6 messages sent to API)

Build output: vite build → frontend/dist

---

## Prompt 6 — Fix Graph Layout

The graph in GraphPanel.tsx is rendering all nodes as dense
vertical columns. Fix the layout so it reads left→right
following the O2C flow.

Replace the current layout logic with:

```typescript
const TYPE_X: Record<string, number> = {
    BusinessPartner: 0,
    SalesOrder: 220,
    SalesOrderItem: 440,
    Delivery: 660,
    BillingDocument: 880,
    JournalEntry: 1100,
    Payment: 1320,
    Product: 440,
    Plant: 660,
};

const TYPE_Y_OFFSET: Record<string, number> = {
    BusinessPartner: 0,
    SalesOrder: 0,
    SalesOrderItem: 0,
    Delivery: 0,
    BillingDocument: 0,
    JournalEntry: 0,
    Payment: 0,
    Product: 600,
    Plant: 600,
};

function computeLayout(
    nodes: GraphNode[],
): Record<string, { x: number; y: number }> {
    const positions: Record<string, { x: number; y: number }> = {};
    const typeCounters: Record<string, number> = {};
    const Y_GAP = 70;
    for (const node of nodes) {
        const t = node.type;
        if (typeCounters[t] === undefined) typeCounters[t] = 0;
        const idx = typeCounters[t]++;
        positions[node.id] = {
            x: TYPE_X[t] ?? 0,
            y: (TYPE_Y_OFFSET[t] ?? 0) + idx * Y_GAP,
        };
    }
    return positions;
}
```

Store layout in useRef, apply in useMemo for rfNodes.
Remove MiniMap entirely.
fitView with padding 0.15 after 150ms timeout.

---

## Prompt 7 — Fix Graph Spacing + Minimap

Two quick fixes in frontend/src/components/GraphPanel.tsx:

1. Change Y_GAP from 70 to 90
2. Change TYPE_Y_OFFSET for Product and Plant from 600 to 900
3. Remove MiniMap entirely
4. fitView timeout: setTimeout(() => fitView({ padding: 0.15 }), 150)

---

## Prompt 8 — Groq Fix + Performance + UI Polish

Fix 1 — Groq (backend/llm.py):

- Move load_dotenv() to very top of file
- Add parse_llm_response() to strip markdown ```json fences
- Pin httpx==0.27.2 in requirements.txt
- Add GET /api/llm-status route

Fix 2 — Performance (GraphPanel.tsx):

- Default visibleTypes: BusinessPartner, SalesOrder, Delivery, BillingDocument, Payment
- Add onlyRenderVisibleElements={true} to ReactFlow
- Add type counts to filter buttons

Fix 3 — Professional dark theme:

- Background: #0F1117, Cards: #161B27, Borders: #1E2D3D
- SQL block: monospace, #79C0FF on #0D1117
- Off-topic card: #1C1508 bg, #92400E border
- Chips: subtle #1E2433 bg, hover blue border only
- No bright colors anywhere

---

## Prompt 9 — Fix Project Structure

Move files to this exact layout:

sap-o2c-graph/
├── backend/ (main.py, db.py, graph.py, llm.py, schema.py, requirements.txt, .env, data/)
├── frontend/ (src/, package.json, vite.config.ts, tailwind.config.js, .env, .env.production)
├── sap-o2c-data/ (gitignored)
├── .gitignore
└── README.md

Update all relative paths after moving.

---

## Prompt 10 — Railway Deployment + README + Git

Part 1: Create Dockerfile in project root:

- python:3.11-slim base
- Install Node 20 via nodesource
- pip install backend/requirements.txt
- npm install + npm run build frontend
- WORKDIR /app/backend
- entrypoint.sh with exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}

Part 2: Fix static serving in backend/main.py:

- Use Path(**file**).resolve() for reliable paths
- Mount /assets first, then mount / with StaticFiles(html=True)
- Add /api/debug-paths route for deployment debugging

Part 3: railway.toml (deploy only, no startCommand):

```toml
[deploy]
healthcheckPath = "/api/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
```

Part 4: .gitignore — exclude sap-o2c-data/, .venv/, frontend/dist/
Keep backend/data/o2c.db committed.

Part 5: git add -f backend/data/o2c.db && git commit && git push

Part 6: Write complete README.md with architecture decisions,
graph model tables, LLM prompting strategy, guardrails explanation,
data quality notes, API reference, example queries.

---

## Prompt 11 — Fix Nodes Visible + Resizable Panel

Fix 1 — Nodes not visible on load:

- Increase fitView timeout to 300ms
- Add fitView={false} and defaultViewport={{ x:0, y:0, zoom:0.5 }} to ReactFlow
- Ensure computeLayout runs inside useMemo not useEffect

Fix 2 — Resizable chat panel:

- npm install react-resizable-panels
- Replace fixed layout with PanelGroup/Panel/PanelResizeHandle
- defaultSize 60/40, minSize 30/20, maxSize 80/70
- Resize handle: 4px wide, #1E2D3D bg, cursor col-resize, blue on hover

---

## Prompt 12 — Complete UI Overhaul to Match Reference Design

Rewrite entire frontend to match the reference UI from the assignment.

Reference UI:

- Light/white background (#F8F9FA)
- Small circular nodes (~10px) not card-based
- Blue circles for master data, coral/red for transaction nodes
- Thin light-blue connecting lines
- Force-directed layout using d3-force
- Floating metadata popup on node click
- Clean minimal controls: "Minimize" and "Hide Granular Overlay"

Chat panel:

- White background
- "Chat with Graph" header, "Order to Cash" subtitle
- Graph Agent avatar (dark circle with G)
- User messages: dark bubble right-aligned
- Agent messages: left-aligned with avatar
- "Analyze anything" input placeholder
- Inline results table (no SQL blocks, no colored cards)
- Status: "Graph Agent is awaiting instructions"

Install: npm install d3-force && npm install -D @types/d3-force

Node colors:

- Blue (#93C5FD border #3B82F6): BusinessPartner, SalesOrder, Product, Plant
- Coral (#FCA5A5 border #EF4444): SalesOrderItem, Delivery, BillingDocument, JournalEntry, Payment

Force layout:

- forceLink distance=60, strength=0.3
- forceManyBody strength=-80
- forceCollide radius=12
- sim.tick(250) synchronously

Remove ALL dark colors, remove react-resizable-panels,
remove colored assistant cards, remove SQL collapsible blocks.

---

## Prompt 13 — Performance + Chat Fixes

Fix 1 — Graph laggy:

- Run force simulation only ONCE using layoutDoneRef
- Reduce ticks from 500 to 200
- Add proOptions={{ hideAttribution: true }}
- Memoize rfNodes and rfEdges with tight useMemo dependencies
- React.memo on CircularNode component

Fix 2 — Chat panel not resizable:

- npm install react-resizable-panels
- PanelGroup with Graph defaultSize=75, Chat defaultSize=32
- Manual drag handle fallback

Fix 3 — "+N more results" not clickable:

- expandedMessages state (Set<string>)
- Toggle expand/collapse per message
- "↑ Show less" when expanded

---

## Prompt 14 — Fix Chat Panel Width + Node Spread

Fix 1 — Chat panel crushed to near zero:
Replace react-resizable-panels with manual drag resize:

```typescript
const [chatWidth, setChatWidth] = useState(380);
const isDragging = useRef(false);
// mousemove handler clamps width 280-700px
```

Fix 2 — Nodes too clustered:

- Canvas: W=1200, H=900
- Initial spread: 600px radius from center
- forceLink distance=60, strength=0.3
- forceManyBody strength=-80
- forceCollide radius=12
- fitView padding=0.05 after 400ms

---

## Prompt 15 — Final Polish + README Update

Fix 1 — Chat subtitle hardcoded to "Order to Cash":

```tsx
<div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
    Order to Cash
</div>
```

Fix 2 — Update README.md:

- Add live URL: https://web-production-0075e.up.railway.app
- Add Architecture Decision: React Flow + d3-force layout
- Update node colors description (blue = master, coral = transaction)
- Verify local run commands
- Add Screenshot section placeholder

git add README.md
git commit -m "docs: update README with live URL and final UI"
git push
