# Pinot Pulse Enterprise — Test Data Package

End-to-end test datasets and loader scripts for the 3 primary ingestion pathways:

| # | Dataset | Records | Format | Target | Pinot Pulse Pipeline |
|---|---------|---------|--------|--------|----------------------|
| 1 | **Members** | 500 | CSV | AWS S3 | `S3Consumer` → batch ingestion |
| 2 | **Accounts** | 800 | NDJSON | Google BigQuery | `BigQueryConnector` → warehouse sync |
| 3 | **Transactions** | 5,000 | JSONL | Apache Kafka | `KafkaConsumer` → real-time streaming |

All datasets use the **exact canonical schemas** from `ingestion/schemas/canonical/` and are scoped to a single test organization: **Midwest Community Credit Union** (`a1b2c3d4-e5f6-7890-abcd-ef1234567890`).

---

## Quick Start

```bash
# 1. Install dependencies
pip install boto3 google-cloud-bigquery kafka-python requests

# 2. Configure credentials
cp .env.example .env
# Edit .env with your AWS, GCP, and Kafka credentials

# 3. Generate datasets
python3 generate_datasets.py

# 4. Test connections (no data sent)
./run_all.sh --test

# 5. Full run: generate + load + verify
./run_all.sh
```

---

## File Structure

```
test-data/
├── generate_datasets.py        # Generates all 3 datasets
├── run_all.sh                  # Master orchestrator script
├── .env.example                # Environment config template
├── README.md                   # This file
├── datasets/                   # Generated data files
│   ├── members.csv             # 500 members (S3 target)
│   ├── members.json            # Same data in JSON
│   ├── accounts.ndjson         # 800 accounts (BigQuery target)
│   ├── accounts.json           # Same data in JSON
│   ├── transactions.jsonl      # 5,000 transactions (Kafka target)
│   └── metadata.json           # Dataset metadata
└── scripts/
    ├── load_s3.py              # AWS S3 uploader
    ├── load_bigquery.py        # BigQuery loader
    ├── load_kafka.py           # Kafka producer
    └── verify_ingestion.py     # End-to-end verification
```

---

## Individual Script Usage

### S3 Loader (Members)
```bash
# Connection test
python3 scripts/load_s3.py --test

# Upload to S3
python3 scripts/load_s3.py --bucket pinot-pulse-data --create-bucket

# LocalStack (local testing)
python3 scripts/load_s3.py --endpoint http://localhost:4566 --create-bucket
```

### BigQuery Loader (Accounts)
```bash
# Connection test
python3 scripts/load_bigquery.py --test --project my-gcp-project

# Load to BigQuery
python3 scripts/load_bigquery.py --project my-gcp-project --create-dataset
```

### Kafka Producer (Transactions)
```bash
# Connection test
python3 scripts/load_kafka.py --test

# Stream at full speed
python3 scripts/load_kafka.py --create-topic

# Rate-limited streaming (100 msgs/sec)
python3 scripts/load_kafka.py --create-topic --rate 100

# Confluent Cloud
python3 scripts/load_kafka.py \
  --bootstrap pkc-xxxxx.confluent.cloud:9092 \
  --security-protocol SASL_SSL \
  --sasl-mechanism PLAIN \
  --sasl-user YOUR_API_KEY \
  --sasl-pass YOUR_API_SECRET \
  --create-topic

# Dry run (validate without sending)
python3 scripts/load_kafka.py --dry-run
```

### Verification
```bash
python3 scripts/verify_ingestion.py --all       # Check everything
python3 scripts/verify_ingestion.py --s3         # S3 only
python3 scripts/verify_ingestion.py --bigquery   # BigQuery only
python3 scripts/verify_ingestion.py --kafka      # Kafka only
python3 scripts/verify_ingestion.py --pinot      # Apache Pinot tables
python3 scripts/verify_ingestion.py --api        # Pinot Pulse API
```

---

## Data Flow Through Pinot Pulse

