#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Pinot Pulse Enterprise — Test Data Master Runner
# Loads all 3 datasets and verifies ingestion end-to-end.
#
# Usage:
#   ./run_all.sh                  # Full run: generate + load + verify
#   ./run_all.sh --generate       # Generate datasets only
#   ./run_all.sh --load-s3        # Load S3 only
#   ./run_all.sh --load-bq        # Load BigQuery only
#   ./run_all.sh --load-kafka     # Load Kafka only
#   ./run_all.sh --verify         # Verify only
#   ./run_all.sh --test           # Connection tests only (no data sent)
#   ./run_all.sh --dry-run        # Validate data without sending
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${BLUE}[RUNNER]${NC} $1"; }
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
fail() { echo -e "${RED}  ✗${NC} $1"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $1"; }

# ── Load .env if present ──
if [ -f "$SCRIPT_DIR/.env" ]; then
    log "Loading .env configuration..."
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
    ok ".env loaded"
else
    warn ".env not found — using environment variables or defaults"
    warn "Copy .env.example to .env and configure credentials"
fi

# ── Parse args ──
DO_GENERATE=false
DO_S3=false
DO_BQ=false
DO_KAFKA=false
DO_VERIFY=false
TEST_ONLY=false
DRY_RUN=false
DO_ALL=true

for arg in "$@"; do
    DO_ALL=false
    case $arg in
        --generate)   DO_GENERATE=true ;;
        --load-s3)    DO_S3=true ;;
        --load-bq)    DO_BQ=true ;;
        --load-kafka) DO_KAFKA=true ;;
        --verify)     DO_VERIFY=true ;;
        --test)       TEST_ONLY=true; DO_S3=true; DO_BQ=true; DO_KAFKA=true ;;
        --dry-run)    DRY_RUN=true ;;
        --help|-h)
            echo "Usage: $0 [--generate] [--load-s3] [--load-bq] [--load-kafka] [--verify] [--test] [--dry-run]"
            exit 0 ;;
        *) echo "Unknown option: $arg"; exit 1 ;;
    esac
done

if $DO_ALL; then
    DO_GENERATE=true; DO_S3=true; DO_BQ=true; DO_KAFKA=true; DO_VERIFY=true
fi

