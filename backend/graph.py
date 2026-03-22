import json
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path

try:
    import networkx as nx
except ImportError:  # pragma: no cover
    class _FallbackDiGraph:
        def __init__(self):
            self._nodes = {}
            self._succ = defaultdict(dict)
            self._pred = defaultdict(dict)

        def add_node(self, node_id, **attrs):
            current = self._nodes.get(node_id, {})
            current.update(attrs)
            self._nodes[node_id] = current

        def add_edge(self, source, target, **attrs):
            self.add_node(source)
            self.add_node(target)
            self._succ[source][target] = dict(attrs)
            self._pred[target][source] = dict(attrs)

        def has_node(self, node_id):
            return node_id in self._nodes

        def number_of_nodes(self):
            return len(self._nodes)

        def number_of_edges(self):
            return sum(len(targets) for targets in self._succ.values())

        def nodes(self, data=False):
            if data:
                return list(self._nodes.items())
            return list(self._nodes.keys())

        def successors(self, node_id):
            return list(self._succ.get(node_id, {}).keys())

        def predecessors(self, node_id):
            return list(self._pred.get(node_id, {}).keys())

        def get_edge_data(self, source, target, default=None):
            return self._succ.get(source, {}).get(target, default)

    class _FallbackNX:
        DiGraph = _FallbackDiGraph

    nx = _FallbackNX()


DB_PATH = Path("./data/o2c.db")
G = None


def get_graph():
    global G
    if G is None:
        G = build_graph(DB_PATH)
    return G


def safe_str(value):
    if value is None:
        return None
    return str(value)


def node_payload(node_id, node_type, label, meta):
    clean_meta = {key: value for key, value in meta.items()}
    return {
        "id": str(node_id),
        "type": node_type,
        "label": label,
        "data": clean_meta,
    }


def serialize_node(G, node_id):
    if not G.has_node(node_id):
        return None
    attrs = dict(G.nodes(data=True))[node_id] if not hasattr(G, "_nodes") else G._nodes[node_id]
    return node_payload(node_id, attrs.get("type"), attrs.get("label"), attrs.get("data", {}))


def node_attrs(G, node_id):
    if hasattr(G, "_nodes"):
        return G._nodes.get(node_id, {})
    return dict(G.nodes(data=True)).get(node_id, {})


def add_typed_node(G, node_id, node_type, label, meta):
    G.add_node(str(node_id), type=node_type, label=label, data=meta)


def add_relation(G, source, target, relation):
    if source is None or target is None:
        return
    source = str(source)
    target = str(target)
    if G.has_node(source) and G.has_node(target):
        G.add_edge(source, target, relation=relation)


def fetch_all(conn, query, params=()):
    conn.row_factory = sqlite3.Row
    cursor = conn.execute(query, params)
    return cursor.fetchall()


