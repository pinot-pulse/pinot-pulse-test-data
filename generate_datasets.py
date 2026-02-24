#!/usr/bin/env python3
"""
Pinot Pulse Enterprise — Test Data Generator
Generates 4 datasets matching canonical schemas:
  1. members.csv        → AWS S3 (batch ingestion)
  2. accounts.json      → Google BigQuery (warehouse sync)
  3. transactions JSONL  → Apache Kafka (real-time streaming)
  4. loans.json         → PostgreSQL analytics.loans (regulatory reporting)

Organization: Midwest Community Credit Union (MWCU)
  org_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
"""
import csv
import json
import random
import uuid
import os
from datetime import datetime, timedelta, timezone

# ═══ Constants ═══
ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
ORG_NAME = "Midwest Community Credit Union"
BRANCH_IDS = [
    "b0001000-0000-0000-0000-000000000001",  # Main Branch
    "b0001000-0000-0000-0000-000000000002",  # North Branch
    "b0001000-0000-0000-0000-000000000003",  # South Branch
]
NUM_MEMBERS = 500
NUM_ACCOUNTS = 800
NUM_LOANS = 350
NUM_TRANSACTIONS = 5000
BASE_DATE = datetime(2024, 1, 1, tzinfo=timezone.utc)
NOW = datetime(2026, 2, 20, 12, 0, 0, tzinfo=timezone.utc)

FIRST_NAMES = [
    "James","Mary","Robert","Patricia","John","Jennifer","Michael","Linda",
    "David","Elizabeth","William","Barbara","Richard","Susan","Joseph","Jessica",
    "Thomas","Sarah","Charles","Karen","Christopher","Lisa","Daniel","Nancy",
    "Matthew","Betty","Anthony","Margaret","Mark","Sandra","Donald","Ashley",
    "Steven","Kimberly","Paul","Emily","Andrew","Donna","Joshua","Michelle",
    "Kenneth","Carol","Kevin","Amanda","Brian","Dorothy","George","Melissa",
    "Timothy","Deborah","Ronald","Stephanie","Edward","Rebecca","Jason","Sharon",
    "Jeffrey","Laura","Ryan","Cynthia","Jacob","Kathleen","Gary","Amy",
    "Nicholas","Angela","Eric","Shirley","Jonathan","Anna","Stephen","Brenda",
    "Larry","Pamela","Justin","Emma","Scott","Nicole","Brandon","Helen",
    "Benjamin","Samantha","Samuel","Katherine","Raymond","Christine","Gregory","Debra",
]
LAST_NAMES = [
    "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis",
    "Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson",
    "Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson",
    "White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker",
    "Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill",
    "Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell",
    "Mitchell","Carter","Roberts","Gomez","Phillips","Evans","Turner","Diaz",
]
CITIES_TX = [
    ("Temple","TX","76501"),("Belton","TX","76513"),("Killeen","TX","76541"),
    ("Waco","TX","76701"),("Austin","TX","78701"),("Round Rock","TX","78664"),
    ("Georgetown","TX","78626"),("Copperas Cove","TX","76522"),
    ("Harker Heights","TX","76548"),("Salado","TX","76571"),
]
SEGMENTS = ["platinum","gold","silver","bronze","new"]
SEGMENT_WEIGHTS = [0.05, 0.15, 0.35, 0.30, 0.15]
STATUSES = ["active","active","active","active","active","active",
            "active","active","inactive","pending"]
EMPLOYMENT = ["employed","employed","employed","self_employed","retired","student"]

ACCOUNT_TYPES_DEPOSIT = [
    ("regular_share","deposit"),("share_draft","deposit"),
    ("money_market","deposit"),("certificate","deposit"),
    ("ira","deposit"),("club","deposit"),
]
ACCOUNT_TYPES_LOAN = [
    ("auto_loan","loan"),("first_mortgage","loan"),
    ("home_equity","loan"),("personal_loan","loan"),
    ("credit_card","credit"),("line_of_credit","credit"),
]
ACCT_STATUSES = ["active","active","active","active","active","closed","dormant"]

