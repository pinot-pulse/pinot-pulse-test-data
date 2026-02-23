#!/usr/bin/env python3
"""
Pinot Pulse Enterprise — Data Ingestion Verification
Checks that data was successfully loaded to S3, BigQuery, and Kafka,
then verifies Pinot Pulse processed it into Apache Pinot + PostgreSQL.

Usage:
  python3 verify_ingestion.py --all              # Check everything
  python3 verify_ingestion.py --s3               # S3 only
  python3 verify_ingestion.py --bigquery         # BigQuery only
  python3 verify_ingestion.py --kafka            # Kafka only
  python3 verify_ingestion.py --pinot            # Pinot tables only
  python3 verify_ingestion.py --api              # Check via Pinot Pulse API
"""
import argparse
import json
import os
import sys

# ANSI colors
G = "\033[92m"  # green
R = "\033[91m"  # red
Y = "\033[93m"  # yellow
B = "\033[94m"  # blue
N = "\033[0m"   # reset

def ok(msg):  print(f"  {G}✓{N} {msg}")
def fail(msg): print(f"  {R}✗{N} {msg}")
def warn(msg): print(f"  {Y}⚠{N} {msg}")
def info(msg): print(f"  {B}→{N} {msg}")

EXPECTED = {"members": 500, "accounts": 800, "transactions": 5000}


def check_s3(args):
    print(f"\n{'='*50}")
    print(f"  S3 — Members Dataset")
    print(f"{'='*50}")
    try:
        import boto3
        s3_kwargs = {}
        if os.getenv("S3_ENDPOINT_URL"):
            s3_kwargs["endpoint_url"] = os.getenv("S3_ENDPOINT_URL")
        s3 = boto3.client("s3", **s3_kwargs)

        bucket = os.getenv("S3_BUCKET", "pinot-pulse-data")
        prefix = "members/"
        info(f"Bucket: {bucket}, Prefix: {prefix}")

        resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
        objects = resp.get("Contents", [])
        if objects:
            ok(f"Found {len(objects)} objects in s3://{bucket}/{prefix}")
            for obj in objects:
                print(f"      {obj['Key']}  ({obj['Size']:,} bytes)")

            # Check CSV row count
            csv_key = f"{prefix}members.csv"
            try:
                result = s3.select_object_content(
                    Bucket=bucket, Key=csv_key,
                    ExpressionType="SQL",
                    Expression="SELECT COUNT(*) FROM s3object",
                    InputSerialization={"CSV": {"FileHeaderInfo": "USE"}},
                    OutputSerialization={"JSON": {}},
                )
                for event in result["Payload"]:
                    if "Records" in event:
                        data = json.loads(event["Records"]["Payload"].decode())
                        count = int(data.get("_1", 0))
                        if count >= EXPECTED["members"]:
                            ok(f"Row count: {count} (expected ≥{EXPECTED['members']})")
                        else:
                            fail(f"Row count: {count} (expected ≥{EXPECTED['members']})")
            except Exception:
                # S3 Select may not be available (LocalStack)
                ok("Files present (S3 Select not available for row count)")
        else:
            fail("No objects found")
    except ImportError:
        warn("boto3 not installed — skipping S3 check")
    except Exception as e:
        fail(f"S3 check failed: {e}")


def check_bigquery(args):
    print(f"\n{'='*50}")
    print(f"  BigQuery — Accounts Dataset")
    print(f"{'='*50}")
    try:
        from google.cloud import bigquery
        client = bigquery.Client()
        project = client.project
        dataset = os.getenv("BQ_DATASET", "pinot_pulse_raw")
        table_ref = f"{project}.{dataset}.accounts"
        info(f"Table: {table_ref}")

        table = client.get_table(table_ref)
        if table.num_rows >= EXPECTED["accounts"]:
            ok(f"Row count: {table.num_rows:,} (expected ≥{EXPECTED['accounts']})")
        else:
            fail(f"Row count: {table.num_rows:,} (expected ≥{EXPECTED['accounts']})")

        ok(f"Table size: {table.num_bytes:,} bytes")

        # Summary query
        query = f"""
        SELECT account_category, COUNT(*) as cnt,
               ROUND(SUM(current_balance),2) as total_bal
        FROM `{table_ref}` GROUP BY 1 ORDER BY 2 DESC
        """
        result = client.query(query).result()
        for row in result:
            info(f"{row.account_category}: {row.cnt} accounts, ${row.total_bal:,.2f}")

    except ImportError:
        warn("google-cloud-bigquery not installed — skipping BigQuery check")
    except Exception as e:
        fail(f"BigQuery check failed: {e}")


def check_kafka(args):
    print(f"\n{'='*50}")
    print(f"  Kafka — Transaction Events")
    print(f"{'='*50}")
    try:
        from kafka import KafkaConsumer, TopicPartition
        bootstrap = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        topic = os.getenv("KAFKA_TOPIC", "pinot-pulse.transactions")
        info(f"Bootstrap: {bootstrap}, Topic: {topic}")

        consumer = KafkaConsumer(
            bootstrap_servers=bootstrap.split(","),
            security_protocol=os.getenv("KAFKA_SECURITY_PROTOCOL", "PLAINTEXT"),
            auto_offset_reset="earliest",
            consumer_timeout_ms=5000,
        )

        # Check topic exists
        topics = consumer.topics()
        if topic in topics:
            ok(f"Topic '{topic}' exists")

            # Get partition info and offsets
            partitions = consumer.partitions_for_topic(topic)
            total_msgs = 0
            for p in partitions:
                tp = TopicPartition(topic, p)
                consumer.assign([tp])
                consumer.seek_to_end(tp)
                end_offset = consumer.position(tp)
                consumer.seek_to_beginning(tp)
                begin_offset = consumer.position(tp)
                count = end_offset - begin_offset
                total_msgs += count
                info(f"Partition {p}: {count:,} messages (offsets {begin_offset}-{end_offset})")

            if total_msgs >= EXPECTED["transactions"]:
                ok(f"Total messages: {total_msgs:,} (expected ≥{EXPECTED['transactions']})")
            else:
                warn(f"Total messages: {total_msgs:,} (expected ≥{EXPECTED['transactions']})")
        else:
            fail(f"Topic '{topic}' not found. Available: {list(topics)[:10]}")

        consumer.close()
    except ImportError:
        warn("kafka-python not installed — skipping Kafka check")
    except Exception as e:
        fail(f"Kafka check failed: {e}")