def build_graph(db_path):
    graph = nx.DiGraph()
    db_file = Path(db_path)

    with sqlite3.connect(db_file) as conn:
        conn.row_factory = sqlite3.Row

        for row in conn.execute(
            """
            SELECT businessPartner, businessPartnerFullName, businessPartnerName,
                   customer, industry, businessPartnerIsBlocked
            FROM business_partners
            """
        ):
            node_id = safe_str(row["businessPartner"])
            label = row["businessPartnerFullName"] or row["businessPartnerName"] or node_id
            meta = {
                "customer": row["customer"],
                "industry": row["industry"],
                "businessPartnerIsBlocked": row["businessPartnerIsBlocked"],
            }
            add_typed_node(graph, node_id, "BusinessPartner", label, meta)

        for row in conn.execute(
            """
            SELECT salesOrder, totalNetAmount, transactionCurrency,
                   overallDeliveryStatus, overallOrdReltdBillgStatus,
                   creationDate, soldToParty
            FROM sales_order_headers
            """
        ):
            node_id = safe_str(row["salesOrder"])
            meta = {
                "totalNetAmount": row["totalNetAmount"],
                "transactionCurrency": row["transactionCurrency"],
                "overallDeliveryStatus": row["overallDeliveryStatus"],
                "overallOrdReltdBillgStatus": row["overallOrdReltdBillgStatus"],
                "creationDate": row["creationDate"],
                "soldToParty": row["soldToParty"],
            }
            add_typed_node(graph, node_id, "SalesOrder", f"SO-{node_id}", meta)

        for row in conn.execute(
            """
            SELECT salesOrder, salesOrderItem, material, requestedQuantity,
                   netAmount, productionPlant
            FROM sales_order_items
            """
        ):
            item_id = f"{row['salesOrder']}-{row['salesOrderItem']}"
            meta = {
                "material": row["material"],
                "requestedQuantity": row["requestedQuantity"],
                "netAmount": row["netAmount"],
                "productionPlant": row["productionPlant"],
            }
            add_typed_node(
                graph,
                item_id,
                "SalesOrderItem",
                f"Item {row['salesOrderItem']}",
                meta,
            )

        for row in conn.execute(
            """
            SELECT deliveryDocument, overallGoodsMovementStatus,
                   overallPickingStatus, creationDate, shippingPoint
            FROM outbound_delivery_headers
            """
        ):
            node_id = safe_str(row["deliveryDocument"])
            meta = {
                "overallGoodsMovementStatus": row["overallGoodsMovementStatus"],
                "overallPickingStatus": row["overallPickingStatus"],
                "creationDate": row["creationDate"],
                "shippingPoint": row["shippingPoint"],
            }
            add_typed_node(graph, node_id, "Delivery", f"DEL-{node_id}", meta)

        for row in conn.execute(
            """
            SELECT billingDocument, totalNetAmount, transactionCurrency,
                   billingDocumentIsCancelled, accountingDocument,
                   soldToParty, creationDate
            FROM billing_document_headers
            """
        ):
            node_id = safe_str(row["billingDocument"])
            meta = {
                "totalNetAmount": row["totalNetAmount"],
                "transactionCurrency": row["transactionCurrency"],
                "billingDocumentIsCancelled": row["billingDocumentIsCancelled"],
                "accountingDocument": row["accountingDocument"],
                "soldToParty": row["soldToParty"],
                "creationDate": row["creationDate"],
            }
            add_typed_node(graph, node_id, "BillingDocument", f"BILL-{node_id}", meta)

        for row in conn.execute(
            """
            SELECT companyCode, fiscalYear, accountingDocument,
                   amountInTransactionCurrency, transactionCurrency,
                   postingDate, referenceDocument
            FROM journal_entry_ar
            GROUP BY companyCode, fiscalYear, accountingDocument
            """
        ):
            node_id = f"{row['companyCode']}-{row['fiscalYear']}-{row['accountingDocument']}"
            meta = {
                "amountInTransactionCurrency": row["amountInTransactionCurrency"],
                "transactionCurrency": row["transactionCurrency"],
                "postingDate": row["postingDate"],
                "referenceDocument": row["referenceDocument"],
            }
            add_typed_node(graph, node_id, "JournalEntry", f"JE-{row['accountingDocument']}", meta)

        for row in conn.execute(
            """
            SELECT companyCode, fiscalYear, accountingDocument, accountingDocumentItem,
                   amountInTransactionCurrency, transactionCurrency,
                   clearingDate, customer
            FROM payments_ar
            """
        ):
            node_id = (
                f"{row['companyCode']}-{row['fiscalYear']}-"
                f"{row['accountingDocument']}-{row['accountingDocumentItem']}"
            )
            meta = {
                "amountInTransactionCurrency": row["amountInTransactionCurrency"],
                "transactionCurrency": row["transactionCurrency"],
                "clearingDate": row["clearingDate"],
                "customer": row["customer"],
            }
            add_typed_node(graph, node_id, "Payment", f"PAY-{row['accountingDocument']}", meta)

        for row in conn.execute(
            """
            SELECT p.product, pd.productDescription, p.productType,
                   p.baseUnit, p.grossWeight, p.productGroup
            FROM products p
            LEFT JOIN product_descriptions pd
              ON pd.product = p.product AND pd.language = 'EN'
            """
        ):
            node_id = safe_str(row["product"])
            label = row["productDescription"] or node_id
            meta = {
                "productType": row["productType"],
                "baseUnit": row["baseUnit"],
                "grossWeight": row["grossWeight"],
                "productGroup": row["productGroup"],
            }
            add_typed_node(graph, node_id, "Product", label, meta)

        for row in conn.execute(
            """
            SELECT plant, plantName, salesOrganization, distributionChannel
            FROM plants
            """
        ):
            node_id = safe_str(row["plant"])
            label = row["plantName"] or node_id
            meta = {
                "salesOrganization": row["salesOrganization"],
                "distributionChannel": row["distributionChannel"],
            }
            add_typed_node(graph, node_id, "Plant", label, meta)

        for row in conn.execute(
            """
            SELECT bp.businessPartner, soh.salesOrder
            FROM business_partners bp
            JOIN sales_order_headers soh
              ON soh.soldToParty = bp.businessPartner
            """
        ):
            add_relation(graph, row["businessPartner"], row["salesOrder"], "PLACED")

        for row in conn.execute(
            """
            SELECT salesOrder, salesOrderItem
            FROM sales_order_items
            """
        ):
            add_relation(
                graph,
                row["salesOrder"],
                f"{row['salesOrder']}-{row['salesOrderItem']}",
                "HAS_ITEM",
            )

        for row in conn.execute(
            """
            SELECT salesOrder, salesOrderItem, material, productionPlant
            FROM sales_order_items
            """
        ):
            item_id = f"{row['salesOrder']}-{row['salesOrderItem']}"
            add_relation(graph, item_id, row["material"], "REFERENCES")
            add_relation(graph, item_id, row["productionPlant"], "PRODUCED_AT")

        for row in conn.execute(
            """
            SELECT referenceSdDocument, referenceSdDocumentItem, deliveryDocument
            FROM outbound_delivery_items
            WHERE referenceSdDocument IS NOT NULL
              AND referenceSdDocumentItem IS NOT NULL
            """
        ):
            item_id = f"{row['referenceSdDocument']}-{row['referenceSdDocumentItem']}"
            add_relation(graph, item_id, row["deliveryDocument"], "FULFILLED_BY")

        for row in conn.execute(
            """
            SELECT DISTINCT bdi.referenceSdDocument, bdi.billingDocument
            FROM billing_document_items bdi
            JOIN outbound_delivery_headers odh
              ON odh.deliveryDocument = bdi.referenceSdDocument
            """
        ):
            add_relation(graph, row["referenceSdDocument"], row["billingDocument"], "BILLED_AS")

        for row in conn.execute(
            """
            SELECT DISTINCT bdh.billingDocument, je.companyCode, je.fiscalYear, je.accountingDocument
            FROM billing_document_headers bdh
            JOIN journal_entry_ar je
              ON je.accountingDocument = bdh.accountingDocument
            """
        ):
            je_id = f"{row['companyCode']}-{row['fiscalYear']}-{row['accountingDocument']}"
            add_relation(graph, row["billingDocument"], je_id, "POSTED_TO")

        for row in conn.execute(
            """
            SELECT DISTINCT je.companyCode AS jeCompanyCode,
                            je.fiscalYear AS jeFiscalYear,
                            je.accountingDocument AS jeAccountingDocument,
                            pay.companyCode AS payCompanyCode,
                            pay.fiscalYear AS payFiscalYear,
                            pay.accountingDocument AS payAccountingDocument,
                            pay.accountingDocumentItem
            FROM journal_entry_ar je
            JOIN payments_ar pay
              ON pay.accountingDocument = je.accountingDocument
            """
        ):
            source = (
                f"{row['jeCompanyCode']}-{row['jeFiscalYear']}-"
                f"{row['jeAccountingDocument']}"
            )
            target = (
                f"{row['payCompanyCode']}-{row['payFiscalYear']}-"
                f"{row['payAccountingDocument']}-{row['accountingDocumentItem']}"
            )
            add_relation(graph, source, target, "SETTLED_BY")

        for row in conn.execute(
            """
            SELECT bp.businessPartner, bdh.billingDocument
            FROM business_partners bp
            JOIN billing_document_headers bdh
              ON bdh.soldToParty = bp.businessPartner
            """
        ):
            add_relation(graph, row["businessPartner"], row["billingDocument"], "BILLED_TO")

    type_counts = Counter()
    for _, attrs in graph.nodes(data=True):
        type_counts[attrs.get("type")] += 1

    print(
        f"Graph built: {graph.number_of_nodes()} nodes, "
        f"{graph.number_of_edges()} edges"
    )
    for node_type, count in sorted(type_counts.items()):
        print(f"  {node_type}: {count}")

    return graph