TXN_TYPES = [
    "deposit","withdrawal","transfer","payment","fee","interest",
    "ach_credit","ach_debit","card_purchase","card_refund",
    "atm_withdrawal","atm_deposit","loan_payment","dividend",
]
CHANNELS = ["branch","online","mobile","atm","phone","ach","pos","internal"]
MERCHANTS = [
    ("HEB Grocery","Grocery"),("Walmart","Retail"),("Amazon","E-Commerce"),
    ("Shell Gas","Fuel"),("Buc-ees","Convenience"),("Target","Retail"),
    ("Starbucks","Food & Drink"),("McDonalds","Food & Drink"),
    ("CVS Pharmacy","Health"),("AT&T","Telecom"),("Netflix","Entertainment"),
    ("Chick-fil-A","Food & Drink"),("Home Depot","Home Improvement"),
    ("Lowes","Home Improvement"),("USAA Insurance","Insurance"),
    ("State Farm","Insurance"),("Kroger","Grocery"),
]

LOAN_TYPES = [
    ("auto_new", "Auto Loan", "New Vehicle", "AUTO-N"),
    ("auto_used", "Auto Loan", "Used Vehicle", "AUTO-U"),
    ("first_mortgage_fixed", "First Mortgage", "Fixed Rate", "MORT-F"),
    ("first_mortgage_arm", "First Mortgage", "Adjustable Rate", "MORT-A"),
    ("home_equity", "Home Equity Loan", "Home Equity", "HEQ"),
    ("heloc", "HELOC", "Home Equity Line of Credit", "HELOC"),
    ("personal", "Personal Loan", "Unsecured", "PERS"),
    ("credit_card", "Credit Card", "Visa Platinum", "CC-P"),
    ("student", "Student Loan", "Education", "STUD"),
    ("commercial", "Commercial Loan", "Small Business", "COMM"),
]
LOAN_STATUSES = ["current", "current", "current", "current", "current",
                 "current", "delinquent_30", "delinquent_60", "paid_off", "charged_off"]
DELINQUENCY_MAP = {
    "current": (0, None), "delinquent_30": (30, "30_days"),
    "delinquent_60": (60, "60_days"), "delinquent_90": (90, "90_days"),
    "paid_off": (0, None), "charged_off": (120, "charged_off"),
}
COLLATERAL_TYPES = {
    "auto_new": "vehicle", "auto_used": "vehicle",
    "first_mortgage_fixed": "real_estate", "first_mortgage_arm": "real_estate",
    "home_equity": "real_estate", "heloc": "real_estate",
    "commercial": "business_assets",
}

def ts_millis(dt):
    return int(dt.timestamp() * 1000)

def rand_date(start, end):
    delta = end - start
    return start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))

# ═══════════════════════════════════════════════════════════════
# DATASET 1: MEMBERS (CSV for S3)
# ═══════════════════════════════════════════════════════════════
def generate_members():
    members = []
    for i in range(NUM_MEMBERS):
        city, state, zip_ = random.choice(CITIES_TX)
        seg = random.choices(SEGMENTS, SEGMENT_WEIGHTS)[0]
        join_date = rand_date(BASE_DATE - timedelta(days=3650), NOW - timedelta(days=30))

        # Credit scores vary by segment
        cs_ranges = {"platinum":(760,850),"gold":(700,780),"silver":(640,720),
                     "bronze":(580,660),"new":(620,750)}
        cs_min, cs_max = cs_ranges[seg]

        # Income varies by segment
        inc_ranges = {"platinum":(120000,350000),"gold":(80000,160000),
                      "silver":(45000,100000),"bronze":(28000,55000),
                      "new":(30000,80000)}
        inc_min, inc_max = inc_ranges[seg]

        dep = round(random.uniform(500, 500000 if seg=="platinum" else 50000), 2)
        loans = round(random.uniform(0, 400000 if seg in ("platinum","gold") else 50000), 2)

        m = {
            "member_id": str(uuid.uuid4()),
            "organization_id": ORG_ID,
            "branch_id": random.choice(BRANCH_IDS),
            "member_number": f"M{10000+i:06d}",
            "first_name": random.choice(FIRST_NAMES),
            "last_name": random.choice(LAST_NAMES),
            "email": f"member{10000+i}@example.com",
            "membership_status": random.choice(STATUSES),
            "segment": seg,
            "employment_status": random.choice(EMPLOYMENT),
            "city": city,
            "state": state,
            "postal_code": zip_,
            "credit_score": random.randint(cs_min, cs_max),
            "risk_score": round(random.uniform(0, 45 if seg in ("platinum","gold") else 80), 2),
            "total_deposits": dep,
            "total_loans": loans,
            "total_relationship_value": round(dep + loans, 2),
            "annual_income": round(random.uniform(inc_min, inc_max), 2),
            "membership_date": ts_millis(join_date),
            "created_at": ts_millis(join_date + timedelta(seconds=random.randint(0, 3600))),
        }
        members.append(m)
    return members


