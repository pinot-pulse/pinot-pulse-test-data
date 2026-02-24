# =============================================================================
# PINOT PULSE - Integrations Router
# API endpoints for managing data integrations
# Banking & Credit Union Edition - Enterprise Grade
# =============================================================================

from datetime import datetime
from typing import Optional, List
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
import structlog

from app.api.deps import (
    get_db,
    get_redis,
    get_current_active_user,
    get_pagination,
    require_permissions,
    CurrentUser,
    PaginationParams,
)
from app.core.redis import RedisClient
from app.core.exceptions import NotFoundError, ValidationError
from app.schemas.base import SuccessResponse, PaginatedResponse
from app.services.cloud_connectors import test_connector_config, create_connector, CONNECTOR_REGISTRY

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/integrations", tags=["Integrations"])


# =============================================================================
# AVAILABLE INTEGRATIONS
# =============================================================================

INTEGRATION_CATALOG = {
    # Cloud Data Warehouses
    "snowflake": {
        "name": "Snowflake",
        "description": "Cloud data warehouse with support for structured and semi-structured data",
        "category": "data_warehouse",
        "icon": "snowflake",
        "documentation_url": "https://docs.snowflake.com",
        "features": ["sql_queries", "bulk_load", "streaming", "time_travel"],
        "auth_methods": ["password", "keypair", "oauth"],
    },
    "bigquery": {
        "name": "Google BigQuery",
        "description": "Serverless, highly scalable data warehouse",
        "category": "data_warehouse",
        "icon": "google-cloud",
        "features": ["sql_queries", "bulk_load", "streaming", "ml_integration"],
        "auth_methods": ["service_account", "oauth"],
    },
    "databricks": {
        "name": "Databricks",
        "description": "Unified analytics platform with Delta Lake",
        "category": "data_warehouse",
        "icon": "databricks",
        "features": ["sql_queries", "delta_lake", "ml_integration", "streaming"],
        "auth_methods": ["token", "oauth"],
    },
    "redshift": {
        "name": "Amazon Redshift",
        "description": "AWS cloud data warehouse",
        "category": "data_warehouse",
        "icon": "aws",
        "features": ["sql_queries", "bulk_load", "spectrum"],
        "auth_methods": ["password", "iam"],
    },
    
    # Streaming Platforms
    "kafka": {
        "name": "Apache Kafka",
        "description": "Distributed event streaming platform",
        "category": "streaming",
        "icon": "kafka",
        "features": ["realtime_ingestion", "schema_registry", "exactly_once"],
        "auth_methods": ["plaintext", "sasl", "ssl"],
    },
    "confluent": {
        "name": "Confluent Cloud",
        "description": "Fully managed Kafka service",
        "category": "streaming",
        "icon": "confluent",
        "features": ["realtime_ingestion", "schema_registry", "ksqldb"],
        "auth_methods": ["api_key"],
    },
    "kinesis": {
        "name": "Amazon Kinesis",
        "description": "AWS real-time data streaming service",
        "category": "streaming",
        "icon": "aws",
        "features": ["realtime_ingestion", "enhanced_fanout"],
        "auth_methods": ["iam", "access_key"],
    },
    "eventhubs": {
        "name": "Azure Event Hubs",
        "description": "Azure real-time data ingestion service",
        "category": "streaming",
        "icon": "azure",
        "features": ["realtime_ingestion", "kafka_compatible"],
        "auth_methods": ["connection_string", "managed_identity"],
    },
    "pubsub": {
        "name": "Google Pub/Sub",
        "description": "GCP messaging and streaming service",
        "category": "streaming",
        "icon": "google-cloud",
        "features": ["realtime_ingestion", "ordering"],
        "auth_methods": ["service_account"],
    },
    
    # Cloud Storage
    "s3": {
        "name": "Amazon S3",
        "description": "AWS object storage",
        "category": "cloud_storage",
        "icon": "aws",
        "features": ["batch_load", "parquet", "csv", "json", "avro"],
        "auth_methods": ["iam", "access_key"],
    },
    "gcs": {
        "name": "Google Cloud Storage",
        "description": "GCP object storage",
        "category": "cloud_storage",
        "icon": "google-cloud",
        "features": ["batch_load", "parquet", "csv", "json"],
        "auth_methods": ["service_account"],
    },
    "azure_blob": {
        "name": "Azure Blob Storage",
        "description": "Azure object storage",
        "category": "cloud_storage",
        "icon": "azure",
        "features": ["batch_load", "parquet", "csv"],
        "auth_methods": ["connection_string", "sas", "managed_identity"],
    },
    
    # Orchestration
    "astronomer": {
        "name": "Astronomer",
        "description": "Managed Apache Airflow platform",
        "category": "orchestration",
        "icon": "astronomer",
        "features": ["dag_management", "scheduling", "monitoring"],
        "auth_methods": ["api_key"],
    },
    "airflow": {
        "name": "Apache Airflow",
        "description": "Workflow orchestration platform",
        "category": "orchestration",
        "icon": "airflow",
        "features": ["dag_management", "scheduling"],
        "auth_methods": ["basic", "token"],
    },
    "dagster": {
        "name": "Dagster",
        "description": "Data orchestration platform",
        "category": "orchestration",
        "icon": "dagster",
        "features": ["software_defined_assets", "observability"],
        "auth_methods": ["api_key"],
    },
    "dbt_cloud": {
        "name": "dbt Cloud",
        "description": "Analytics engineering platform",
        "category": "orchestration",
        "icon": "dbt",
        "features": ["transformations", "testing", "documentation"],
        "auth_methods": ["api_token"],
    },
    
    # Core Banking Systems
    "fis": {
        "name": "FIS",
        "description": "FIS Horizon, Profile, and Core Director",
        "category": "core_banking",
        "icon": "bank",
        "features": ["accounts", "transactions", "members", "loans"],
        "auth_methods": ["api_key", "oauth"],
    },
    "fiserv": {
        "name": "Fiserv",
        "description": "Fiserv DNA, Premier, and Cleartouch",
        "category": "core_banking",
        "icon": "bank",
        "features": ["accounts", "transactions", "members", "loans"],
        "auth_methods": ["oauth"],
    },
    "jack_henry": {
        "name": "Jack Henry",
        "description": "Jack Henry Silverlake and Symitar",
        "category": "core_banking",
        "icon": "bank",
        "features": ["accounts", "transactions", "members", "loans"],
        "auth_methods": ["oauth", "api_key"],
    },
    "temenos": {
        "name": "Temenos",
        "description": "Temenos T24 and Infinity",
        "category": "core_banking",
        "icon": "bank",
        "features": ["accounts", "transactions", "members"],
        "auth_methods": ["oauth"],
    },
    "corelation": {
        "name": "Corelation KeyStone",
        "description": "Credit union core banking",
        "category": "core_banking",
        "icon": "bank",
        "features": ["accounts", "transactions", "members", "loans"],
        "auth_methods": ["api_key"],
    },
    
    # Digital Banking
    "q2": {
        "name": "Q2",
        "description": "Q2 Digital Banking Platform",
        "category": "digital_banking",
        "icon": "mobile",
        "features": ["sessions", "transfers", "bill_pay"],
        "auth_methods": ["oauth"],
    },
    "alkami": {
        "name": "Alkami",
        "description": "Alkami Digital Banking",
        "category": "digital_banking",
        "icon": "mobile",
        "features": ["sessions", "transfers", "engagement"],
        "auth_methods": ["oauth"],
    },
    "banno": {
        "name": "Banno",
        "description": "Jack Henry Banno Digital",
        "category": "digital_banking",
        "icon": "mobile",
        "features": ["sessions", "conversations"],
        "auth_methods": ["api_key"],
    },
    
    # Card Processing
    "visa_dps": {
        "name": "Visa DPS",
        "description": "Visa Debit Processing Service",
        "category": "card_processing",
        "icon": "credit-card",
        "features": ["authorizations", "settlements", "disputes"],
        "auth_methods": ["certificate"],
    },
    "mastercard": {
        "name": "Mastercard",
        "description": "Mastercard processing services",
        "category": "card_processing",
        "icon": "credit-card",
        "features": ["authorizations", "settlements"],
        "auth_methods": ["certificate"],
    },
    "pscu": {
        "name": "PSCU",
        "description": "PSCU card processing",
        "category": "card_processing",
        "icon": "credit-card",
        "features": ["debit", "credit", "atm"],
        "auth_methods": ["api_key"],
    },
    
    # CRM
    "salesforce": {
        "name": "Salesforce",
        "description": "Salesforce CRM",
        "category": "crm",
        "icon": "salesforce",
        "features": ["contacts", "opportunities", "cases"],
        "auth_methods": ["oauth"],
    },
    
    # Databases
    "postgresql": {
        "name": "PostgreSQL",
        "description": "PostgreSQL database",
        "category": "database",
        "icon": "database",
        "features": ["sql_queries", "cdc"],
        "auth_methods": ["password"],
    },
    "mysql": {
        "name": "MySQL",
        "description": "MySQL database",
        "category": "database",
        "icon": "database",
        "features": ["sql_queries", "cdc"],
        "auth_methods": ["password"],
    },
    "oracle": {
        "name": "Oracle",
        "description": "Oracle database",
        "category": "database",
        "icon": "database",
        "features": ["sql_queries"],
        "auth_methods": ["password"],
    },
    # Hyphenated aliases used by Admin Console > Integrations frontend
    "fiserv-dna": {
        "name": "Fiserv DNA",
        "description": "Fiserv DNA core banking",
        "category": "core_banking",
        "icon": "bank",
        "features": ["accounts", "transactions", "members", "loans"],
        "auth_methods": ["oauth", "api_key", "mtls"],
    },
    "jack-henry-symitar": {
        "name": "Jack Henry Symitar",
        "description": "Jack Henry SymXchange + PowerOn",
        "category": "core_banking",
        "icon": "bank",
        "features": ["accounts", "transactions", "members", "loans"],
        "auth_methods": ["basic", "api_key"],
    },
    "corelation-keystone": {
        "name": "Corelation KeyStone",
        "description": "KeyStone REST API + Webhooks",
        "category": "core_banking",
        "icon": "bank",
        "features": ["accounts", "transactions", "persons", "loans"],
        "auth_methods": ["api_key"],
    },
}