def get_full_graph_json(G):
    nodes = []
    for node_id, attrs in G.nodes(data=True):
        nodes.append(node_payload(node_id, attrs.get("type"), attrs.get("label"), attrs.get("data", {})))

    edges = []
    for source, _ in G.nodes(data=True):
        for target in G.successors(source):
            edge_data = G.get_edge_data(source, target, {}) or {}
            edges.append(
                {
                    "source": str(source),
                    "target": str(target),
                    "relation": edge_data.get("relation"),
                }
            )
    return {"nodes": nodes, "edges": edges}


def get_node_neighbors(G, node_id):
    node_id = str(node_id)
    node = serialize_node(G, node_id)
    if node is None:
        return {"node": None, "neighbors": []}

    neighbors = []
    seen = set()

    for target in G.successors(node_id):
        relation = (G.get_edge_data(node_id, target, {}) or {}).get("relation")
        key = ("out", target, relation)
        if key not in seen:
            neighbors.append(
                {
                    "node": serialize_node(G, target),
                    "relation": relation,
                    "direction": "out",
                }
            )
            seen.add(key)

    for source in G.predecessors(node_id):
        relation = (G.get_edge_data(source, node_id, {}) or {}).get("relation")
        key = ("in", source, relation)
        if key not in seen:
            neighbors.append(
                {
                    "node": serialize_node(G, source),
                    "relation": relation,
                    "direction": "in",
                }
            )
            seen.add(key)

    return {"node": node, "neighbors": neighbors}