# ═══════════════════════════════════════════════════════════════
# DATASET 2: ACCOUNTS (JSON for BigQuery)
# ═══════════════════════════════════════════════════════════════
def generate_accounts(members):
    accounts = []
    member_ids = [m["member_id"] for m in members if m["membership_status"] == "active"]

    for i in range(NUM_ACCOUNTS):
        mid = random.choice(member_ids)
        member = next(m for m in members if m["member_id"] == mid)

        # 60% deposit, 40% loan/credit
        if random.random() < 0.60:
            atype, acat = random.choice(ACCOUNT_TYPES_DEPOSIT)
            bal = round(random.uniform(100, 250000), 2)
            avail = round(bal * random.uniform(0.85, 1.0), 2)
            rate = round(random.uniform(0.01, 5.25), 4)
        else:
            atype, acat = random.choice(ACCOUNT_TYPES_LOAN)
            bal = round(random.uniform(1000, 450000 if "mortgage" in atype else 50000), 2)
            avail = round(random.uniform(0, bal * 0.3), 2) if acat == "credit" else 0.0
            rate = round(random.uniform(3.5, 24.99 if acat == "credit" else 7.5), 4)

        opened = rand_date(
            datetime.fromtimestamp(member["membership_date"]/1000, tz=timezone.utc),
            NOW - timedelta(days=7)
        )
        last_act = rand_date(opened, NOW)

        a = {
            "account_id": str(uuid.uuid4()),
            "organization_id": ORG_ID,
            "member_id": mid,
            "branch_id": member["branch_id"],
            "account_number": f"{'S' if acat=='deposit' else 'L'}{20000+i:08d}",
            "account_type": atype,
            "account_category": acat,
            "status": random.choice(ACCT_STATUSES),
            "is_primary": i < NUM_MEMBERS,  # First account per member is primary
            "current_balance": bal,
            "available_balance": avail,
            "interest_rate": rate,
            "ytd_interest": round(bal * rate / 100 * random.uniform(0.1, 0.8), 2),
            "opened_date": ts_millis(opened),
            "last_activity_date": ts_millis(last_act),
        }
        accounts.append(a)
    return accounts


