#!/usr/bin/env python3
"""
Pinot Pulse Enterprise — PostgreSQL Data Loader
Loads Midwest Community Credit Union as a fully separated tenant
with organization, branches, users, members, accounts, loans,
transactions, dashboard snapshots, fraud alerts, and regulatory config.

Usage:
  python3 load_postgres.py                          # Uses defaults
  python3 load_postgres.py --host localhost --port 5433
  python3 load_postgres.py --test                   # Connection test only

Login after loading:
  URL:      http://localhost:3000/auth
  Email:    admin@mccu.org
  Password: password123
"""
import argparse
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

def main():
    parser = argparse.ArgumentParser(description="Load MCCU tenant data into PostgreSQL")
    parser.add_argument("--host", default=os.getenv("POSTGRES_HOST", "localhost"))
    parser.add_argument("--port", type=int, default=int(os.getenv("POSTGRES_PORT", "5433")))
    parser.add_argument("--user", default=os.getenv("POSTGRES_USER", "pinot_pulse"))
    parser.add_argument("--password", default=os.getenv("POSTGRES_PASSWORD", "pulse_secure_2024"))
    parser.add_argument("--database", default=os.getenv("POSTGRES_DB", "pinot_pulse"))
    parser.add_argument("--test", action="store_true", help="Connection test only")
    args = parser.parse_args()

    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)

    ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    ORG_NAME = "Midwest Community Credit Union"
    ORG_SLUG = "mccu"
    PASSWORD_HASH = "$2b$12$4fQBy.ApQEmCEj0x8rzpCekei5/nt3fgVq1pD/t4hBaEZVA5mC.sa"

    BRANCHES = [
        ("b0001000-0000-0000-0000-000000000001", "Main Branch", "BR001", "main", True),
        ("b0001000-0000-0000-0000-000000000002", "East Branch", "BR002", "full_service", False),
        ("b0001000-0000-0000-0000-000000000003", "West Branch", "BR003", "full_service", False),
    ]

    # Org-specific roles (strict tenant isolation)
    ROLES = [
        ("a1b2c3d4-0000-0000-0002-000000000001", "admin", "Organization Admin",
         "Full organizational access", '["*"]'),
        ("a1b2c3d4-0000-0000-0002-000000000002", "risk_manager", "Risk Manager",
         "Risk and compliance management", '["analytics:read", "risk:*", "compliance:*", "fraud:*"]'),
        ("a1b2c3d4-0000-0000-0002-000000000003", "analyst", "Data Analyst",
         "Analytics and reporting", '["analytics:read", "reports:*", "members:read", "fraud:read", "risk:read"]'),
        ("a1b2c3d4-0000-0000-0002-000000000004", "compliance_officer", "Compliance Officer",
         "Regulatory compliance", '["compliance:*", "reports:read", "members:read"]'),
        ("a1b2c3d4-0000-0000-0002-000000000005", "viewer", "Read-Only User",
         "Read-only access", '["analytics:read", "reports:read"]'),
        ("a1b2c3d4-0000-0000-0002-000000000006", "platform_admin", "Platform Administrator",
         "Platform operations", '["admin:*", "system:*", "integrations:*", "audit:*"]'),
        ("a1b2c3d4-0000-0000-0002-000000000007", "pinot_admin", "Pinot Admin",
         "Analytics engine configuration", '["pinot:*", "analytics:*", "services:pinot", "schemas:*", "tables:*", "queries:*"]'),
        ("a1b2c3d4-0000-0000-0002-000000000008", "super_user", "Super User",
         "Advanced operational oversight", '["analytics:read", "reports:*", "fraud:*", "risk:*", "compliance:read", "services:read", "members:read", "audit:read"]'),
    ]

    USERS = [
        ("a1b2c3d4-0000-0000-0003-000000000001", "admin@mccu.org", "Sarah", "Mitchell",
         "Organization Administrator", "Executive", "a1b2c3d4-0000-0000-0002-000000000001"),
        ("a1b2c3d4-0000-0000-0003-000000000002", "cfo@mccu.org", "Robert", "Kim",
         "Chief Financial Officer", "Finance", "a1b2c3d4-0000-0000-0002-000000000002"),
        ("a1b2c3d4-0000-0000-0003-000000000003", "analyst@mccu.org", "Maria", "Garcia",
         "Senior Data Analyst", "Analytics", "a1b2c3d4-0000-0000-0002-000000000003"),
        ("a1b2c3d4-0000-0000-0003-000000000004", "viewer@mccu.org", "Tom", "Baker",
         "Board Member", "Board", "a1b2c3d4-0000-0000-0002-000000000005"),
    ]

    print("═══ Pinot Pulse — PostgreSQL Tenant Loader ═══")
    print(f"  Host:     {args.host}:{args.port}")
    print(f"  Database: {args.database}")
    print(f"  Org:      {ORG_NAME} ({ORG_SLUG})")

    # ─── Connect ───
    print("\n[1/8] Connecting to PostgreSQL...")
    try:
        conn = psycopg2.connect(
            host=args.host, port=args.port,
            user=args.user, password=args.password,
            database=args.database
        )
        conn.autocommit = False
        cur = conn.cursor()
        print("  ✓ Connected")
    except Exception as e:
        print(f"  ✗ Connection failed: {e}")
        sys.exit(1)

    if args.test:
        cur.execute("SELECT COUNT(*) FROM tenants.organizations")
        count = cur.fetchone()[0]
        print(f"  Found {count} organizations")
        conn.close()
        print("  Connection test passed.")
        return

    try:
        # ─── Organization ───
        print("\n[2/8] Creating organization...")
        cur.execute("""
            INSERT INTO tenants.organizations (id, name, slug, display_name,
                institution_type, status, subscription_tier, asset_size,
                timezone, fiscal_year_end_month, onboarding_completed)
            VALUES (%s, %s, %s, %s, 'credit_union', 'active', 'enterprise',
                    'medium', 'America/Chicago', 12, true)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        """, (ORG_ID, ORG_NAME, ORG_SLUG, ORG_NAME))
        print(f"  ✓ Organization '{ORG_NAME}' created")

        # ─── Branches ───
        print("\n[3/8] Creating branches...")
        for bid, bname, bcode, btype, is_main in BRANCHES:
            cur.execute("""
                INSERT INTO tenants.branches (id, organization_id, name, branch_code,
                    branch_type, is_main, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, true)
                ON CONFLICT (id) DO NOTHING
            """, (bid, ORG_ID, bname, bcode, btype, is_main))
            print(f"  ✓ Branch: {bname} ({bcode})")

        # ─── Roles (org-specific for strict tenant isolation) ───
        print("\n[4/8] Creating org-specific roles...")
        for rid, rname, rdisplay, rdesc, rperms in ROLES:
            cur.execute("""
                INSERT INTO auth.roles (id, organization_id, name, display_name,
                    description, permissions, is_system_role, is_active)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb, false, true)
                ON CONFLICT (organization_id, name) DO NOTHING
            """, (rid, ORG_ID, rname, rdisplay, rdesc, rperms))
            print(f"  ✓ Role: {rdisplay} ({rname})")

        # ─── Users ───
        print("\n[5/8] Creating users...")
        for uid, email, fname, lname, title, dept, role_id in USERS:
            cur.execute("""
                INSERT INTO auth.users (id, organization_id, email, password_hash,
                    first_name, last_name, job_title, department,
                    status, is_active, is_email_verified)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                        'active', true, true)
                ON CONFLICT (id) DO NOTHING
            """, (uid, ORG_ID, email, PASSWORD_HASH, fname, lname, title, dept))
            # Assign role
            cur.execute("""
                INSERT INTO auth.user_roles (id, user_id, role_id)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, role_id) DO NOTHING
            """, (str(uuid.uuid4()), uid, role_id))
            print(f"  ✓ User: {email} ({title})")

        conn.commit()

        # ─── Members ───
        print("\n[6/8] Loading members...")
        script_dir = os.path.dirname(os.path.abspath(__file__))
        members_file = os.path.join(script_dir, "..", "datasets", "members.json")
        if not os.path.exists(members_file):
            members_file = os.path.join(script_dir, "datasets", "members.json")

        with open(members_file, "r") as f:
            members = json.load(f)

        member_count = 0
        for m in members:
            cur.execute("""
                INSERT INTO analytics.members (
                    id, organization_id, branch_id, member_number,
                    first_name, last_name, email, membership_status, segment,
                    employment_status, city, state, postal_code,
                    credit_score, risk_score, total_deposits, total_loans,
                    total_relationship_value, annual_income,
                    membership_date, created_at, is_active
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    to_timestamp(%s::double precision / 1000),
                    to_timestamp(%s::double precision / 1000),
                    true
                ) ON CONFLICT (id) DO NOTHING
            """, (
                m["member_id"], m["organization_id"],
                m.get("branch_id"), m["member_number"],
                m["first_name"], m["last_name"], m.get("email"),
                m["membership_status"], m.get("segment"),
                m.get("employment_status"), m.get("city"), m.get("state"),
                m.get("postal_code"),
                m.get("credit_score"), m.get("risk_score"),
                m.get("total_deposits"), m.get("total_loans"),
                m.get("total_relationship_value"), m.get("annual_income"),
                m.get("membership_date"), m.get("created_at")
            ))
            member_count += 1
            if member_count % 100 == 0:
                print(f"    Inserted {member_count}/{len(members)} members...")

        conn.commit()
        print(f"  ✓ {member_count} members loaded")

        # ─── Accounts ───
        print("\n[7/8] Loading accounts...")
        accounts_file = os.path.join(script_dir, "..", "datasets", "accounts.ndjson")
        if not os.path.exists(accounts_file):
            accounts_file = os.path.join(script_dir, "datasets", "accounts.ndjson")

        accounts = []
        with open(accounts_file, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    accounts.append(json.loads(line))

        acct_count = 0
        for a in accounts:
            cur.execute("""
                INSERT INTO analytics.accounts (
                    id, organization_id, member_id, branch_id,
                    account_number, account_type, account_category, status,
                    is_primary, current_balance, available_balance,
                    interest_rate, interest_ytd,
                    opened_date, last_activity_date
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    to_timestamp(%s::double precision / 1000),
                    to_timestamp(%s::double precision / 1000)
                ) ON CONFLICT (id) DO NOTHING
            """, (
                a["account_id"], a["organization_id"],
                a["member_id"], a.get("branch_id"),
                a["account_number"], a["account_type"],
                a.get("account_category"), a["status"],
                a.get("is_primary", False),
                a["current_balance"], a.get("available_balance"),
                a.get("interest_rate"), a.get("ytd_interest"),
                a.get("opened_date"), a.get("last_activity_date")
            ))
            acct_count += 1
            if acct_count % 200 == 0:
                print(f"    Inserted {acct_count}/{len(accounts)} accounts...")

        conn.commit()
        print(f"  ✓ {acct_count} accounts loaded")

        # ─── Loans ───
        print("\n[8/13] Loading loans...")
        loans_file = os.path.join(script_dir, "..", "datasets", "loans.json")
        if not os.path.exists(loans_file):
            loans_file = os.path.join(script_dir, "datasets", "loans.json")

        loan_count = 0
        if os.path.exists(loans_file):
            with open(loans_file, "r") as f:
                loans = json.load(f)

            for ln in loans:
                cur.execute("""
                    INSERT INTO analytics.loans (
                        id, organization_id, member_id, branch_id,
                        loan_number, loan_type, loan_subtype,
                        product_code, product_name, status,
                        original_amount, current_balance, monthly_payment,
                        interest_rate, rate_type, apr,
                        term_months, remaining_months,
                        origination_date, maturity_date,
                        next_payment_date, last_payment_date,
                        days_past_due, delinquency_status,
                        collateral_type, collateral_value, ltv_ratio,
                        credit_score_at_origination, dti_ratio
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s,
                        to_timestamp(%s::double precision / 1000),
                        to_timestamp(%s::double precision / 1000),
                        to_timestamp(%s::double precision / 1000),
                        to_timestamp(%s::double precision / 1000),
                        %s, %s, %s, %s, %s, %s, %s
                    ) ON CONFLICT (id) DO NOTHING
                """, (
                    ln["loan_id"], ln["organization_id"],
                    ln["member_id"], ln.get("branch_id"),
                    ln["loan_number"], ln["loan_type"], ln.get("loan_subtype"),
                    ln.get("product_code"), ln.get("product_name"), ln["status"],
                    ln["original_amount"], ln["current_balance"], ln.get("monthly_payment"),
                    ln["interest_rate"], ln.get("rate_type"), ln.get("apr"),
                    ln.get("term_months"), ln.get("remaining_months"),
                    ln.get("origination_date"), ln.get("maturity_date"),
                    ln.get("next_payment_date"), ln.get("last_payment_date"),
                    ln.get("days_past_due", 0), ln.get("delinquency_status"),
                    ln.get("collateral_type"), ln.get("collateral_value"),
                    ln.get("ltv_ratio"),
                    ln.get("credit_score_at_origination"), ln.get("dti_ratio"),
                ))
                loan_count += 1
                if loan_count % 100 == 0:
                    print(f"    Inserted {loan_count}/{len(loans)} loans...")

            conn.commit()
            print(f"  ✓ {loan_count} loans loaded")
        else:
            print("  ⚠ loans.json not found — run generate_datasets.py first")

        # ─── Transactions ───
        print("\n[9/13] Loading transactions...")
        txn_file = os.path.join(script_dir, "..", "datasets", "transactions.jsonl")
        if not os.path.exists(txn_file):
            txn_file = os.path.join(script_dir, "datasets", "transactions.jsonl")

        txn_count = 0
        with open(txn_file, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                t = json.loads(line)
                cur.execute("""
                    INSERT INTO analytics.transactions (
                        id, organization_id, member_id, account_id, branch_id,
                        transaction_type, channel, status,
                        description, merchant_name, merchant_category,
                        amount, balance_after, risk_score, is_suspicious,
                        transaction_date, timestamp
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        to_timestamp(%s::double precision / 1000),
                        to_timestamp(%s::double precision / 1000)
                    ) ON CONFLICT (id) DO NOTHING
                """, (
                    t["transaction_id"], t["organization_id"],
                    t["member_id"], t.get("account_id"), t.get("branch_id"),
                    t["transaction_type"], t.get("channel"), t["status"],
                    t.get("description"), t.get("merchant_name"),
                    t.get("merchant_category"),
                    t["amount"], t.get("balance_after"),
                    t.get("risk_score"), t.get("is_suspicious", False),
                    t["timestamp"], t["timestamp"]
                ))
                txn_count += 1
                if txn_count % 1000 == 0:
                    print(f"    Inserted {txn_count} transactions...")
                    conn.commit()

        conn.commit()
        print(f"  ✓ {txn_count} transactions loaded")

        # ─── Dashboard Snapshots ───
        print("\n[10/13] Seeding dashboard snapshots...")
        snapshot_count = 0
        base_assets = 450_000_000
        for month_offset in range(12):
            snap_date = (datetime(2025, 3, 1, tzinfo=timezone.utc)
                         + timedelta(days=month_offset * 30))
            growth = 1.0 + month_offset * 0.008
            cur.execute("""
                INSERT INTO analytics.dashboard_snapshots (
                    id, organization_id, snapshot_date,
                    total_assets, total_deposits, total_loans, total_members,
                    net_worth, net_worth_ratio, share_savings, share_checking,
                    money_market, certificates, ira_accounts,
                    auto_loans, mortgage_loans, personal_loans, credit_cards,
                    loan_to_share, delinquency_rate, charge_off_rate,
                    roa, roe, efficiency_ratio,
                    member_growth_rate, deposit_growth_rate, loan_growth_rate,
                    total_investments, total_borrowings, net_interest_income,
                    net_interest_margin, net_income, capital_ratio, liquidity_ratio
                ) VALUES (
                    %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s
                ) ON CONFLICT (id) DO NOTHING
            """, (
                str(uuid.uuid4()), ORG_ID, snap_date.date(),
                round(base_assets * growth, 2),
                round(base_assets * growth * 0.75, 2),
                round(base_assets * growth * 0.62, 2),
                int(500 + month_offset * 12),
                round(base_assets * growth * 0.11, 2),
                round(0.11 + month_offset * 0.001, 4),
                round(base_assets * growth * 0.22, 2),
                round(base_assets * growth * 0.18, 2),
                round(base_assets * growth * 0.12, 2),
                round(base_assets * growth * 0.15, 2),
                round(base_assets * growth * 0.08, 2),
                round(base_assets * growth * 0.12, 2),
                round(base_assets * growth * 0.28, 2),
                round(base_assets * growth * 0.08, 2),
                round(base_assets * growth * 0.05, 2),
                round(0.82 + month_offset * 0.002, 4),
                round(0.0045 - month_offset * 0.0001, 4),
                round(0.0012, 4),
                round(0.0089 + month_offset * 0.0002, 4),
                round(0.082 + month_offset * 0.001, 4),
                round(0.72 - month_offset * 0.003, 4),
                round(0.025 + month_offset * 0.001, 4),
                round(0.028, 4),
                round(0.032, 4),
                round(base_assets * growth * 0.15, 2),
                round(base_assets * growth * 0.05, 2),
                round(base_assets * growth * 0.025, 2),
                round(0.032, 4),
                round(base_assets * growth * 0.008, 2),
                round(0.11 + month_offset * 0.001, 4),
                round(0.18 - month_offset * 0.002, 4),
            ))
            snapshot_count += 1
        conn.commit()
        print(f"  ✓ {snapshot_count} dashboard snapshots seeded (12 months)")

        # ─── Fraud Alerts ───
        print("\n[11/13] Seeding fraud alerts...")
        alert_types = ["card_not_present", "card_present", "atm_withdrawal",
                       "wire_transfer", "ach_anomaly", "velocity_check"]
        severities = ["critical", "high", "medium", "low"]
        alert_count = 0
        for i in range(25):
            cur.execute("""
                INSERT INTO analytics.fraud_alerts (
                    id, organization_id, member_id,
                    alert_type, severity, risk_score, status,
                    title, description, detected_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW() - interval '%s days'
                ) ON CONFLICT (id) DO NOTHING
            """, (
                str(uuid.uuid4()), ORG_ID,
                members[i % len(members)]["member_id"],
                alert_types[i % len(alert_types)],
                severities[i % len(severities)],
                round(65 + i * 1.4, 2),
                "open" if i < 10 else ("investigating" if i < 18 else "resolved"),
                f"Suspicious {alert_types[i % len(alert_types)].replace('_', ' ')} detected",
                f"Automated alert for unusual {alert_types[i % len(alert_types)].replace('_', ' ')} activity",
                i * 3,
            ))
            alert_count += 1
        conn.commit()
        print(f"  ✓ {alert_count} fraud alerts seeded")

        # ─── Regulatory Config (Filing Records) ───
        print("\n[12/13] Seeding regulatory filing records...")
        reg_count = 0
        filing_configs = [
            ("ncua_5300", "Q4 2025", "NCUA", "accepted", "NCUA-2025-Q4-001"),
            ("ncua_5300", "Q1 2026", "NCUA", "draft", None),
            ("bsa_sar", "2025-12", "FinCEN", "submitted", "FINCEN-SAR-2025-042"),
            ("bsa_ctr", "2025-11", "FinCEN", "accepted", "FINCEN-CTR-2025-118"),
            ("hmda_lar", "2025-Annual", "CFPB", "submitted", "CFPB-HMDA-2025-001"),
        ]
        for report_type, period, agency, status, conf_num in filing_configs:
            cur.execute("""
                INSERT INTO regulatory.filing_records (
                    id, organization_id, report_type, period, agency,
                    status, required_approvals, current_approvals,
                    validation_passed, confirmation_number, created_by
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, 2,
                    CASE WHEN %s IN ('submitted','accepted','acknowledged') THEN 2 ELSE 0 END,
                    CASE WHEN %s IN ('submitted','accepted','acknowledged') THEN true ELSE NULL END,
                    %s, 'system-seed'
                ) ON CONFLICT (id) DO NOTHING
            """, (
                str(uuid.uuid4()), ORG_ID, report_type, period, agency,
                status, status, status, conf_num,
            ))
            reg_count += 1
        conn.commit()
        print(f"  ✓ {reg_count} regulatory filing records seeded")

        # ─── Report Generations ───
        print("\n[13/13] Seeding report generation records...")
        report_count = 0
        report_configs = [
            ("ncua-5300", "NCUA 5300 Call Report — Q4 2025", "regulatory", "regulatory"),
            ("ncua-5300", "NCUA 5300 Call Report — Q1 2026", "regulatory", "regulatory"),
            ("bsa-sar", "BSA/AML SAR Monthly — Dec 2025", "regulatory", "compliance"),
            ("bsa-ctr", "BSA/AML CTR Summary — Nov 2025", "regulatory", "compliance"),
            ("hmda-lar", "HMDA LAR Annual — 2025", "regulatory", "compliance"),
            ("executive-summary", "Executive Dashboard Summary", "operational", "executive"),
            ("delinquency", "Delinquency Report Q4 2025", "analytical", "risk"),
        ]
        for rkey, rname, rtype, rcat in report_configs:
            cur.execute("""
                INSERT INTO analytics.report_generations (
                    id, organization_id, report_key, report_name,
                    report_type, category, status, records_processed,
                    format, generated_by
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, 'completed', %s,
                    'json', 'system-seed'
                ) ON CONFLICT (id) DO NOTHING
            """, (
                str(uuid.uuid4()), ORG_ID, rkey, rname, rtype, rcat,
                500 + report_count * 100,
            ))
            report_count += 1
        conn.commit()
        print(f"  ✓ {report_count} report generation records seeded")

        # ─── Summary ───
        print(f"\n═══ PostgreSQL Tenant Load Complete ═══")
        print(f"  Organization:        {ORG_NAME}")
        print(f"  Branches:            {len(BRANCHES)}")
        print(f"  Roles:               {len(ROLES)}")
        print(f"  Users:               {len(USERS)}")
        print(f"  Members:             {member_count}")
        print(f"  Accounts:            {acct_count}")
        print(f"  Loans:               {loan_count}")
        print(f"  Transactions:        {txn_count}")
        print(f"  Dashboard Snapshots: {snapshot_count}")
        print(f"  Fraud Alerts:        {alert_count}")
        print(f"  Regulatory Filings:  {reg_count}")
        print(f"  Report Generations:  {report_count}")
        print()
        print("  Login at http://localhost:3000/auth")
        print("  ┌──────────────────────────────────────────┐")
        print("  │  Email:    admin@mccu.org                 │")
        print("  │  Password: password123                    │")
        print("  └──────────────────────────────────────────┘")
        print()
        print("  Other users:")
        for uid, email, fname, lname, title, dept, rid in USERS:
            print(f"    {email:25s}  {title}")

    except Exception as e:
        conn.rollback()
        print(f"\n  ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