def first_successor_of_type(G, node_id, node_type, relation=None):
    for target in G.successors(node_id):
        attrs = node_attrs(G, target)
        edge_data = G.get_edge_data(node_id, target, {}) or {}
        if attrs.get("type") == node_type and (relation is None or edge_data.get("relation") == relation):
            return target
    return None


def successors_of_type(G, node_id, node_type, relation=None):
    matches = []
    for target in G.successors(node_id):
        attrs = node_attrs(G, target)
        edge_data = G.get_edge_data(node_id, target, {}) or {}
        if attrs.get("type") == node_type and (relation is None or edge_data.get("relation") == relation):
            matches.append(target)
    return matches


def predecessors_of_type(G, node_id, node_type, relation=None):
    matches = []
    for source in G.predecessors(node_id):
        attrs = node_attrs(G, source)
        edge_data = G.get_edge_data(source, node_id, {}) or {}
        if attrs.get("type") == node_type and (relation is None or edge_data.get("relation") == relation):
            matches.append(source)
    return matches


def get_o2c_flow(G, db_path, sales_order_id):
    _ = db_path
    sales_order_node = str(sales_order_id)
    sales_order = serialize_node(G, sales_order_node)
    if sales_order is None:
        return {"salesOrder": None, "customer": None, "items": []}

    customer_ids = predecessors_of_type(G, sales_order_node, "BusinessPartner", "PLACED")
    item_ids = successors_of_type(G, sales_order_node, "SalesOrderItem", "HAS_ITEM")

    items = []
    for item_id in item_ids:
        product_id = first_successor_of_type(G, item_id, "Product", "REFERENCES")
        plant_id = first_successor_of_type(G, item_id, "Plant", "PRODUCED_AT")
        delivery_ids = successors_of_type(G, item_id, "Delivery", "FULFILLED_BY")

        deliveries = []
        for delivery_id in delivery_ids:
            billing_ids = successors_of_type(G, delivery_id, "BillingDocument", "BILLED_AS")
            billings = []
            for billing_id in billing_ids:
                journal_entry_id = first_successor_of_type(G, billing_id, "JournalEntry", "POSTED_TO")
                payment_ids = (
                    successors_of_type(G, journal_entry_id, "Payment", "SETTLED_BY")
                    if journal_entry_id
                    else []
                )
                billings.append(
                    {
                        "billing": serialize_node(G, billing_id),
                        "journalEntry": serialize_node(G, journal_entry_id) if journal_entry_id else None,
                        "payments": [serialize_node(G, payment_id) for payment_id in payment_ids],
                    }
                )
            deliveries.append(
                {
                    "delivery": serialize_node(G, delivery_id),
                    "billingDocuments": billings,
                }
            )

        items.append(
            {
                "item": serialize_node(G, item_id),
                "product": serialize_node(G, product_id) if product_id else None,
                "plant": serialize_node(G, plant_id) if plant_id else None,
                "deliveries": deliveries,
            }
        )

    return {
        "salesOrder": sales_order,
        "customer": serialize_node(G, customer_ids[0]) if customer_ids else None,
        "items": items,
    }