# ═══════════════════════════════════════════════════════════════
# DATASET 3: LOANS (JSON for PostgreSQL analytics.loans)
# ═══════════════════════════════════════════════════════════════
def generate_loans(members):
    loans = []
    active_members = [m for m in members if m["membership_status"] == "active"]

    for i in range(NUM_LOANS):
        member = random.choice(active_members)
        mid = member["member_id"]

        ltype, product_name, subtype, product_code = random.choice(LOAN_TYPES)
        status = random.choice(LOAN_STATUSES)
        dpd, delinquency_status = DELINQUENCY_MAP.get(status, (0, None))

        # Amount ranges by type
        if "mortgage" in ltype or ltype == "home_equity":
            original = round(random.uniform(80000, 500000), 2)
            rate = round(random.uniform(3.5, 7.5), 4)
            term = random.choice([180, 240, 360])
        elif "auto" in ltype:
            original = round(random.uniform(10000, 65000), 2)
            rate = round(random.uniform(3.9, 8.9), 4)
            term = random.choice([36, 48, 60, 72, 84])
        elif ltype == "heloc":
            original = round(random.uniform(20000, 250000), 2)
            rate = round(random.uniform(6.0, 10.5), 4)
            term = random.choice([120, 180, 240])
        elif ltype == "credit_card":
            original = round(random.uniform(1000, 25000), 2)
            rate = round(random.uniform(12.99, 24.99), 4)
            term = 0  # revolving
        elif ltype == "student":
            original = round(random.uniform(5000, 80000), 2)
            rate = round(random.uniform(4.5, 9.0), 4)
            term = random.choice([120, 180, 240])
        elif ltype == "commercial":
            original = round(random.uniform(25000, 500000), 2)
            rate = round(random.uniform(5.5, 12.0), 4)
            term = random.choice([60, 84, 120, 180])
        else:
            original = round(random.uniform(2000, 30000), 2)
            rate = round(random.uniform(7.0, 18.0), 4)
            term = random.choice([24, 36, 48, 60])

        origination = rand_date(
            datetime.fromtimestamp(member["membership_date"] / 1000, tz=timezone.utc),
            NOW - timedelta(days=60)
        )
        elapsed_months = max(1, int((NOW - origination).days / 30))
        remaining = max(0, term - elapsed_months) if term > 0 else 0

        # Current balance decays from original
        if status == "paid_off":
            current = 0.0
        elif term > 0:
            paydown_factor = max(0.05, 1.0 - (elapsed_months / term))
            current = round(original * paydown_factor * random.uniform(0.85, 1.05), 2)
        else:
            current = round(original * random.uniform(0.1, 0.95), 2)

        monthly_payment = round(original / max(term, 12) * (1 + rate / 1200), 2) if term > 0 else round(current * 0.02, 2)
        apr = round(rate + random.uniform(0.1, 0.5), 4)

        # Collateral
        coll_type = COLLATERAL_TYPES.get(ltype)
        coll_value = round(original * random.uniform(1.0, 1.5), 2) if coll_type else None
        ltv = round(original / coll_value * 100, 2) if coll_value else None

        maturity = origination + timedelta(days=term * 30) if term > 0 else None
        last_payment = rand_date(NOW - timedelta(days=60), NOW) if status != "paid_off" else origination + timedelta(days=elapsed_months * 30)
        next_payment = last_payment + timedelta(days=30) if status not in ("paid_off", "charged_off") else None

        loan = {
            "loan_id": str(uuid.uuid4()),
            "organization_id": ORG_ID,
            "member_id": mid,
            "branch_id": member["branch_id"],
            "loan_number": f"LN{30000 + i:08d}",
            "loan_type": ltype,
            "loan_subtype": subtype,
            "product_code": product_code,
            "product_name": product_name,
            "status": status,
            "original_amount": original,
            "current_balance": current,
            "monthly_payment": monthly_payment,
            "interest_rate": rate,
            "rate_type": "fixed" if "fixed" in ltype or ltype in ("auto_new", "auto_used", "personal", "student") else "variable",
            "apr": apr,
            "term_months": term,
            "remaining_months": remaining,
            "origination_date": ts_millis(origination),
            "maturity_date": ts_millis(maturity) if maturity else None,
            "next_payment_date": ts_millis(next_payment) if next_payment else None,
            "last_payment_date": ts_millis(last_payment),
            "days_past_due": dpd,
            "delinquency_status": delinquency_status,
            "collateral_type": coll_type,
            "collateral_value": coll_value,
            "ltv_ratio": ltv,
            "credit_score_at_origination": member["credit_score"],
            "dti_ratio": round(monthly_payment / (member["annual_income"] / 12) * 100, 2) if member["annual_income"] > 0 else None,
            "created_at": ts_millis(origination + timedelta(seconds=random.randint(0, 3600))),
        }
        loans.append(loan)
    return loans


