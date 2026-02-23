#!/usr/bin/env python3
"""
Pinot Pulse Enterprise — PostgreSQL Data Loader
Loads Midwest Community Credit Union as a fully separated tenant
with organization, branches, users, members, accounts, and transactions.

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

        # ─── Transactions ───
        print("\n[8/8] Loading transactions...")
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

        # ─── Summary ───
        print(f"\n═══ PostgreSQL Tenant Load Complete ═══")
        print(f"  Organization: {ORG_NAME}")
        print(f"  Branches:     {len(BRANCHES)}")
        print(f"  Roles:        {len(ROLES)}")
        print(f"  Users:        {len(USERS)}")
        print(f"  Members:      {member_count}")
        print(f"  Accounts:     {acct_count}")
        print(f"  Transactions: {txn_count}")
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
