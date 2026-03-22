import json
import sqlite3
from pathlib import Path

from schema import DDL_STATEMENTS, INDEX_STATEMENTS

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
DB_PATH = Path("./data/o2c.db")
DATASET_PATH = ROOT_DIR / "sap-o2c-data"


FOLDER_TO_TABLE = {
    "billing_document_cancellations": "billing_document_cancellations",
    "billing_document_headers": "billing_document_headers",
    "billing_document_items": "billing_document_items",
    "business_partner_addresses": "business_partner_addresses",
    "business_partners": "business_partners",
    "customer_company_assignments": "customer_company_assignments",
    "customer_sales_area_assignments": "customer_sales_area_assignments",
    "journal_entry_items_accounts_receivable": "journal_entry_ar",
    "outbound_delivery_headers": "outbound_delivery_headers",
    "outbound_delivery_items": "outbound_delivery_items",
    "payments_accounts_receivable": "payments_ar",
    "plants": "plants",
    "product_descriptions": "product_descriptions",
    "product_plants": "product_plants",
    "product_storage_locations": "product_storage_locations",
    "products": "products",
    "sales_order_headers": "sales_order_headers",
    "sales_order_items": "sales_order_items",
    "sales_order_schedule_lines": "sales_order_schedule_lines",
}


TIME_FIELDS = {
    "billing_document_cancellations": {"creationTime"},
    "billing_document_headers": {"creationTime"},
    "business_partners": {"creationTime"},
    "outbound_delivery_headers": {"actualGoodsMovementTime", "creationTime"},
}


INTEGER_ITEM_FIELDS = {
    "sales_order_items": {"salesOrderItem"},
    "sales_order_schedule_lines": {"salesOrderItem"},
    "outbound_delivery_items": {"referenceSdDocumentItem"},
    "billing_document_items": {"referenceSdDocumentItem"},
}


def safe_int(value):
    if value in (None, ""):
        return None
    if isinstance(value, int):
        return value
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def safe_float(value):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def safe_bool_int(value):
    if value in (None, ""):
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    text = str(value).strip().lower()
    if text in {"1", "true", "t", "yes", "y"}:
        return 1
    if text in {"0", "false", "f", "no", "n"}:
        return 0
    return None


def format_time_object(value):
    if not isinstance(value, dict):
        return value
    hours = int(value.get("hours", 0))
    minutes = int(value.get("minutes", 0))
    seconds = int(value.get("seconds", 0))
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def flatten_record(record, table_name):
    flattened = dict(record)
    for field in TIME_FIELDS.get(table_name, set()):
        if field in flattened:
            flattened[field] = format_time_object(flattened[field])
    for field in INTEGER_ITEM_FIELDS.get(table_name, set()):
        if field in flattened:
            flattened[field] = safe_int(flattened[field])
    return flattened


def create_schema(conn):
    for statement in DDL_STATEMENTS:
        conn.execute(statement)
    conn.commit()


def create_indexes(conn):
    for statement in INDEX_STATEMENTS:
        conn.execute(statement)
    conn.commit()


def get_table_metadata(conn, table_name):
    columns = []
    types = {}
    for _, name, col_type, *_ in conn.execute(f"PRAGMA table_info({table_name})"):
        columns.append(name)
        types[name] = col_type.upper()
    return columns, types


def coerce_record(record, columns, column_types):
    coerced = {}
    for column in columns:
        if column not in record:
            continue
        value = record[column]
        declared_type = column_types[column]
        if declared_type == "REAL":
            coerced[column] = safe_float(value)
        elif declared_type == "INTEGER":
            coerced[column] = safe_bool_int(value) if isinstance(value, bool) else safe_int(value)
        else:
            coerced[column] = value
    return coerced


def iter_jsonl_records(folder_path):
    for jsonl_file in sorted(folder_path.glob("*.jsonl")):
        with jsonl_file.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if line:
                    yield json.loads(line)


def load_table(conn, source_folder, table_name):
    folder_path = Path(source_folder)
    columns, column_types = get_table_metadata(conn, table_name)
    placeholders = ", ".join("?" for _ in columns)
    insert_sql = (
        f"INSERT OR IGNORE INTO {table_name} "
        f"({', '.join(columns)}) VALUES ({placeholders})"
    )

    inserted = 0
    for raw_record in iter_jsonl_records(folder_path):
        flattened = flatten_record(raw_record, table_name)
        filtered = coerce_record(flattened, columns, column_types)
        values = [filtered.get(column) for column in columns]
        conn.execute(insert_sql, values)
        inserted += 1
    return inserted


def load_all_data(db_path, dataset_path):
    db_file = Path(db_path)
    dataset_root = Path(dataset_path)

    if not dataset_root.exists():
        raise FileNotFoundError(f"Dataset path not found: {dataset_root}")

    db_file.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_file) as conn:
        create_schema(conn)

        for folder_name in sorted(FOLDER_TO_TABLE):
            folder_path = dataset_root / folder_name
            if not folder_path.is_dir():
                continue
            table_name = FOLDER_TO_TABLE[folder_name]
            load_table(conn, folder_path, table_name)
            row_count = conn.execute(
                f"SELECT COUNT(*) FROM {table_name}"
            ).fetchone()[0]
            print(f"{table_name}: {row_count} rows")

        create_indexes(conn)


def verify_data(db_path=DB_PATH):
    with sqlite3.connect(db_path) as conn:
        print("Verification:")
        for table_name in FOLDER_TO_TABLE.values():
            row_count = conn.execute(
                f"SELECT COUNT(*) FROM {table_name}"
            ).fetchone()[0]
            print(f"{table_name}: {row_count} rows")

        join_count = conn.execute(
            """
            SELECT COUNT(*)
            FROM outbound_delivery_items odi
            JOIN sales_order_items soi
              ON soi.salesOrder = odi.referenceSdDocument
             AND soi.salesOrderItem = odi.referenceSdDocumentItem
            """
        ).fetchone()[0]
        print(
            "outbound_delivery_items -> sales_order_items join matches: "
            f"{join_count}"
        )

        accounting_match_count = conn.execute(
            """
            SELECT COUNT(*)
            FROM billing_document_headers bdh
            WHERE EXISTS (
              SELECT 1
              FROM journal_entry_ar je
              WHERE je.accountingDocument = bdh.accountingDocument
            )
            """
        ).fetchone()[0]
        print(
            "billing_document_headers with matching journal_entry_ar: "
            f"{accounting_match_count}"
        )


if __name__ == "__main__":
    load_all_data(DB_PATH, DATASET_PATH)
    verify_data(DB_PATH)