# ═══════════════════════════════════════════════════════════════
# DATASET 4: TRANSACTIONS (JSONL for Kafka)
# ═══════════════════════════════════════════════════════════════
def generate_transactions(members, accounts):
    txns = []
    active_accounts = [a for a in accounts if a["status"] == "active"]
    member_map = {m["member_id"]: m for m in members}

    for i in range(NUM_TRANSACTIONS):
        acct = random.choice(active_accounts)
        mid = acct["member_id"]

        ttype = random.choice(TXN_TYPES)
        chan = random.choice(CHANNELS)

        # Amount ranges by type
        if ttype in ("deposit","ach_credit","atm_deposit","wire_in"):
            amt = round(random.uniform(25, 15000), 2)
        elif ttype in ("withdrawal","atm_withdrawal","ach_debit","wire_out"):
            amt = -round(random.uniform(20, 5000), 2)
        elif ttype in ("card_purchase","payment"):
            amt = -round(random.uniform(2.50, 2500), 2)
        elif ttype == "card_refund":
            amt = round(random.uniform(5, 500), 2)
        elif ttype == "loan_payment":
            amt = -round(random.uniform(100, 3500), 2)
        elif ttype == "loan_disbursement":
            amt = round(random.uniform(1000, 50000), 2)
        elif ttype == "interest":
            amt = round(random.uniform(0.01, 250), 2)
        elif ttype == "dividend":
            amt = round(random.uniform(0.50, 500), 2)
        elif ttype == "fee":
            amt = -round(random.uniform(5, 35), 2)
        else:
            amt = round(random.uniform(-5000, 5000), 2)
            if amt == 0: amt = 10.00

        bal_after = round(acct["current_balance"] + amt, 2)
        risk = round(random.uniform(0, 15), 2)

        # 2% suspicious transactions
        if random.random() < 0.02:
            risk = round(random.uniform(80, 99), 2)
            if ttype in ("deposit","ach_credit","wire_in"):
                amt = round(random.uniform(9000, 50000), 2)

        is_susp = risk >= 80.0

        # Merchant for card/pos transactions
        merch_name = ""
        merch_cat = ""
        if ttype in ("card_purchase","card_refund") or chan == "pos":
            m_name, m_cat = random.choice(MERCHANTS)
            merch_name = m_name
            merch_cat = m_cat

        txn_time = rand_date(NOW - timedelta(days=90), NOW)

        t = {
            "transaction_id": str(uuid.uuid4()),
            "organization_id": ORG_ID,
            "member_id": mid,
            "account_id": acct["account_id"],
            "branch_id": acct["branch_id"],
            "transaction_type": ttype,
            "channel": chan,
            "status": random.choices(
                ["completed","completed","completed","completed","pending","failed"],
                [0.85, 0.0, 0.0, 0.0, 0.10, 0.05]
            )[0],
            "description": f"{ttype.replace('_',' ').title()} via {chan}",
            "merchant_name": merch_name,
            "merchant_category": merch_cat,
            "amount": amt,
            "balance_after": bal_after,
            "risk_score": risk,
            "is_suspicious": is_susp,
            "timestamp": ts_millis(txn_time),
        }
        txns.append(t)

    # Sort by timestamp for realistic streaming order
    txns.sort(key=lambda x: x["timestamp"])
    return txns