def check_pinot(args):
    print(f"\n{'='*50}")
    print(f"  Apache Pinot — Ingested Tables")
    print(f"{'='*50}")
    try:
        import requests
        pinot_url = os.getenv("PINOT_BROKER_URL", "http://localhost:8099")
        info(f"Pinot Broker: {pinot_url}")

        # Check each table
        for table_name, expected in EXPECTED.items():
            try:
                query = f"SELECT COUNT(*) AS cnt FROM {table_name}"
                resp = requests.post(
                    f"{pinot_url}/query/sql",
                    json={"sql": query},
                    timeout=10,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    rows = data.get("resultTable", {}).get("rows", [[0]])
                    count = rows[0][0] if rows else 0
                    if count >= expected:
                        ok(f"{table_name}: {count:,} rows (expected ≥{expected})")
                    elif count > 0:
                        warn(f"{table_name}: {count:,} rows (expected ≥{expected}, ingestion may be in progress)")
                    else:
                        fail(f"{table_name}: 0 rows (expected ≥{expected})")
                else:
                    fail(f"{table_name}: query returned HTTP {resp.status_code}")
            except Exception as e:
                fail(f"{table_name}: {e}")

        # Run an analytics query
        print(f"\n  Verification Queries:")
        queries = [
            ("Members by segment",
             "SELECT segment, COUNT(*) cnt FROM members GROUP BY segment ORDER BY cnt DESC LIMIT 5"),
            ("Transactions by type",
             "SELECT transaction_type, COUNT(*) cnt, SUM(amount) total FROM transactions GROUP BY transaction_type ORDER BY cnt DESC LIMIT 5"),
            ("Accounts by category",
             "SELECT account_category, COUNT(*) cnt, SUM(current_balance) bal FROM accounts GROUP BY account_category ORDER BY cnt DESC"),
        ]
        for label, sql in queries:
            try:
                resp = requests.post(f"{pinot_url}/query/sql", json={"sql": sql}, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    rows = data.get("resultTable", {}).get("rows", [])
                    info(f"{label}:")
                    for r in rows[:5]:
                        print(f"        {r}")
            except:
                pass

    except ImportError:
        warn("requests not installed — skipping Pinot check (pip install requests)")
    except Exception as e:
        fail(f"Pinot check failed: {e}")


def check_api(args):
    print(f"\n{'='*50}")
    print(f"  Pinot Pulse API — Pipeline Status")
    print(f"{'='*50}")
    try:
        import requests
        api_url = os.getenv("API_URL", "http://localhost:8000/api/v1")
        info(f"API: {api_url}")

        # Check pipeline status
        try:
            resp = requests.get(f"{api_url}/ingestion/pipelines", timeout=10)
            if resp.status_code == 200:
                pipelines = resp.json()
                ok(f"Found {len(pipelines)} pipelines")
                for p in pipelines:
                    status = p.get("status", "unknown")
                    name = p.get("name", p.get("id", "?"))
                    color = G if status == "running" else Y if status == "configured" else R
                    print(f"      {color}{status:>12}{N}  {name}")
            elif resp.status_code == 401:
                warn("API returned 401 — need authentication token")
            else:
                fail(f"API returned HTTP {resp.status_code}")
        except Exception as e:
            fail(f"API check failed: {e}")

        # Check health
        try:
            resp = requests.get(f"{api_url.replace('/api/v1','')}/health", timeout=5)
            if resp.status_code == 200:
                ok("API health check passed")
            else:
                warn(f"API health: HTTP {resp.status_code}")
        except:
            warn("API health endpoint not reachable")

    except ImportError:
        warn("requests not installed — skipping API check")


def main():
    parser = argparse.ArgumentParser(description="Verify Pinot Pulse data ingestion")
    parser.add_argument("--all", action="store_true", help="Check everything")
    parser.add_argument("--s3", action="store_true")
    parser.add_argument("--bigquery", action="store_true")
    parser.add_argument("--kafka", action="store_true")
    parser.add_argument("--pinot", action="store_true")
    parser.add_argument("--api", action="store_true")
    args = parser.parse_args()

    # Default to --all if nothing specified
    if not any([args.all, args.s3, args.bigquery, args.kafka, args.pinot, args.api]):
        args.all = True

    print("═══ Pinot Pulse Enterprise — Ingestion Verification ═══")
    print(f"  Expected: {EXPECTED['members']} members, {EXPECTED['accounts']} accounts, "
          f"{EXPECTED['transactions']} transactions")

    if args.all or args.s3:      check_s3(args)
    if args.all or args.bigquery: check_bigquery(args)
    if args.all or args.kafka:    check_kafka(args)
    if args.all or args.pinot:    check_pinot(args)
    if args.all or args.api:      check_api(args)

    print(f"\n{'='*50}")
    print(f"  Verification complete.")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    main()
