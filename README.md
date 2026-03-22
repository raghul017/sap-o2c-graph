# SAP O2C Graph Query System

A context graph system with an LLM-powered natural language 
query interface over a SAP Order-to-Cash dataset.

**Live Demo:** [Add Railway URL after deploy]  
**Stack:** FastAPI · SQLite · NetworkX · React · React Flow · Groq

---

## What It Does

Converts a fragmented SAP O2C dataset (19 tables, ~18,000 rows) 
into an interconnected graph of business entities, then lets 
users explore it visually and query it in plain English.
```
Customer → Sales Order → Delivery → Billing → Journal Entry → Payment
```

Graph: 880 nodes, 1,307 edges across 9 entity types
Chat: Natural language → SQL → data-backed answers via Groq
Guardrails: Off-topic and destructive queries rejected
Broken flows: 21 incomplete O2C flows detected automatically


Architecture
sap-o2c-graph/
├── backend/
│   ├── main.py      # FastAPI app, all routes
│   ├── db.py        # SQLite loader (19 tables, indexes)
│   ├── graph.py     # NetworkX graph builder
│   ├── llm.py       # Groq NL→SQL pipeline
│   ├── schema.py    # Schema definitions
│   └── data/
│       └── o2c.db   # SQLite database
└── frontend/
    └── src/
        ├── components/
        │   ├── GraphPanel.tsx   # React Flow visualization
        │   ├── ChatPanel.tsx    # Chat interface
        │   ├── Header.tsx
        │   └── ResultsTable.tsx
        └── constants.ts

Database Choice: SQLite over Neo4j
I chose SQLite over a native graph database (Neo4j, ArangoDB)
for these reasons:

Zero infrastructure — file-based, no server process,
commits to git, runs on Railway free tier without add-ons
NL→SQL reliability — LLMs generate accurate SQLite SQL
from training data. NL→Cypher is far less reliable with
current models and would require more prompt engineering
Graph layer in NetworkX — the graph structure
(nodes, edges, traversal) is built in-memory from FK
relationships at startup. This gives graph capabilities
without a graph DB
Tradeoff — not suitable for graph traversal queries
at scale (millions of nodes). For this dataset size
(~880 nodes) it is the correct choice


Graph Model
Node Types (9)
TypeCountSource TableBusinessPartner8business_partnersSalesOrder100sales_order_headersSalesOrderItem167sales_order_itemsDelivery86outbound_delivery_headersBillingDocument163billing_document_headersJournalEntry123journal_entry_arPayment120payments_arProduct69productsPlant44plants
Edge Types (9)
RelationshipFrom → ToPLACEDBusinessPartner → SalesOrderHAS_ITEMSalesOrder → SalesOrderItemREFERENCESSalesOrderItem → ProductPRODUCED_ATSalesOrderItem → PlantFULFILLED_BYSalesOrderItem → DeliveryBILLED_ASDelivery → BillingDocumentPOSTED_TOBillingDocument → JournalEntrySETTLED_BYJournalEntry → PaymentBILLED_TOBusinessPartner → BillingDocument

LLM Prompting Strategy
Approach: Schema-Injected System Prompt + Few-Shot
The system prompt contains:

Full table schema with column names and types
Status code explanations (e.g. overallDeliveryStatus: A/B/C)
Critical join paths spelled out explicitly
Structured output requirement: JSON only, no markdown
Three few-shot examples covering the required query types

Output Format
json{"sql": "SELECT ...", "explanation": "..."}
or for off-topic:
json{"off_topic": true, "message": "..."}
Why Structured JSON Output
Parsing is deterministic. The LLM either returns valid SQL
or signals off-topic — no ambiguous free-text to interpret.
Markdown code fences are stripped before parsing as a safety net.

Guardrails
Three layers of protection:

LLM-level — system prompt explicitly instructs the
model to return {off_topic: true} for non-O2C queries
SQL execution guard — only SELECT statements execute.
Any query not starting with SELECT is rejected before
reaching the database
Result limiting — all queries limited to 50 rows
by default to prevent data dumps

Tested rejections:

"Write me a poem" → off_topic
"What is the capital of France?" → off_topic
"DROP TABLE sales_order_headers" → off_topic
"Tell me a joke" → off_topic


Example Queries
1. Products with most billing documents

"Which products appear in the most billing documents?"

2. Broken flows — delivered not billed

"Show me sales orders that were delivered but never billed"

3. Full O2C flow trace

"Show me the full flow of billing document 90000001"

4. Customer analysis

"Who are the top 5 customers by total order value?"

5. Payment status

"Which billing documents have no payment yet?"


Broken Flow Detection
The system automatically identifies 21 incomplete O2C flows:
IssueCountNo delivery created14Delivered but not billed3Billed but not posted to accounting4
Available at GET /api/broken-flows

API Routes
MethodRouteDescriptionGET/api/healthHealth check + node/edge countsGET/api/graphFull graph JSONGET/api/graph/node/{id}Node + neighborsGET/api/graph/expand/{id}Expand nodeGET/api/statsGraph statisticsGET/api/flow/{sales_order}Full O2C flow traceGET/api/broken-flowsIncomplete flowsGET/api/suggested-queriesStarter questionsGET/api/llm-statusGroq config checkPOST/api/chatNL query → SQL → answer

Running Locally
bash# Backend
cd backend
source ../.venv/bin/activate  # or venv/bin/activate
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm run dev
# Open http://localhost:5173
```

Environment: copy backend/.env.example to backend/.env 
and add your GROQ_API_KEY from https://console.groq.com

---

## Data Quality Notes

Handled during ingestion (db.py):
- Nested time objects `{hours, minutes, seconds}` flattened 
  to "HH:MM:SS" strings
- Item number zero-padding inconsistency normalized to integers
  for reliable cross-table joins
- 40 billing documents have no matching journal entry 
  (16 are cancellations, 24 appear to be data gaps)
- INSERT OR IGNORE used throughout — safe to re-run db.py

---

## AI Tools Used

Built with OpenAI Codex (primary) and Claude (architecture + 
prompt design). Session logs included in /ai-logs/ directory.