# ═══════════════════════════════════════════════════════════════
# MAIN — Generate all datasets
# ═══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    out_dir = os.path.dirname(os.path.abspath(__file__))
    ds_dir = os.path.join(out_dir, "datasets")
    os.makedirs(ds_dir, exist_ok=True)

    print(f"═══ Pinot Pulse Enterprise — Test Data Generator ═══")
    print(f"Organization: {ORG_NAME}")
    print(f"Org ID: {ORG_ID}")
    print()

    # 1. Members
    print(f"Generating {NUM_MEMBERS} members...")
    members = generate_members()
    csv_path = os.path.join(ds_dir, "members.csv")
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=members[0].keys())
        w.writeheader()
        w.writerows(members)
    print(f"  ✓ {csv_path} ({os.path.getsize(csv_path):,} bytes)")

    # Also write as JSON for flexibility
    json_path = os.path.join(ds_dir, "members.json")
    with open(json_path, "w") as f:
        json.dump(members, f, indent=2)

    # 2. Accounts
    print(f"Generating {NUM_ACCOUNTS} accounts...")
    accounts = generate_accounts(members)
    # NDJSON for BigQuery native load
    ndjson_path = os.path.join(ds_dir, "accounts.ndjson")
    with open(ndjson_path, "w") as f:
        for a in accounts:
            f.write(json.dumps(a) + "\n")
    print(f"  ✓ {ndjson_path} ({os.path.getsize(ndjson_path):,} bytes)")

    # Also regular JSON
    json_path2 = os.path.join(ds_dir, "accounts.json")
    with open(json_path2, "w") as f:
        json.dump(accounts, f, indent=2)

    # 3. Loans
    print(f"Generating {NUM_LOANS} loans...")
    loans = generate_loans(members)
    loans_json_path = os.path.join(ds_dir, "loans.json")
    with open(loans_json_path, "w") as f:
        json.dump(loans, f, indent=2)
    print(f"  ✓ {loans_json_path} ({os.path.getsize(loans_json_path):,} bytes)")

    # Also NDJSON for flexibility
    loans_ndjson_path = os.path.join(ds_dir, "loans.ndjson")
    with open(loans_ndjson_path, "w") as f:
        for loan in loans:
            f.write(json.dumps(loan) + "\n")

    # 4. Transactions
    print(f"Generating {NUM_TRANSACTIONS} transactions...")
    transactions = generate_transactions(members, accounts)
    # JSONL for Kafka (one event per line)
    jsonl_path = os.path.join(ds_dir, "transactions.jsonl")
    with open(jsonl_path, "w") as f:
        for t in transactions:
            f.write(json.dumps(t) + "\n")
    print(f"  ✓ {jsonl_path} ({os.path.getsize(jsonl_path):,} bytes)")

    # Summary stats
    print()
    print("═══ Dataset Summary ═══")
    print(f"  Members:      {len(members):>6,} records  → members.csv (S3)")
    print(f"  Accounts:     {len(accounts):>6,} records  → accounts.ndjson (BigQuery)")
    print(f"  Loans:        {len(loans):>6,} records  → loans.json (PostgreSQL)")
    print(f"  Transactions: {len(transactions):>6,} records  → transactions.jsonl (Kafka)")
    active_m = sum(1 for m in members if m["membership_status"] == "active")
    active_a = sum(1 for a in accounts if a["status"] == "active")
    current_l = sum(1 for l in loans if l["status"] == "current")
    delinquent_l = sum(1 for l in loans if l["days_past_due"] > 0)
    susp_t = sum(1 for t in transactions if t["is_suspicious"])
    total_dep = sum(m["total_deposits"] for m in members)
    total_loan = sum(m["total_loans"] for m in members)
    total_loan_bal = sum(l["current_balance"] for l in loans)
    print(f"  Active members:      {active_m}")
    print(f"  Active accounts:     {active_a}")
    print(f"  Current loans:       {current_l}")
    print(f"  Delinquent loans:    {delinquent_l}")
    print(f"  Suspicious txns:     {susp_t}")
    print(f"  Total deposits:      ${total_dep:,.2f}")
    print(f"  Total member loans:  ${total_loan:,.2f}")
    print(f"  Total loan balances: ${total_loan_bal:,.2f}")
    print()
    print("  S3 target:        s3://pinot-pulse-data/members/members.csv")
    print("  BigQuery target:  pinot_pulse.raw.accounts")
    print("  PostgreSQL:       analytics.loans")
    print("  Kafka topic:      pinot-pulse.transactions")
    print()

    # Write metadata
    meta = {
        "organization_id": ORG_ID,
        "organization_name": ORG_NAME,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "datasets": {
            "members": {"file": "members.csv", "records": len(members), "target": "s3"},
            "accounts": {"file": "accounts.ndjson", "records": len(accounts), "target": "bigquery"},
            "loans": {"file": "loans.json", "records": len(loans), "target": "postgresql"},
            "transactions": {"file": "transactions.jsonl", "records": len(transactions), "target": "kafka"},
        },
        "branch_ids": BRANCH_IDS,
    }
    meta_path = os.path.join(ds_dir, "metadata.json")
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"  Metadata: {meta_path}")
    print("  Done!")