def get_broken_flows(G, db_path):
    _ = db_path
    issues = []
    for node_id, attrs in G.nodes(data=True):
        if attrs.get("type") != "SalesOrder":
            continue

        sales_order_id = str(node_id)
        item_ids = successors_of_type(G, sales_order_id, "SalesOrderItem", "HAS_ITEM")
        delivery_ids = []
        billing_ids = []
        journal_entry_ids = []
        payment_ids = []

        for item_id in item_ids:
            deliveries = successors_of_type(G, item_id, "Delivery", "FULFILLED_BY")
            delivery_ids.extend(deliveries)
            for delivery_id in deliveries:
                billings = successors_of_type(G, delivery_id, "BillingDocument", "BILLED_AS")
                billing_ids.extend(billings)
                for billing_id in billings:
                    entries = successors_of_type(G, billing_id, "JournalEntry", "POSTED_TO")
                    journal_entry_ids.extend(entries)
                    for entry_id in entries:
                        payment_ids.extend(successors_of_type(G, entry_id, "Payment", "SETTLED_BY"))

        if item_ids and not delivery_ids:
            issues.append(
                {
                    "salesOrder": sales_order_id,
                    "issue": "no_delivery",
                    "details": "Sales order has items but no delivery connected",
                }
            )

        if attrs.get("data", {}).get("overallDeliveryStatus") == "C" and not billing_ids:
            issues.append(
                {
                    "salesOrder": sales_order_id,
                    "issue": "delivered_not_billed",
                    "details": "Fully delivered but no billing document found",
                }
            )

        if billing_ids and not journal_entry_ids:
            issues.append(
                {
                    "salesOrder": sales_order_id,
                    "issue": "billed_not_posted",
                    "details": "Billing document exists but no journal entry found",
                }
            )

        uncleared = []
        for payment_id in payment_ids:
            payment = serialize_node(G, payment_id)
            if payment and payment["data"].get("clearingDate") is None:
                uncleared.append(payment_id)
        if uncleared:
            issues.append(
                {
                    "salesOrder": sales_order_id,
                    "issue": "paid_not_cleared",
                    "details": f"Payment exists but clearingDate is null ({len(uncleared)} payment nodes)",
                }
            )

    return issues


def get_graph_stats(G):
    by_type = Counter()
    for _, attrs in G.nodes(data=True):
        by_type[attrs.get("type")] += 1

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        top_customers = [
            dict(row)
            for row in conn.execute(
                """
                SELECT bp.businessPartner,
                       COALESCE(bp.businessPartnerFullName, bp.businessPartnerName, bp.businessPartner) AS label,
                       COUNT(*) AS orderCount
                FROM sales_order_headers soh
                JOIN business_partners bp
                  ON bp.businessPartner = soh.soldToParty
                GROUP BY bp.businessPartner
                ORDER BY orderCount DESC, bp.businessPartner
                LIMIT 5
                """
            )
        ]

        top_products = [
            dict(row)
            for row in conn.execute(
                """
                SELECT p.product,
                       COALESCE(pd.productDescription, p.product) AS label,
                       ROUND(SUM(COALESCE(bdi.netAmount, 0)), 2) AS billedAmount
                FROM billing_document_items bdi
                JOIN products p
                  ON p.product = bdi.material
                LEFT JOIN product_descriptions pd
                  ON pd.product = p.product AND pd.language = 'EN'
                GROUP BY p.product
                ORDER BY billedAmount DESC, p.product
                LIMIT 5
                """
            )
        ]

    return {
        "total_nodes": G.number_of_nodes(),
        "total_edges": G.number_of_edges(),
        "by_type": dict(sorted(by_type.items())),
        "top_customers_by_orders": top_customers,
        "top_products_by_billing": top_products,
    }


if __name__ == "__main__":
    graph = build_graph(DB_PATH)
    print(json.dumps(get_graph_stats(graph), indent=2))

    first_sales_order = None
    for node_id, attrs in graph.nodes(data=True):
        if attrs.get("type") == "SalesOrder":
            first_sales_order = node_id
            break

    if first_sales_order:
        print(json.dumps(get_node_neighbors(graph, first_sales_order), indent=2))

    broken_flows = get_broken_flows(graph, DB_PATH)
    issue_counts = Counter(item["issue"] for item in broken_flows)
    print(json.dumps(dict(sorted(issue_counts.items())), indent=2))
