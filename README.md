# Pinot Pulse Enterprise — Test Data Package

End-to-end test datasets and loader scripts for 4 datasets across primary ingestion pathways:

| # | Dataset | Records | Format | Target | Pinot Pulse Pipeline |
|---|---------|---------|--------|--------|----------------------|
| 1 | **Members** | 500 | CSV | AWS S3 | `S3Consumer` → batch ingestion |
| 2 | **Accounts** | 800 | NDJSON | Google BigQuery | `BigQueryConnector` → warehouse sync |
| 3 | **Transactions** | 5,000 | JSONL | Apache Kafka | `KafkaConsumer` → real-time streaming |
| 4 | **Loans** | 350 | JSON | PostgreSQL | `load_postgres.py` → analytics.loans |

All datasets use the **exact canonical schemas** from `ingestion/schemas/canonical/` and are scoped to a single test organization: **Midwest Community Credit Union** (`a1b2c3d4-e5f6-7890-abcd-ef1234567890`).

---

## Quick Start

```bash
# 1. Install dependencies
pip install boto3 google-cloud-bigquery kafka-python psycopg2-binary requests

# 2. Configure credentials
cp .env.example .env
# Edit .env with your AWS, GCP, Kafka, and PostgreSQL credentials

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
├── generate_datasets.py        # Generates all 4 datasets
├── run_all.sh                  # Master orchestrator script
├── .env.example                # Environment config template
├── README.md                   # This file
├── datasets/                   # Generated data files
│   ├── members.csv             # 500 members (S3 target)
│   ├── members.json            # Same data in JSON
│   ├── accounts.ndjson         # 800 accounts (BigQuery target)
│   ├── accounts.json           # Same data in JSON
│   ├── transactions.jsonl      # 5,000 transactions (Kafka target)
│   ├── loans.json              # 350 loans (PostgreSQL target)
│   ├── loans.ndjson            # Same data in NDJSON
│   └── metadata.json           # Dataset metadata
└── scripts/
    ├── load_s3.py              # AWS S3 uploader
    ├── load_bigquery.py        # BigQuery loader
    ├── load_kafka.py           # Kafka producer
    ├── load_postgres.py        # PostgreSQL loader (loans + regulatory tables)
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

### PostgreSQL Loader (Loans + Regulatory Tables)
```bash
# Connection test
python3 scripts/load_postgres.py --test

# Load loans dataset into analytics.loans
python3 scripts/load_postgres.py --loans

# Seed all 9 regulatory tables
python3 scripts/load_postgres.py --regulatory

# Full run: loans + all regulatory tables
python3 scripts/load_postgres.py --all

# Custom database URL
python3 scripts/load_postgres.py --all --db-url postgresql://user:pass@localhost:5432/pinotpulse
```

The `load_postgres.py` script seeds 9 regulatory tables required by the compliance and reporting modules:

| # | Table | Description |
|---|-------|-------------|
| 1 | `regulatory.ncua_call_reports` | NCUA 5300 call report data |
| 2 | `regulatory.bsa_ctr_filings` | BSA currency transaction reports |
| 3 | `regulatory.bsa_sar_filings` | BSA suspicious activity reports |
| 4 | `regulatory.hmda_lar` | HMDA loan application register |
| 5 | `regulatory.cra_assessments` | CRA community reinvestment assessments |
| 6 | `regulatory.reg_d_tracking` | Regulation D transfer tracking |
| 7 | `regulatory.ofac_screening_log` | OFAC sanctions screening results |
| 8 | `regulatory.reg_e_disputes` | Regulation E electronic fund disputes |
| 9 | `regulatory.tila_disclosures` | Truth in Lending Act disclosures |

### Verification
```bash
python3 scripts/verify_ingestion.py --all       # Check everything
python3 scripts/verify_ingestion.py --s3         # S3 only
python3 scripts/verify_ingestion.py --bigquery   # BigQuery only
python3 scripts/verify_ingestion.py --kafka      # Kafka only
python3 scripts/verify_ingestion.py --postgres   # PostgreSQL only
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
                    │                                         │
PostgreSQL (loans)  │  load_postgres.py (direct load)         │
  ───────────────>  │    → schema validation                  │
                    │    → 350 loan records → analytics.loans │
                    │    → 9 regulatory tables seeded         │
                    │    ─────> PostgreSQL analytics.loans    │
                    │    ─────> PostgreSQL regulatory.*       │
                    │    ─────> Apache Pinot loans table      │
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

### Loans (350 records)
- 6 loan types: auto_loan, mortgage, personal_loan, credit_card, home_equity, student_loan
- Loan amounts calibrated by type (mortgage: $50K-$500K, personal: $1K-$50K)
- Interest rates by type and risk tier (auto: 3.5-12.9%, mortgage: 5.0-8.5%)
- Loan statuses: current (65%), paid_off (15%), delinquent (10%), default (5%), in_collections (5%)
- Linked to active members via member_id
- Origination dates spanning 10-year window
- Regulatory fields: HMDA action_taken, TILA apr_disclosed, CRA assessment_area