```
                    ┌─────────────────────────────────────────┐
                    │         PINOT PULSE ENTERPRISE           │
                    │                                         │
S3 (members.csv)   │  S3Consumer (batch.py)                  │
  ───────────────>  │    → field mapping                      │
                    │    → validation (credit_score 300-850)  │
                    │    → dedup by member_id                 │
                    │    ─────> PostgreSQL analytics.members  │
                    │    ─────> Apache Pinot members table    │
                    │                                         │
BigQuery (accounts) │  BigQueryConnector (connectors.py)      │
  ───────────────>  │    → warehouse sync                     │
                    │    → schema mapping                     │
                    │    ─────> PostgreSQL analytics.accounts │
                    │    ─────> Apache Pinot accounts table   │
                    │                                         │
Kafka (txns.jsonl)  │  KafkaConsumer (kafka.py)               │
  ───────────────>  │    → real-time streaming                │
                    │    → validation (amount ≠ 0, etc.)     │
                    │    → risk_score >= 80 → is_suspicious  │
                    │    → DLQ for failed records             │
                    │    ─────> PostgreSQL analytics.txns     │
                    │    ─────> Apache Pinot txns (REALTIME)  │
                    └─────────────────────────────────────────┘
```

---

## Existing Pipeline Configs

These ingestion pipeline YAML files in the codebase define how Pinot Pulse processes each data source:

| Pipeline | File | Consumer |
|----------|------|----------|
| S3 batch members | `ingestion/batch/file-transactions.yaml` | `S3Consumer` |
| Kafka transactions | `ingestion/kafka/transaction-events.yaml` | `KafkaConsumer` |
| Kafka members | `ingestion/kafka/member-events.yaml` | `KafkaConsumer` |
| Snowflake historical | `ingestion/snowflake/historical-transactions.yaml` | `SnowflakeConsumer` |
| BigQuery warehouse | `backend/app/warehouse/providers/bigquery.py` | `BigQueryConnector` |

## Existing Backend Components

| Component | Path | Purpose |
|-----------|------|---------|
| Ingestion engine | `backend/app/ingestion/engine.py` | BaseConsumer, DLQ, orchestrator |
| Kafka consumer | `backend/app/ingestion/providers/kafka.py` | Real-time Kafka ingestion |
| S3 consumer | `backend/app/ingestion/providers/batch.py` | S3/SFTP/file batch ingestion |
| BigQuery connector | `backend/app/services/connectors.py` | BigQuery warehouse connector |
| BigQuery provider | `backend/app/warehouse/providers/bigquery.py` | BigQuery query engine |
| Pipeline API | `backend/app/api/v1/endpoints/ingestion.py` | REST API for pipeline CRUD |
| Ingestion config | `backend/app/ingestion/config.py` | Pydantic models for all providers |
| Credentials | `backend/app/ingestion/credentials.py` | Vault-based secret management |
| Core banking | `backend/app/integrations/core_banking/connectors.py` | Fiserv/Symitar/KeyStone |

---

## Test Data Characteristics

### Members (500 records)
- Texas cities (Temple, Belton, Killeen, Waco, Austin, etc.)
- 5 segments: platinum (5%), gold (15%), silver (35%), bronze (30%), new (15%)
- Credit scores calibrated by segment (platinum: 760-850, bronze: 580-660)
- ~80% active, 10% inactive, 10% pending
- Realistic income ranges by segment

### Accounts (800 records)
- 60% deposit accounts (regular_share, share_draft, money_market, certificate, IRA)
- 40% loan/credit accounts (auto_loan, mortgage, credit_card, personal_loan)
- Interest rates: deposits 0.01-5.25%, loans 3.5-24.99%
- Linked to active members via member_id

### Transactions (5,000 records)
- 18 transaction types (deposit, withdrawal, card_purchase, ach_credit, etc.)
- 8 channels (branch, online, mobile, atm, ach, pos, etc.)
- ~2% flagged as suspicious (risk_score >= 80)
- Realistic merchant data for card transactions
- Sorted by timestamp (90-day window)
# pinot-pulse-test-data
# pinot-pulse-test-data
# pinot-pulse-test-data