# =============================================================================
# LIST AVAILABLE INTEGRATIONS
# =============================================================================

@router.get("/catalog")
async def list_integration_catalog(
    category: Optional[str] = Query(None),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    """List all available integration types."""
    integrations = []
    
    for key, info in INTEGRATION_CATALOG.items():
        if category and info["category"] != category:
            continue
        
        integrations.append({
            "id": key,
            **info,
        })
    
    # Group by category
    categories = {}
    for integration in integrations:
        cat = integration["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(integration)
    
    return {
        "integrations": integrations,
        "by_category": categories,
        "categories": list(set(i["category"] for i in integrations)),
    }


@router.get("/catalog/{integration_type}")
async def get_integration_details(
    integration_type: str,
    current_user: CurrentUser = Depends(get_current_active_user),
):
    """Get details for a specific integration type."""
    if integration_type not in INTEGRATION_CATALOG:
        raise NotFoundError(f"Integration type '{integration_type}' not found")
    
    info = INTEGRATION_CATALOG[integration_type]
    
    # Get configuration schema
    config_schema = get_config_schema(integration_type)
    
    return {
        "id": integration_type,
        **info,
        "config_schema": config_schema,
    }


def get_config_schema(integration_type: str) -> dict:
    """Get configuration schema for an integration type."""
    
    schemas = {
        "snowflake": {
            "properties": {
                "account": {"type": "string", "required": True, "description": "Snowflake account (e.g., abc123.us-east-1)"},
                "username": {"type": "string", "required": True},
                "warehouse": {"type": "string", "required": True},
                "database": {"type": "string", "required": True},
                "schema": {"type": "string", "default": "PUBLIC"},
                "role": {"type": "string"},
                "auth_type": {"type": "select", "options": ["password", "keypair", "oauth"], "default": "password"},
            },
            "credentials": {
                "password": {"type": "password", "required_if": {"auth_type": "password"}},
                "private_key_path": {"type": "string", "required_if": {"auth_type": "keypair"}},
            },
        },
        "kafka": {
            "properties": {
                "bootstrap_servers": {"type": "string", "required": True, "description": "Comma-separated broker list"},
                "security_protocol": {"type": "select", "options": ["PLAINTEXT", "SSL", "SASL_PLAINTEXT", "SASL_SSL"], "default": "PLAINTEXT"},
                "sasl_mechanism": {"type": "select", "options": ["PLAIN", "SCRAM-SHA-256", "SCRAM-SHA-512"]},
                "schema_registry_url": {"type": "string"},
            },
            "credentials": {
                "sasl_username": {"type": "string", "required_if": {"security_protocol": ["SASL_PLAINTEXT", "SASL_SSL"]}},
                "sasl_password": {"type": "password", "required_if": {"security_protocol": ["SASL_PLAINTEXT", "SASL_SSL"]}},
            },
        },
        "astronomer": {
            "properties": {
                "deployment_url": {"type": "string", "required": True, "description": "Astronomer deployment URL"},
                "workspace_id": {"type": "string"},
                "deployment_id": {"type": "string"},
            },
            "credentials": {
                "api_key": {"type": "password", "required": True},
            },
        },
        # Add more schemas as needed
    }
    
    return schemas.get(integration_type, {"properties": {}, "credentials": {}})


# =============================================================================
# INTEGRATION CRUD
# =============================================================================

@router.get(
    "",
    dependencies=[Depends(require_permissions("integrations:read"))],
)
async def list_integrations(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    pagination: PaginationParams = Depends(get_pagination),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List configured integrations — reads from admin.integration_configs (persisted state)."""
    from sqlalchemy import text
    
    integrations = []
    try:
        query = "SELECT id, name, category, status, config, configured_at, tested_at, last_sync_at, error_message FROM admin.integration_configs"
        conditions = []
        params = {}
        
        if category:
            conditions.append("category = :category")
            params["category"] = category
        if status:
            conditions.append("status = :status")
            params["status"] = status
        if search:
            conditions.append("(name ILIKE :search OR id ILIKE :search)")
            params["search"] = f"%{search}%"
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY updated_at DESC"
        
        result = await db.execute(text(query), params)
        for row in result.mappings():
            integrations.append({
                "id": row["id"],
                "name": row["name"],
                "type": row["id"],
                "category": row["category"],
                "status": row["status"],
                "last_sync_at": row["last_sync_at"].isoformat() if row["last_sync_at"] else None,
                "configured_at": row["configured_at"].isoformat() if row["configured_at"] else None,
                "tested_at": row["tested_at"].isoformat() if row["tested_at"] else None,
                "error_message": row["error_message"],
            })
    except Exception:
        # Table may not exist yet — return empty until first config is saved
        pass
    
    # Paginate
    total = len(integrations)
    start = (pagination.page - 1) * pagination.page_size
    end = start + pagination.page_size
    
    return {
        "data": integrations[start:end],
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size,
    }


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permissions("integrations:create"))],
)
async def create_integration(
    name: str,
    integration_type: str,
    config: dict,
    credentials: dict = None,
    description: str = None,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new integration — persists config to admin.integration_configs."""
    import json as _json
    from sqlalchemy import text as _text

    if integration_type not in INTEGRATION_CATALOG:
        raise ValidationError(f"Unknown integration type: {integration_type}")
    
    integration_id = integration_type  # Use type as canonical ID for admin config

    # Persist to admin.integration_configs
    try:
        await db.execute(_text("CREATE SCHEMA IF NOT EXISTS admin"))
        await db.execute(_text("""
            CREATE TABLE IF NOT EXISTS admin.integration_configs (
                id TEXT PRIMARY KEY, org_id UUID, category TEXT NOT NULL, name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'not_configured', config JSONB NOT NULL DEFAULT '{}',
                error_message TEXT, configured_at TIMESTAMPTZ, tested_at TIMESTAMPTZ,
                last_sync_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), configured_by UUID
            )
        """))
        cat_info = INTEGRATION_CATALOG.get(integration_type, {})
        category = cat_info.get("category", "unknown")
        await db.execute(_text("""
            INSERT INTO admin.integration_configs (id, org_id, category, name, status, config, configured_at, configured_by)
            VALUES (:id, :org_id, :cat, :name, 'configured', :config::jsonb, NOW(), :uid)
            ON CONFLICT (id) DO UPDATE SET
                config = :config::jsonb, status = 'configured', configured_at = NOW(), configured_by = :uid, updated_at = NOW()
        """), {
            "id": integration_id, "org_id": str(current_user.organization_id) if hasattr(current_user, 'organization_id') and current_user.organization_id else None,
            "cat": category, "name": name, "config": _json.dumps(config), "uid": str(current_user.user_id),
        })
        await db.commit()
    except Exception as e:
        logger.error("Failed to persist integration", error=str(e))

    # Store credentials in vault if provided
    if credentials:
        try:
            from app.services.vault_repository import VaultRepository
            from app.services.credential_vault import vault as _vault
            repo = VaultRepository(db)
            encrypted = _vault.engine.encrypt(_json.dumps(credentials))
            await repo.store_secret(f"integration:{integration_id}", encrypted, "integration_config",
                metadata={"encrypted_fields": list(credentials.keys())}, user=str(current_user.user_id))
            await db.commit()
        except Exception as e:
            logger.warning("Vault storage failed for new integration", error=str(e))

    logger.info("Integration created", integration_id=integration_id, type=integration_type, user_id=current_user.user_id)
    
    return {
        "id": integration_id,
        "name": name,
        "type": integration_type,
        "description": description,
        "status": "configured",
        "created_at": datetime.utcnow().isoformat(),
    }


@router.post(
    "/test",
    dependencies=[Depends(require_permissions("integrations:create"))],
)
async def test_integration(
    integration_type: str,
    config: dict,
    credentials: dict = None,
    current_user: CurrentUser = Depends(get_current_active_user),
):
    """Test an integration configuration without saving."""
    if integration_type not in CONNECTOR_REGISTRY:
        raise ValidationError(f"Connector not implemented: {integration_type}")
    
    try:
        result = await test_connector_config(
            integration_type,
            config,
            credentials or {},
        )
        return result
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.post(
    "/{integration_id}/test",
    dependencies=[Depends(require_permissions("integrations:execute"))],
)
async def test_integration_by_id(
    integration_id: str,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Test an existing integration connection by ID — attempts real connectivity."""
    from sqlalchemy import text as _text
    import json as _json
    import time as _time

    # Load config from DB
    config = {}
    credentials = {}
    try:
        result = await db.execute(_text(
            "SELECT config, status FROM admin.integration_configs WHERE id = :id"
        ), {"id": integration_id})
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail=f"Integration '{integration_id}' not found")
        config = row["config"] if isinstance(row["config"], dict) else _json.loads(row["config"] or "{}")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail=f"Integration '{integration_id}' not found or config table not initialized")

    # Load credentials from vault if available
    try:
        from app.services.vault_repository import VaultRepository
        from app.services.credential_vault import vault as _vault
        repo = VaultRepository(db)
        secret = await repo.get_secret(f"integration:{integration_id}")
        if secret and secret.encrypted_value:
            decrypted = _vault.engine.decrypt(secret.encrypted_value)
            credentials = _json.loads(decrypted)
    except Exception:
        pass  # No credentials stored or vault unavailable

    # Attempt real connection test via connector registry
    start_time = _time.monotonic()
    try:
        if integration_id in CONNECTOR_REGISTRY:
            result = await test_connector_config(integration_id, config, credentials)
            latency_ms = round((_time.monotonic() - start_time) * 1000)
            success = result.get("success", False)
        else:
            # For connectors not in registry, attempt basic TCP connectivity
            import asyncio
            import socket

            host = config.get("host") or config.get("apiEndpoint") or config.get("bootstrap_servers", "").split(",")[0].split(":")[0]
            port = config.get("port") or config.get("apiPort")

            if host:
                if not port:
                    # Infer port from integration type
                    port_defaults = {"postgresql": 5432, "mysql": 3306, "oracle": 1521, "kafka": 9092, "redis": 6379}
                    port = port_defaults.get(integration_id, 443)
                port = int(port)

                loop = asyncio.get_event_loop()
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(10)
                try:
                    await loop.run_in_executor(None, sock.connect, (host, port))
                    success = True
                except (socket.timeout, ConnectionRefusedError, OSError):
                    success = False
                finally:
                    sock.close()
                latency_ms = round((_time.monotonic() - start_time) * 1000)
                result = {"success": success}
            else:
                success = False
                latency_ms = 0
                result = {"success": False, "error": "No host/endpoint configured for connectivity test"}

    except Exception as e:
        latency_ms = round((_time.monotonic() - start_time) * 1000)
        success = False
        result = {"success": False, "error": str(e)}

    # Update tested_at and status in DB
    try:
        new_status = "connected" if success else "error"
        error_msg = None if success else result.get("error", "Connection test failed")
        await db.execute(_text("""
            UPDATE admin.integration_configs
            SET tested_at = NOW(), status = :status, error_message = :err, updated_at = NOW()
            WHERE id = :id
        """), {"id": integration_id, "status": new_status, "err": error_msg})
        await db.commit()
    except Exception:
        pass

    return {
        "success": success,
        "message": f"Connection test {'passed' if success else 'failed'} for integration {integration_id}",
        "latency_ms": latency_ms,
        "tested_at": datetime.utcnow().isoformat(),
        "details": result.get("error") if not success else None,
    }


@router.post(
    "/{integration_id}/sync",
    dependencies=[Depends(require_permissions("integrations:execute"))],
)
async def trigger_sync(
    integration_id: str,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a sync for an integration — creates a sync job record."""
    from sqlalchemy import text as _text

    # Verify integration exists
    try:
        result = await db.execute(_text(
            "SELECT id, status FROM admin.integration_configs WHERE id = :id"
        ), {"id": integration_id})
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail=f"Integration '{integration_id}' not found")
        if row["status"] == "not_configured":
            raise HTTPException(status_code=422, detail="Integration is not configured. Complete setup before syncing.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail=f"Integration '{integration_id}' not found")

    sync_id = f"sync_{uuid4().hex[:12]}"

    # Create sync job record
    try:
        await db.execute(_text("""
            CREATE TABLE IF NOT EXISTS admin.sync_jobs (
                id TEXT PRIMARY KEY, integration_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending', records_synced INTEGER DEFAULT 0,
                error_message TEXT, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), triggered_by UUID
            )
        """))
        await db.execute(_text("""
            INSERT INTO admin.sync_jobs (id, integration_id, status, triggered_by, created_at)
            VALUES (:id, :int_id, 'pending', :uid, NOW())
        """), {"id": sync_id, "int_id": integration_id, "uid": str(current_user.user_id)})

        # Update last_sync_at on integration config
        await db.execute(_text("""
            UPDATE admin.integration_configs SET last_sync_at = NOW(), updated_at = NOW() WHERE id = :id
        """), {"id": integration_id})
        await db.commit()
    except Exception as e:
        logger.warning("Failed to create sync job record", error=str(e))

    logger.info("Sync triggered", integration_id=integration_id, sync_id=sync_id, user_id=str(current_user.user_id))

    return {
        "message": "Sync triggered",
        "integration_id": integration_id,
        "sync_id": sync_id,
        "status": "pending",
    }


@router.get(
    "/{integration_id}/status",
    dependencies=[Depends(require_permissions("integrations:read"))],
)
async def get_integration_status(
    integration_id: str,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current status of an integration from DB."""
    from sqlalchemy import text as _text
    try:
        result = await db.execute(_text("""
            SELECT id, status, configured_at, tested_at, last_sync_at, error_message
            FROM admin.integration_configs WHERE id = :id
        """), {"id": integration_id})
        row = result.mappings().first()
        if row:
            return {
                "integration_id": row["id"],
                "status": row["status"],
                "last_connected_at": row["tested_at"].isoformat() if row["tested_at"] else None,
                "last_sync_at": row["last_sync_at"].isoformat() if row["last_sync_at"] else None,
                "configured_at": row["configured_at"].isoformat() if row["configured_at"] else None,
                "error_message": row["error_message"],
                "health": {
                    "latency_ms": None,
                    "error_rate": None,
                },
            }
    except Exception:
        pass
    return {
        "integration_id": integration_id,
        "status": "not_configured",
        "last_connected_at": None,
        "last_sync_at": None,
        "health": {"latency_ms": None, "error_rate": None},
    }


@router.delete(
    "/{integration_id}",
    dependencies=[Depends(require_permissions("integrations:delete"))],
)
async def delete_integration(
    integration_id: str,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an integration — removes config from DB and credentials from vault."""
    from sqlalchemy import text as _text

    # Delete from admin.integration_configs
    try:
        result = await db.execute(_text("DELETE FROM admin.integration_configs WHERE id = :id"), {"id": integration_id})
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Integration '{integration_id}' not found")
    except HTTPException:
        raise
    except Exception:
        pass

    # Delete credentials from vault
    try:
        from app.services.vault_repository import VaultRepository
        repo = VaultRepository(db)
        await repo.delete_secret(f"integration:{integration_id}")
    except Exception:
        pass

    await db.commit()
    logger.info("Integration deleted", integration_id=integration_id, user_id=current_user.user_id)
    return SuccessResponse(message="Integration deleted successfully")


# =============================================================================
# SYNC JOBS
# =============================================================================

@router.get(
    "/{integration_id}/jobs",
    dependencies=[Depends(require_permissions("integrations:read"))],
)
async def list_sync_jobs(
    integration_id: str,
    status: Optional[str] = Query(None),
    pagination: PaginationParams = Depends(get_pagination),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List sync jobs for an integration from DB."""
    from sqlalchemy import text as _text

    jobs = []
    try:
        query = "SELECT id, integration_id, status, records_synced, error_message, started_at, completed_at, created_at, triggered_by FROM admin.sync_jobs WHERE integration_id = :int_id"
        params: dict = {"int_id": integration_id}
        if status:
            query += " AND status = :status"
            params["status"] = status
        query += " ORDER BY created_at DESC"

        result = await db.execute(_text(query), params)
        for row in result.mappings():
            jobs.append({
                "id": row["id"],
                "integration_id": row["integration_id"],
                "status": row["status"],
                "records_synced": row["records_synced"] or 0,
                "error_message": row["error_message"],
                "started_at": row["started_at"].isoformat() if row["started_at"] else None,
                "completed_at": row["completed_at"].isoformat() if row["completed_at"] else None,
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "triggered_by": str(row["triggered_by"]) if row["triggered_by"] else None,
            })
    except Exception:
        pass  # Table may not exist yet

    total = len(jobs)
    start = (pagination.page - 1) * pagination.page_size
    end = start + pagination.page_size

    return {
        "data": jobs[start:end],
        "total": total,
    }


@router.get(
    "/{integration_id}/jobs/{job_id}",
    dependencies=[Depends(require_permissions("integrations:read"))],
)
async def get_sync_job(
    integration_id: str,
    job_id: str,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get details of a specific sync job from DB."""
    from sqlalchemy import text as _text

    try:
        result = await db.execute(_text(
            "SELECT id, integration_id, status, records_synced, error_message, started_at, completed_at, created_at, triggered_by FROM admin.sync_jobs WHERE id = :id AND integration_id = :int_id"
        ), {"id": job_id, "int_id": integration_id})
        row = result.mappings().first()
        if row:
            return {
                "id": row["id"],
                "integration_id": row["integration_id"],
                "status": row["status"],
                "records_synced": row["records_synced"] or 0,
                "error_message": row["error_message"],
                "started_at": row["started_at"].isoformat() if row["started_at"] else None,
                "completed_at": row["completed_at"].isoformat() if row["completed_at"] else None,
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            }
    except Exception:
        pass

    raise HTTPException(status_code=404, detail=f"Sync job {job_id} not found")


@router.get("/connections")
async def get_active_connections(
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get active integration connections from DB."""
    from sqlalchemy import text as _text

    connections = []
    healthy = 0
    degraded = 0

    try:
        result = await db.execute(_text(
            "SELECT id, name, category, status, tested_at, last_sync_at, error_message FROM admin.integration_configs WHERE status != 'not_configured' ORDER BY updated_at DESC"
        ))
        for row in result.mappings():
            conn_status = row["status"]
            connections.append({
                "id": row["id"],
                "name": row["name"],
                "category": row["category"],
                "status": conn_status,
                "last_tested": row["tested_at"].isoformat() if row["tested_at"] else None,
                "last_sync": row["last_sync_at"].isoformat() if row["last_sync_at"] else None,
                "error": row["error_message"],
            })
            if conn_status == "connected":
                healthy += 1
            elif conn_status == "error":
                degraded += 1
    except Exception:
        pass

    return {
        "connections": connections,
        "total": len(connections),
        "healthy": healthy,
        "degraded": degraded,
    }
