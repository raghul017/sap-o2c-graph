from dotenv import load_dotenv

load_dotenv()

import json
import logging
import os
import re
import sqlite3
from pathlib import Path

logger = logging.getLogger(__name__)

DB_PATH = Path("./data/o2c.db")
MODEL = "llama-3.3-70b-versatile"
MAX_TOKENS = 1024
TEMPERATURE = 0

SYSTEM_PROMPT = """You are a data analyst for an SAP Order-to-Cash (O2C) system.
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

Sales Order → Delivery:
sales_order_items.salesOrder + salesOrderItem
= outbound_delivery_items.referenceSdDocument + referenceSdDocumentItem
Delivery → Billing:
outbound_delivery_headers.deliveryDocument
= billing_document_items.referenceSdDocument
Billing → Journal:
billing_document_headers.accountingDocument
= journal_entry_ar.accountingDocument
Journal → Payment:
journal_entry_ar.accountingDocument
= payments_ar.accountingDocument

RULES:

Return ONLY a JSON object. No markdown, no explanation outside JSON.
For answerable queries return:
{"sql": "SELECT ...", "explanation": "...one sentence..."}
For off-topic queries return:
{"off_topic": true, "message": "This system only answers questions
about the SAP O2C dataset (orders, deliveries, billing, payments,
products, customers)."}
ONLY generate SELECT statements. Never DROP, DELETE, UPDATE, INSERT, ALTER.
Always LIMIT results to 50 rows unless user asks for all.
Use proper JOINs. Never assume data exists without joining.
For product names always JOIN product_descriptions with language='EN'.
Item number joins: salesOrderItem and referenceSdDocumentItem are integers.

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
A: {"off_topic": true, "message": "This system only answers questions about the SAP O2C dataset (orders, deliveries, billing, payments, products, customers)."}"""

OFF_TOPIC_MESSAGE = (
    "This system only answers questions about the SAP O2C dataset "
    "(orders, deliveries, billing, payments, products, customers)."
)


def _trim_history(conversation_history):
    if not conversation_history:
        return []
    cleaned = []
    for item in conversation_history[-6:]:
        role = item.get("role")
        content = item.get("content")
        if role in {"user", "assistant", "system"} and isinstance(content, str):
            cleaned.append({"role": role, "content": content})
    return cleaned


def _extract_json_block(text):
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(text[start : end + 1])


def parse_llm_response(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return _extract_json_block(text)


def _offline_query_router(natural_language_query):
    query = natural_language_query.strip().lower()
    destructive_terms = ["drop ", "delete ", "update ", "insert ", "alter ", "truncate "]
    off_topic_terms = ["poem", "joke", "story", "essay", "translate", "weather", "recipe"]

    if any(term in query for term in destructive_terms) or any(term in query for term in off_topic_terms):
        return {"off_topic": True, "message": OFF_TOPIC_MESSAGE}

    if "products" in query and "billing document" in query and ("most" in query or "highest" in query):
        return {
            "sql": (
                "SELECT p.product, pd.productDescription, "
                "COUNT(DISTINCT bi.billingDocument) AS billing_count "
                "FROM billing_document_items bi "
                "JOIN products p ON bi.material = p.product "
                "LEFT JOIN product_descriptions pd "
                "ON p.product = pd.product AND pd.language = 'EN' "
                "GROUP BY p.product, pd.productDescription "
                "ORDER BY billing_count DESC LIMIT 10"
            ),
            "explanation": "Counts distinct billing documents per product, joined with English product descriptions.",
        }

    if "delivered" in query and "never billed" in query:
        return {
            "sql": (
                "SELECT soh.salesOrder, bp.businessPartnerFullName, soh.totalNetAmount, "
                "soh.transactionCurrency, soh.overallDeliveryStatus "
                "FROM sales_order_headers soh "
                "LEFT JOIN business_partners bp ON soh.soldToParty = bp.businessPartner "
                "WHERE soh.overallDeliveryStatus = 'C' "
                "AND (soh.overallOrdReltdBillgStatus = 'A' "
                "OR soh.overallOrdReltdBillgStatus = '' "
                "OR soh.overallOrdReltdBillgStatus IS NULL) "
                "LIMIT 50"
            ),
            "explanation": "Finds fully delivered orders with no billing initiated.",
        }

    return {
        "error": (
            "Groq SDK or GROQ_API_KEY is unavailable, and no local fallback rule matched "
            "this query."
        )
    }


def query_llm(natural_language_query: str, conversation_history: list = None) -> dict:
    """
    Send NL query to Groq, get SQL back.
    conversation_history: list of {role, content} dicts for memory
    Returns:
      {"sql": "...", "explanation": "..."}
      OR {"off_topic": True, "message": "..."}
      OR {"error": "..."}
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(_trim_history(conversation_history))
    messages.append({"role": "user", "content": natural_language_query})

    api_key = os.getenv("GROQ_API_KEY")
    try:
        from groq import Groq
    except ImportError:
        return _offline_query_router(natural_language_query)

    if not api_key:
        return _offline_query_router(natural_language_query)

    try:
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
        )
        content = response.choices[0].message.content or ""
        payload = parse_llm_response(content)
        if isinstance(payload, dict):
            return payload
        return {"error": "Groq response was not a JSON object."}
    except Exception as e:  # pragma: no cover
        logger.error(f"Groq API error: {type(e).__name__}: {e}")
        return {"error": str(e)}


def execute_sql(sql: str, db_path: str) -> dict:
    """
    Execute a SELECT query on SQLite.
    Returns:
      {"columns": [...], "rows": [...], "count": N}
    Security: reject any query not starting with SELECT (case-insensitive strip)
    """
    if not isinstance(sql, str) or not sql.strip():
        return {"error": "SQL query is empty."}

    stripped = sql.strip().lstrip("(").strip()
    if not stripped.lower().startswith("select"):
        return {"error": "Only SELECT queries are allowed."}

    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.execute(sql)
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = [list(row) for row in cursor.fetchall()]
            return {"columns": columns, "rows": rows, "count": len(rows)}
    except Exception as exc:
        return {"error": f"SQL execution failed: {exc}"}


def run_query(natural_language_query: str, db_path: str, conversation_history: list = None) -> dict:
    """
    Full pipeline: NL → SQL → execute → return
    Returns:
    {
      "answer_type": "data" | "off_topic" | "error",
      "sql": "...",
      "explanation": "...",
      "columns": [...],
      "rows": [...],
      "count": N,
      "message": "..."   # for off_topic or error
    }
    """
    llm_result = query_llm(natural_language_query, conversation_history=conversation_history)

    if llm_result.get("off_topic"):
        return {
            "answer_type": "off_topic",
            "sql": None,
            "explanation": None,
            "columns": [],
            "rows": [],
            "count": 0,
            "message": llm_result.get("message", OFF_TOPIC_MESSAGE),
        }

    if "error" in llm_result:
        return {
            "answer_type": "error",
            "sql": None,
            "explanation": None,
            "columns": [],
            "rows": [],
            "count": 0,
            "message": llm_result["error"],
        }

    sql = llm_result.get("sql")
    explanation = llm_result.get("explanation")
    sql_result = execute_sql(sql, db_path)
    if "error" in sql_result:
        return {
            "answer_type": "error",
            "sql": sql,
            "explanation": explanation,
            "columns": [],
            "rows": [],
            "count": 0,
            "message": sql_result["error"],
        }

    return {
        "answer_type": "data",
        "sql": sql,
        "explanation": explanation,
        "columns": sql_result["columns"],
        "rows": sql_result["rows"],
        "count": sql_result["count"],
        "message": None,
    }
