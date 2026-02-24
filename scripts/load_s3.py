#!/usr/bin/env python3
"""
Pinot Pulse Enterprise — S3 Data Loader
Uploads members.csv to AWS S3 bucket for batch ingestion.

Usage:
  python3 load_s3.py                          # Uses env vars
  python3 load_s3.py --bucket my-bucket       # Override bucket
  python3 load_s3.py --test                   # Connection test only
  python3 load_s3.py --endpoint http://localhost:4566  # LocalStack

Required env vars (or pass as args):
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AWS_DEFAULT_REGION (default: us-east-1)
  S3_BUCKET (default: pinot-pulse-data)
"""
import argparse
import json
import os
import sys
import time

def main():
    parser = argparse.ArgumentParser(description="Upload members dataset to S3")
    parser.add_argument("--bucket", default=os.getenv("S3_BUCKET", "pinot-pulse-data"))
    parser.add_argument("--prefix", default="members/")
    parser.add_argument("--region", default=os.getenv("AWS_DEFAULT_REGION", "us-east-1"))
    parser.add_argument("--endpoint", default=os.getenv("S3_ENDPOINT_URL", "http://pinotpusle.s3-website.us-east-1.amazonaws.com"),
                        help="Custom endpoint (LocalStack, MinIO)")
    parser.add_argument("--access-key", default=os.getenv("AWS_ACCESS_KEY_ID", ""))
    parser.add_argument("--secret-key", default=os.getenv("AWS_SECRET_ACCESS_KEY", ""))
    parser.add_argument("--file", default="datasets/members.csv")
    parser.add_argument("--test", action="store_true", help="Test connection only")
    parser.add_argument("--create-bucket", action="store_true", help="Create bucket if missing")
    args = parser.parse_args()

    try:
        import boto3
        from botocore.exceptions import ClientError, NoCredentialsError
    except ImportError:
        print("ERROR: boto3 not installed. Run: pip install boto3")
        sys.exit(1)

    print("═══ Pinot Pulse — S3 Data Loader ═══")
    print(f"  Bucket:   {args.bucket}")
    print(f"  Prefix:   {args.prefix}")
    print(f"  Region:   {args.region}")
    if args.endpoint:
        print(f"  Endpoint: {args.endpoint}")

    # Build session
    session_kwargs = {"region_name": args.region}
    if args.access_key:
        session_kwargs["aws_access_key_id"] = args.access_key
        session_kwargs["aws_secret_access_key"] = args.secret_key

    session = boto3.Session(**session_kwargs)
    client_kwargs = {}
    if args.endpoint:
        client_kwargs["endpoint_url"] = args.endpoint

    s3 = session.client("s3", **client_kwargs)

    # ─── Connection Test ───
    print("\n[1/4] Testing S3 connection...")
    try:
        s3.list_buckets()
        print("  ✓ S3 connection successful")
    except NoCredentialsError:
        print("  ✗ No AWS credentials found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY")
        sys.exit(1)
    except Exception as e:
        print(f"  ✗ S3 connection failed: {e}")
        sys.exit(1)

    # ─── Bucket Check ───
    print("\n[2/4] Checking bucket...")
    try:
        s3.head_bucket(Bucket=args.bucket)
        print(f"  ✓ Bucket '{args.bucket}' exists")
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "404" and args.create_bucket:
            print(f"  Creating bucket '{args.bucket}'...")
            create_kwargs = {"Bucket": args.bucket}
            if args.region != "us-east-1":
                create_kwargs["CreateBucketConfiguration"] = {
                    "LocationConstraint": args.region
                }
            s3.create_bucket(**create_kwargs)
            print(f"  ✓ Bucket created")
        elif code == "404":
            print(f"  ✗ Bucket '{args.bucket}' not found. Use --create-bucket to create it.")
            sys.exit(1)
        else:
            print(f"  ✗ Bucket error: {e}")
            sys.exit(1)

    if args.test:
        print("\n  Connection test passed. Use without --test to upload data.")
        return

    # ─── Upload Files ───
    print("\n[3/4] Uploading data files...")
    script_dir = os.path.dirname(os.path.abspath(__file__))

    files_to_upload = [
        (os.path.join(script_dir, "datasets/members.csv"), f"{args.prefix}members.csv"),
        (os.path.join(script_dir, "datasets/members.json"), f"{args.prefix}members.json"),
        (os.path.join(script_dir, "datasets/loans.json"), f"loans/loans.json"),
        (os.path.join(script_dir, "datasets/loans.ndjson"), f"loans/loans.ndjson"),
        (os.path.join(script_dir, "datasets/metadata.json"), f"{args.prefix}metadata.json"),
    ]

    uploaded = 0
    for local_path, s3_key in files_to_upload:
        if not os.path.exists(local_path):
            print(f"  ⚠ Skipping {local_path} (not found)")
            continue
        size = os.path.getsize(local_path)
        print(f"  Uploading {s3_key} ({size:,} bytes)...", end=" ")
        start = time.time()
        s3.upload_file(
            local_path, args.bucket, s3_key,
            ExtraArgs={"ContentType": "text/csv" if s3_key.endswith(".csv") else "application/json"}
        )
        elapsed = time.time() - start
        print(f"✓ ({elapsed:.1f}s)")
        uploaded += 1

    # ─── Verify ───
    print(f"\n[4/4] Verifying uploads...")
    response = s3.list_objects_v2(Bucket=args.bucket, Prefix=args.prefix)
    objects = response.get("Contents", [])
    print(f"  Found {len(objects)} objects in s3://{args.bucket}/{args.prefix}")
    for obj in objects:
        print(f"    {obj['Key']}  ({obj['Size']:,} bytes)")

    print(f"\n═══ S3 Upload Complete ═══")
    print(f"  Files uploaded: {uploaded}")
    print(f"  S3 path: s3://{args.bucket}/{args.prefix}")
    print()
    print("  Pinot Pulse will ingest via the S3Consumer batch pipeline.")
    print("  Pipeline config: ingestion/batch/file-transactions.yaml")
    print("  Trigger via API: POST /api/v1/ingestion/pipelines/batch-s3-members/start")


if __name__ == "__main__":
    main()