PASSED=0
FAILED=0
SKIPPED=0

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Pinot Pulse Enterprise — Test Data Pipeline${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Organization: Midwest Community Credit Union"
echo "  Org ID:       a1b2c3d4-e5f6-7890-abcd-ef1234567890"
echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 1: Check Dependencies
# ═══════════════════════════════════════════════════════════════
log "Checking Python dependencies..."

check_pkg() {
    if python3 -c "import $1" 2>/dev/null; then
        ok "$1 installed"
        return 0
    else
        warn "$1 not installed (pip install $2)"
        return 1
    fi
}

DEPS_OK=true
check_pkg boto3 boto3             || DEPS_OK=false
check_pkg google.cloud.bigquery google-cloud-bigquery || DEPS_OK=false
check_pkg kafka kafka-python      || DEPS_OK=false
check_pkg requests requests       || DEPS_OK=false

if ! $DEPS_OK; then
    warn "Some dependencies missing. Install with:"
    echo "    pip install boto3 google-cloud-bigquery kafka-python requests"
    echo ""
fi

# ═══════════════════════════════════════════════════════════════
# STEP 2: Generate Datasets
# ═══════════════════════════════════════════════════════════════
if $DO_GENERATE; then
    echo ""
    log "STEP 1: Generating test datasets..."
    echo "─────────────────────────────────────────────"
    python3 "$SCRIPT_DIR/generate_datasets.py"
    ok "Datasets generated"
    ((PASSED++))
fi

# ═══════════════════════════════════════════════════════════════
# STEP 3: Load to AWS S3
# ═══════════════════════════════════════════════════════════════
if $DO_S3; then
    echo ""
    log "STEP 2: Loading members → AWS S3..."
    echo "─────────────────────────────────────────────"
    S3_ARGS=""
    if $TEST_ONLY; then S3_ARGS="--test"; fi
    if [ -n "${S3_ENDPOINT_URL:-}" ]; then S3_ARGS="$S3_ARGS --endpoint $S3_ENDPOINT_URL"; fi
    S3_ARGS="$S3_ARGS --create-bucket"

    if python3 "$SCRIPT_DIR/scripts/load_s3.py" $S3_ARGS; then
        ok "S3 load complete"
        ((PASSED++))
    else
        fail "S3 load failed"
        ((FAILED++))
    fi
fi

# ═══════════════════════════════════════════════════════════════
# STEP 4: Load to BigQuery
# ═══════════════════════════════════════════════════════════════
if $DO_BQ; then
    echo ""
    log "STEP 3: Loading accounts → Google BigQuery..."
    echo "─────────────────────────────────────────────"
    BQ_ARGS="--file datasets/accounts.ndjson --create-dataset"
    if $TEST_ONLY; then BQ_ARGS="$BQ_ARGS --test"; fi
    if [ -n "${GCP_PROJECT_ID:-}" ]; then BQ_ARGS="$BQ_ARGS --project $GCP_PROJECT_ID"; fi

    if python3 "$SCRIPT_DIR/scripts/load_bigquery.py" $BQ_ARGS; then
        ok "BigQuery load complete"
        ((PASSED++))
    else
        fail "BigQuery load failed"
        ((FAILED++))
    fi
fi

# ═══════════════════════════════════════════════════════════════
# STEP 5: Stream to Kafka
# ═══════════════════════════════════════════════════════════════
if $DO_KAFKA; then
    echo ""
    log "STEP 4: Streaming transactions → Apache Kafka..."
    echo "─────────────────────────────────────────────"
    KAFKA_ARGS="--file datasets/transactions.jsonl --create-topic"
    if $TEST_ONLY; then KAFKA_ARGS="$KAFKA_ARGS --test"; fi
    if $DRY_RUN; then KAFKA_ARGS="$KAFKA_ARGS --dry-run"; fi

    if python3 "$SCRIPT_DIR/scripts/load_kafka.py" $KAFKA_ARGS; then
        ok "Kafka streaming complete"
        ((PASSED++))
    else
        fail "Kafka streaming failed"
        ((FAILED++))
    fi
fi

# ═══════════════════════════════════════════════════════════════
# STEP 6: Verify Ingestion
# ═══════════════════════════════════════════════════════════════
if $DO_VERIFY && ! $TEST_ONLY; then
    echo ""
    log "STEP 5: Verifying ingestion..."
    echo "─────────────────────────────────────────────"
    python3 "$SCRIPT_DIR/scripts/verify_ingestion.py" --all || true
fi

# ═══════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Results: ${GREEN}${PASSED} passed${NC}, ${RED}${FAILED} failed${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Data Pipeline Flow:"
echo "  ┌─────────────┐    ┌───────────────┐    ┌──────────────┐"
echo "  │  members.csv│───>│   AWS S3      │───>│              │"
echo "  │  (500 rows) │    │  Batch Load   │    │              │"
echo "  └─────────────┘    └───────────────┘    │              │"
echo "  ┌─────────────┐    ┌───────────────┐    │  Pinot Pulse │"
echo "  │accounts.json│───>│  BigQuery     │───>│  Enterprise  │"
echo "  │  (800 rows) │    │  Warehouse    │    │              │"
echo "  └─────────────┘    └───────────────┘    │  ┌────────┐  │"
echo "  ┌─────────────┐    ┌───────────────┐    │  │ Pinot  │  │"
echo "  │ txns.jsonl  │───>│  Kafka Topic  │───>│  │ Postgres│  │"
echo "  │ (5000 rows) │    │  Real-Time    │    │  └────────┘  │"
echo "  └─────────────┘    └───────────────┘    └──────────────┘"
echo ""

if [ $FAILED -gt 0 ]; then exit 1; fi
