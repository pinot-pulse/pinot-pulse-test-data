#!/usr/bin/env python3
"""
Pinot Pulse Enterprise — Kafka Transaction Producer
Streams transaction events to Apache Kafka for real-time ingestion.

Usage:
  python3 load_kafka.py                                        # Uses env vars
  python3 load_kafka.py --bootstrap localhost:9092              # Override broker
  python3 load_kafka.py --test                                 # Connection test only
  python3 load_kafka.py --rate 100                             # 100 msgs/sec
  python3 load_kafka.py --sasl-user apikey --sasl-pass secret  # Confluent Cloud

Required env vars (or pass as args):
  KAFKA_BOOTSTRAP_SERVERS  (default: localhost:9092)
  KAFKA_TOPIC              (default: pinot-pulse.transactions)
  KAFKA_SECURITY_PROTOCOL  (PLAINTEXT, SASL_SSL, etc.)
  KAFKA_SASL_MECHANISM     (PLAIN, SCRAM-SHA-512, etc.)
  KAFKA_SASL_USERNAME
  KAFKA_SASL_PASSWORD
"""
import argparse
import json
import os
import sys
import time


def main():
    parser = argparse.ArgumentParser(description="Stream transactions to Kafka")
    parser.add_argument("--bootstrap",
                        default=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"))
    parser.add_argument("--topic",
                        default=os.getenv("KAFKA_TOPIC", "pinot-pulse.transactions"))
    parser.add_argument("--security-protocol",
                        default=os.getenv("KAFKA_SECURITY_PROTOCOL", "PLAINTEXT"))
    parser.add_argument("--sasl-mechanism",
                        default=os.getenv("KAFKA_SASL_MECHANISM", ""))
    parser.add_argument("--sasl-user",
                        default=os.getenv("KAFKA_SASL_USERNAME", ""))
    parser.add_argument("--sasl-pass",
                        default=os.getenv("KAFKA_SASL_PASSWORD", ""))
    parser.add_argument("--file", default="datasets/transactions.jsonl")
    parser.add_argument("--rate", type=int, default=0,
                        help="Messages per second (0=no limit)")
    parser.add_argument("--batch-size", type=int, default=100,
                        help="Batch size for producer")
    parser.add_argument("--test", action="store_true", help="Connection test only")
    parser.add_argument("--create-topic", action="store_true",
                        help="Create topic if missing")
    parser.add_argument("--partitions", type=int, default=3,
                        help="Number of partitions (for --create-topic)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and validate without sending")
    args = parser.parse_args()

    try:
        from kafka import KafkaProducer, KafkaAdminClient
        from kafka.admin import NewTopic
        from kafka.errors import TopicAlreadyExistsError, NoBrokersAvailable
    except ImportError:
        print("ERROR: kafka-python not installed.")
        print("Run: pip install kafka-python")
        sys.exit(1)

    print("═══ Pinot Pulse — Kafka Transaction Producer ═══")
    print(f"  Bootstrap: {args.bootstrap}")
    print(f"  Topic:     {args.topic}")
    print(f"  Protocol:  {args.security_protocol}")
    if args.sasl_mechanism:
        print(f"  SASL:      {args.sasl_mechanism}")
    if args.rate:
        print(f"  Rate:      {args.rate} msgs/sec")

    # ─── Build producer config ───
    config = {
        "bootstrap_servers": args.bootstrap.split(","),
        "security_protocol": args.security_protocol,
        "value_serializer": lambda v: json.dumps(v).encode("utf-8"),
        "key_serializer": lambda k: k.encode("utf-8") if k else None,
        "acks": "all",
        "retries": 3,
        "batch_size": args.batch_size * 1024,
        "linger_ms": 10,
        "compression_type": "gzip",
        "max_request_size": 10485760,
    }

    if args.sasl_mechanism:
        config["sasl_mechanism"] = args.sasl_mechanism
        config["sasl_plain_username"] = args.sasl_user
        config["sasl_plain_password"] = args.sasl_pass

    admin_config = {
        "bootstrap_servers": args.bootstrap.split(","),
        "security_protocol": args.security_protocol,
    }
    if args.sasl_mechanism:
        admin_config["sasl_mechanism"] = args.sasl_mechanism
        admin_config["sasl_plain_username"] = args.sasl_user
        admin_config["sasl_plain_password"] = args.sasl_pass

    # ─── Connection Test ───
    print("\n[1/4] Testing Kafka connection...")
    try:
        admin = KafkaAdminClient(**admin_config)
        topics = admin.list_topics()
        print(f"  ✓ Connected to Kafka cluster ({len(topics)} topics)")
        admin.close()
    except NoBrokersAvailable:
        print(f"  ✗ Cannot connect to {args.bootstrap}")
        print("    Make sure Kafka is running and accessible.")
        sys.exit(1)
    except Exception as e:
        print(f"  ✗ Connection failed: {e}")
        sys.exit(1)

    # ─── Topic Check ───
    print(f"\n[2/4] Checking topic '{args.topic}'...")
    try:
        admin = KafkaAdminClient(**admin_config)
        existing = admin.list_topics()
        if args.topic in existing:
            print(f"  ✓ Topic '{args.topic}' exists")
        elif args.create_topic:
            print(f"  Creating topic '{args.topic}' ({args.partitions} partitions)...")
            new_topic = NewTopic(
                name=args.topic,
                num_partitions=args.partitions,
                replication_factor=1,
            )
            try:
                admin.create_topics([new_topic])
                print(f"  ✓ Topic created")
            except TopicAlreadyExistsError:
                print(f"  ✓ Topic already exists (race condition)")
        else:
            print(f"  ✗ Topic '{args.topic}' not found. Use --create-topic to create it.")
            sys.exit(1)
        admin.close()
    except Exception as e:
        print(f"  ⚠ Topic check warning: {e}")

    if args.test:
        print("\n  Connection test passed. Use without --test to produce messages.")
        return

    # ─── Load & Produce ───
    print(f"\n[3/4] Loading transaction data...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, "..", args.file)
    if not os.path.exists(file_path):
        file_path = os.path.join(script_dir, args.file)
    if not os.path.exists(file_path):
        print(f"  ✗ File not found: {args.file}")
        sys.exit(1)

    # Read all transactions
    transactions = []
    with open(file_path, "r") as f:
        for line in f:
            line = line.strip()
            if line:
                transactions.append(json.loads(line))

    print(f"  Loaded {len(transactions):,} transactions")

    if args.dry_run:
        # Validate without sending
        print(f"\n  Dry run — validating {len(transactions)} records...")
        errors = 0
        for i, txn in enumerate(transactions):
            required = ["transaction_id", "organization_id", "member_id",
                        "account_id", "amount", "timestamp"]
            for field in required:
                if field not in txn or txn[field] is None:
                    print(f"    ✗ Record {i}: missing required field '{field}'")
                    errors += 1
        if errors == 0:
            print(f"  ✓ All {len(transactions)} records valid")
        else:
            print(f"  ✗ {errors} validation errors found")
        return

    # Create producer
    print(f"\n  Producing to topic '{args.topic}'...")
    producer = KafkaProducer(**config)

    sent = 0
    errors = 0
    start = time.time()
    rate_limiter = 1.0 / args.rate if args.rate > 0 else 0

    for i, txn in enumerate(transactions):
        key = txn.get("transaction_id", "")
        try:
            producer.send(args.topic, key=key, value=txn)
            sent += 1
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"    ✗ Error sending record {i}: {e}")

        # Progress
        if (i + 1) % 1000 == 0:
            elapsed = time.time() - start
            rate_actual = (i + 1) / elapsed if elapsed > 0 else 0
            print(f"    Sent {i+1:>6,} / {len(transactions):,} "
                  f"({rate_actual:.0f} msgs/sec)")

        # Rate limiting
        if rate_limiter > 0:
            time.sleep(rate_limiter)

    # Flush remaining
    print("  Flushing producer buffer...")
    producer.flush(timeout=30)
    producer.close()
    elapsed = time.time() - start

    # ─── Summary ───
    print(f"\n[4/4] Production complete")
    print(f"  ✓ Sent:     {sent:,} messages")
    if errors:
        print(f"  ✗ Errors:   {errors:,}")
    print(f"  Duration:   {elapsed:.1f}s")
    print(f"  Throughput: {sent/elapsed:.0f} msgs/sec")

    print(f"\n═══ Kafka Production Complete ═══")
    print(f"  Topic: {args.topic}")
    print(f"  Messages: {sent:,}")
    print()
    print("  Pinot Pulse KafkaConsumer will process these events in real-time.")
    print("  Pipeline config: ingestion/kafka/transaction-events.yaml")
    print("  Consumer group:  pinot-pulse-txn-consumer")
    print("  Targets:  Apache Pinot (REALTIME) + PostgreSQL (analytics.transactions)")


if __name__ == "__main__":
    main()
