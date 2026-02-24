#!/usr/bin/env python3
"""
Pinot Pulse Enterprise — BigQuery Data Loader
Loads accounts dataset into Google BigQuery for warehouse sync.

Usage:
  python3 load_bigquery.py                              # Uses env vars
  python3 load_bigquery.py --project my-gcp-project     # Override project
  python3 load_bigquery.py --test                       # Connection test only

Required env vars (or pass as args):
  GOOGLE_APPLICATION_CREDENTIALS  (path to service account JSON)
  GCP_PROJECT_ID                  (or --project)
  BQ_DATASET (default: pinot_pulse_raw)
"""
import argparse
import json
import os
import sys
import time


def main():
    parser = argparse.ArgumentParser(description="Load accounts dataset to BigQuery")
    parser.add_argument("--project", default=os.getenv("GCP_PROJECT_ID", ""))
    parser.add_argument("--dataset", default=os.getenv("BQ_DATASET", "pinot_pulse_raw"))
    parser.add_argument("--table", default="accounts")
    parser.add_argument("--location", default="US")
    parser.add_argument("--credentials", default=os.getenv("GOOGLE_APPLICATION_CREDENTIALS", ""))
    parser.add_argument("--file", default="datasets/accounts.ndjson")
    parser.add_argument("--test", action="store_true", help="Test connection only")
    parser.add_argument("--create-dataset", action="store_true", help="Create dataset if missing")
    args = parser.parse_args()

    try:
        from google.cloud import bigquery
        from google.api_core.exceptions import NotFound, Conflict
    except ImportError:
        print("ERROR: google-cloud-bigquery not installed.")
        print("Run: pip install google-cloud-bigquery")
        sys.exit(1)

    print("═══ Pinot Pulse — BigQuery Data Loader ═══")
    print(f"  Project:  {args.project or '(from credentials)'}")
    print(f"  Dataset:  {args.dataset}")
    print(f"  Table:    {args.table}")
    print(f"  Location: {args.location}")

    # ─── Build Client ───
    client_kwargs = {}
    if args.project:
        client_kwargs["project"] = args.project
    if args.credentials:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = args.credentials

    try:
        client = bigquery.Client(**client_kwargs)
        project_id = client.project
        print(f"  Resolved project: {project_id}")
    except Exception as e:
        print(f"\n  ✗ Failed to create BigQuery client: {e}")
        print("  Set GOOGLE_APPLICATION_CREDENTIALS or use --credentials")
        sys.exit(1)

    # ─── Connection Test ───
    print("\n[1/5] Testing BigQuery connection...")
    try:
        datasets = list(client.list_datasets(max_results=5))
        print(f"  ✓ Connected to project '{project_id}' ({len(datasets)} datasets found)")
    except Exception as e:
        print(f"  ✗ Connection failed: {e}")
        sys.exit(1)

    # ─── Dataset Check ───
    dataset_ref = f"{project_id}.{args.dataset}"
    print(f"\n[2/5] Checking dataset '{args.dataset}'...")
    try:
        client.get_dataset(dataset_ref)
        print(f"  ✓ Dataset '{args.dataset}' exists")
    except NotFound:
        if args.create_dataset:
            print(f"  Creating dataset '{args.dataset}'...")
            ds = bigquery.Dataset(dataset_ref)
            ds.location = args.location
            ds.description = "Pinot Pulse Enterprise — Raw ingestion data"
            client.create_dataset(ds)
            print(f"  ✓ Dataset created")
        else:
            print(f"  ✗ Dataset '{args.dataset}' not found. Use --create-dataset to create it.")
            sys.exit(1)

    if args.test:
        print("\n  Connection test passed. Use without --test to load data.")
        return

    # ─── Define Schema ───
    print(f"\n[3/5] Configuring table schema...")
    schema = [
        bigquery.SchemaField("account_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("organization_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("member_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("branch_id", "STRING"),
        bigquery.SchemaField("account_number", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("account_type", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("account_category", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("status", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("is_primary", "BOOLEAN"),
        bigquery.SchemaField("current_balance", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("available_balance", "FLOAT64"),
        bigquery.SchemaField("interest_rate", "FLOAT64"),
        bigquery.SchemaField("ytd_interest", "FLOAT64"),
        bigquery.SchemaField("opened_date", "INT64", mode="REQUIRED",
                             description="Epoch milliseconds"),
        bigquery.SchemaField("last_activity_date", "INT64",
                             description="Epoch milliseconds"),
    ]

    table_ref = f"{dataset_ref}.{args.table}"

    # Create or replace table
    try:
        client.get_table(table_ref)
        print(f"  Table '{args.table}' exists — will append data")
    except NotFound:
        print(f"  Creating table '{args.table}'...")
        table = bigquery.Table(table_ref, schema=schema)
        table.description = "Credit union account data — Pinot Pulse canonical schema"
        table.labels = {"source": "pinot-pulse", "entity": "accounts"}
        client.create_table(table)
        print(f"  ✓ Table created")

    # ─── Load Data ───
    print(f"\n[4/5] Loading data from NDJSON...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, "..", args.file)
    if not os.path.exists(file_path):
        file_path = os.path.join(script_dir, args.file)
    if not os.path.exists(file_path):
        print(f"  ✗ File not found: {args.file}")
        sys.exit(1)

    file_size = os.path.getsize(file_path)
    print(f"  Source: {file_path} ({file_size:,} bytes)")

    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        schema=schema,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,  # Replace existing
        max_bad_records=0,
    )

    start = time.time()
    with open(file_path, "rb") as f:
        load_job = client.load_table_from_file(f, table_ref, job_config=job_config)

    print(f"  Job ID: {load_job.job_id}")
    print(f"  Waiting for load to complete...", end=" ")
    load_job.result()  # Blocks until done
    elapsed = time.time() - start
    print(f"✓ ({elapsed:.1f}s)")

    # ─── Verify ───
    print(f"\n[5/5] Verifying loaded data...")
    table = client.get_table(table_ref)
    print(f"  Total rows: {table.num_rows:,}")
    print(f"  Table size: {table.num_bytes:,} bytes")

    # Run a quick query
    query = f"""
    SELECT
        account_category,
        COUNT(*) as count,
        ROUND(SUM(current_balance), 2) as total_balance,
        ROUND(AVG(interest_rate), 4) as avg_rate
    FROM `{table_ref}`
    GROUP BY account_category
    ORDER BY count DESC
    """
    print(f"\n  Quick verification query:")
    result = client.query(query).result()
    for row in result:
        print(f"    {row.account_category:>8s}: {row.count:>4d} accounts, "
              f"${row.total_balance:>14,.2f} balance, {row.avg_rate:.4f}% avg rate")

    print(f"\n═══ BigQuery Load Complete ═══")
    print(f"  Table: {table_ref}")
    print(f"  Rows:  {table.num_rows:,}")
    print()
    print("  Pinot Pulse will sync via the BigQueryConnector.")
    print("  Connector: backend/app/services/connectors.py → BigQueryConnector")
    print("  Warehouse: backend/app/warehouse/providers/bigquery.py")
    print("  Configure via Admin UI: Settings → Integrations → BigQuery")


if __name__ == "__main__":
    main()
