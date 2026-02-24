# =============================================================================
# PINOT PULSE - Organization Management Router
# API endpoints for organization/institution management
# Banking & Credit Union Edition
# =============================================================================

from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
import structlog

from app.api.deps import (
    get_db,
    get_redis,
    get_current_user,
    get_current_active_user,
    get_pagination,
    require_permissions,
    require_roles,
    CurrentUser,
    PaginationParams,
)
from app.core.redis import RedisClient
from app.core.config import settings
from app.core.exceptions import (
    NotFoundError,
    AlreadyExistsError,
    AuthorizationError,
    ValidationError,
)
from app.core.logging import AuditLogger
from app.models import Organization, Branch, OrganizationDomain, User
from app.schemas.organization import (
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationBrief,
    BranchCreate,
    BranchUpdate,
    BranchResponse,
    BranchBrief,
    BranchListResponse,
    SecuritySettings,
    ComplianceSettings,
    NotificationSettings,
    DataSettings,
    OrganizationSettingsResponse,
    OrganizationSettingsUpdate,
    DomainVerificationRequest,
    DomainVerificationResponse,
    DomainListResponse,
    UsageSummary,
    BillingInfo,
    OnboardingStatus,
    OnboardingStepComplete,
)
from app.schemas.base import SuccessResponse, PaginatedResponse

logger = structlog.get_logger(__name__)
audit_logger = AuditLogger()

router = APIRouter(prefix="/organization", tags=["Organization"])


# =============================================================================
# ORGANIZATION INFO
# =============================================================================

@router.get(
    "",
    response_model=OrganizationResponse,
    dependencies=[Depends(require_permissions("organization:read"))],
)
async def get_organization(
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current organization details."""
    result = await db.execute(
        select(Organization)
        .where(Organization.id == current_user.organization_id)
        .options(selectinload(Organization.domains))
    )
    org = result.scalar_one_or_none()
    
    if not org:
        raise NotFoundError("Organization not found")
    
    return OrganizationResponse.model_validate(org)


@router.patch(
    "",
    response_model=OrganizationResponse,
    dependencies=[Depends(require_permissions("organization:update"))],
)
async def update_organization(
    request: Request,
    org_data: OrganizationUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update organization details."""
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = result.scalar_one_or_none()
    
    if not org:
        raise NotFoundError("Organization not found")
    
    update_data = org_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if hasattr(org, field):
            setattr(org, field, value)
    
    await db.commit()
    await db.refresh(org)
    
    # Audit log
    ip_address = request.client.host if request.client else "unknown"
    await audit_logger.log_organization_updated(
        actor_id=current_user.user_id,
        organization_id=str(org.id),
        changes=update_data,
        ip_address=ip_address,
    )
    
    return OrganizationResponse.model_validate(org)


# =============================================================================
# ORGANIZATION SETTINGS
# =============================================================================

@router.get(
    "/settings",
    response_model=OrganizationSettingsResponse,
    dependencies=[Depends(require_permissions("settings:read"))],
)
async def get_organization_settings(
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all organization settings."""
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = result.scalar_one_or_none()
    
    if not org:
        raise NotFoundError("Organization not found")
    
    return OrganizationSettingsResponse(
        security=SecuritySettings(**(org.security_settings or {})),
        compliance=ComplianceSettings(**(org.compliance_settings or {})),
        notifications=NotificationSettings(**(org.notification_settings or {})),
        data=DataSettings(**(org.data_settings or {})),
    )


@router.patch(
    "/settings",
    response_model=OrganizationSettingsResponse,
    dependencies=[Depends(require_permissions("settings:update"))],
)
async def update_organization_settings(
    request: Request,
    settings_data: OrganizationSettingsUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update organization settings."""
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = result.scalar_one_or_none()
    
    if not org:
        raise NotFoundError("Organization not found")
    
    if settings_data.security:
        org.security_settings = {
            **(org.security_settings or {}),
            **settings_data.security.model_dump(exclude_unset=True),
        }
    
    if settings_data.compliance:
        org.compliance_settings = {
            **(org.compliance_settings or {}),
            **settings_data.compliance.model_dump(exclude_unset=True),
        }
    
    if settings_data.notifications:
        org.notification_settings = {
            **(org.notification_settings or {}),
            **settings_data.notifications.model_dump(exclude_unset=True),
        }
    
    if settings_data.data:
        org.data_settings = {
            **(org.data_settings or {}),
            **settings_data.data.model_dump(exclude_unset=True),
        }
    
    await db.commit()
    await db.refresh(org)
    
    # Audit log
    ip_address = request.client.host if request.client else "unknown"
    await audit_logger.log_settings_updated(
        actor_id=current_user.user_id,
        organization_id=str(org.id),
        ip_address=ip_address,
    )
    
    return OrganizationSettingsResponse(
        security=SecuritySettings(**(org.security_settings or {})),
        compliance=ComplianceSettings(**(org.compliance_settings or {})),
        notifications=NotificationSettings(**(org.notification_settings or {})),
        data=DataSettings(**(org.data_settings or {})),
    )


# =============================================================================
# BRANCHES
# =============================================================================

@router.get(
    "/branches",
    response_model=BranchListResponse,
    dependencies=[Depends(require_permissions("branches:read"))],
)
async def list_branches(
    search: Optional[str] = Query(None, max_length=200),
    branch_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    pagination: PaginationParams = Depends(get_pagination),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all branches for the organization."""
    query = select(Branch).where(
        Branch.organization_id == current_user.organization_id,
        Branch.is_deleted == False,
    )
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Branch.name.ilike(search_term),
                Branch.branch_code.ilike(search_term),
                Branch.city.ilike(search_term),
            )
        )
    
    if branch_type:
        query = query.where(Branch.branch_type == branch_type)
    
    if is_active is not None:
        query = query.where(Branch.is_active == is_active)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination
    query = query.order_by(Branch.name.asc())
    query = query.offset(pagination.offset).limit(pagination.limit)
    
    result = await db.execute(query)
    branches = result.scalars().all()
    
    branch_list = [
        BranchBrief(
            id=str(branch.id),
            name=branch.name,
            code=branch.code,
            city=branch.city,
            state=branch.state,
            is_active=branch.is_active,
        )
        for branch in branches
    ]
    
    return PaginatedResponse.create(
        data=branch_list,
        page=pagination.page,
        page_size=pagination.page_size,
        total_items=total,
    )


@router.post(
    "/branches",
    response_model=BranchResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permissions("branches:create"))],
)
async def create_branch(
    request: Request,
    branch_data: BranchCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new branch."""
    # Check for duplicate branch code
    result = await db.execute(
        select(Branch).where(
            Branch.organization_id == current_user.organization_id,
            Branch.branch_code == branch_data.branch_code,
            Branch.is_deleted == False,
        )
    )
    if result.scalar_one_or_none():
        raise AlreadyExistsError(f"Branch with code '{branch_data.branch_code}' already exists")
    
    # Get organization for default timezone
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = result.scalar_one_or_none()
    
    branch = Branch(
        organization_id=current_user.organization_id,
        name=branch_data.name,
        code=branch_data.branch_code,
        branch_type=branch_data.branch_type,
        address=branch_data.address,
        city=branch_data.city,
        state=branch_data.state,
        zip_code=branch_data.zip_code,
        phone=branch_data.phone,
        manager_name=getattr(branch_data, "manager_name", None),
        timezone=branch_data.timezone or (org.timezone if org else "America/New_York"),
        open_date=branch_data.open_date,
        routing_number=branch_data.routing_number,
        is_active=branch_data.is_active,
    )
    
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    
    # Update organization branch count
    if org:
        # Note: We could use a trigger for this
        result = await db.execute(
            select(func.count()).where(
                Branch.organization_id == org.id,
                Branch.is_deleted == False,
            )
        )
        # org.branch_count = result.scalar() or 0
    
    # Audit log
    ip_address = request.client.host if request.client else "unknown"
    await audit_logger.log_branch_created(
        actor_id=current_user.user_id,
        branch_id=str(branch.id),
        ip_address=ip_address,
    )
    
    logger.info(
        "Branch created",
        branch_id=branch.id,
        created_by=current_user.user_id,
    )
    
    return BranchResponse.model_validate(branch)


@router.get(
    "/branches/{branch_id}",
    response_model=BranchResponse,
    dependencies=[Depends(require_permissions("branches:read"))],
)
async def get_branch(
    branch_id: str,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific branch."""
    result = await db.execute(
        select(Branch).where(
            Branch.id == branch_id,
            Branch.organization_id == current_user.organization_id,
            Branch.is_deleted == False,
        )
    )
    branch = result.scalar_one_or_none()
    
    if not branch:
        raise NotFoundError("Branch not found")
    
    return BranchResponse.model_validate(branch)


@router.patch(
    "/branches/{branch_id}",
    response_model=BranchResponse,
    dependencies=[Depends(require_permissions("branches:update"))],
)
async def update_branch(
    request: Request,
    branch_id: str,
    branch_data: BranchUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a branch."""
    result = await db.execute(
        select(Branch).where(
            Branch.id == branch_id,
            Branch.organization_id == current_user.organization_id,
            Branch.is_deleted == False,
        )
    )
    branch = result.scalar_one_or_none()
    
    if not branch:
        raise NotFoundError("Branch not found")
    
    update_data = branch_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if hasattr(branch, field):
            setattr(branch, field, value)
    
    await db.commit()
    await db.refresh(branch)
    
    # Audit log
    ip_address = request.client.host if request.client else "unknown"
    await audit_logger.log_branch_updated(
        actor_id=current_user.user_id,
        branch_id=str(branch.id),
        changes=update_data,
        ip_address=ip_address,
    )
    
    return BranchResponse.model_validate(branch)


@router.delete(
    "/branches/{branch_id}",
    response_model=SuccessResponse,
    dependencies=[Depends(require_permissions("branches:delete"))],
)
async def delete_branch(
    request: Request,
    branch_id: str,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a branch."""
    result = await db.execute(
        select(Branch).where(
            Branch.id == branch_id,
            Branch.organization_id == current_user.organization_id,
            Branch.is_deleted == False,
        )
    )
    branch = result.scalar_one_or_none()
    
    if not branch:
        raise NotFoundError("Branch not found")
    
    if branch.is_headquarters:
        raise ValidationError("Cannot delete headquarters branch")
    
    branch.soft_delete()
    branch.is_active = False
    
    await db.commit()
    
    # Audit log
    ip_address = request.client.host if request.client else "unknown"
    await audit_logger.log_branch_deleted(
        actor_id=current_user.user_id,
        branch_id=str(branch.id),
        ip_address=ip_address,
    )
    
    return SuccessResponse(message="Branch deleted successfully")


# =============================================================================
# DOMAIN VERIFICATION
# =============================================================================

@router.get(
    "/domains",
    response_model=DomainListResponse,
    dependencies=[Depends(require_permissions("organization:read"))],
)
async def list_domains(
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all verified and pending domains."""
    result = await db.execute(
        select(OrganizationDomain).where(
            OrganizationDomain.organization_id == current_user.organization_id
        )
    )
    domains = result.scalars().all()
    
    domain_list = [
        DomainVerificationResponse(
            id=str(domain.id),
            domain=domain.domain,
            status=domain.status,
            verification_method=domain.verification_method,
            verification_token=domain.verification_token,
            instructions=_get_verification_instructions(domain),
            created_at=domain.created_at,
            verified_at=domain.verified_at,
            expires_at=domain.verification_expires_at,
        )
        for domain in domains
    ]
    
    return DomainListResponse(domains=domain_list, total=len(domain_list))


@router.post(
    "/domains",
    response_model=DomainVerificationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permissions("organization:update"))],
)
async def add_domain(
    request: Request,
    domain_data: DomainVerificationRequest,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a domain for verification."""
    from uuid import uuid4
    
    # Check if domain already exists
    result = await db.execute(
        select(OrganizationDomain).where(
            OrganizationDomain.domain == domain_data.domain.lower()
        )
    )
    if result.scalar_one_or_none():
        raise AlreadyExistsError("Domain already registered")
    
    # Generate verification token
    token = f"pinot-pulse-verify-{uuid4().hex[:16]}"
    
    domain = OrganizationDomain(
        organization_id=current_user.organization_id,
        domain=domain_data.domain.lower(),
        verification_method="dns_txt",
        verification_token=token,
        status="pending",
        verification_expires_at=datetime.utcnow() + timedelta(days=7),
    )
    
    db.add(domain)
    await db.commit()
    await db.refresh(domain)
    
    return DomainVerificationResponse(
        id=str(domain.id),
        domain=domain.domain,
        status=domain.status,
        verification_method=domain.verification_method,
        verification_token=domain.verification_token,
        instructions=_get_verification_instructions(domain),
        created_at=domain.created_at,
        verified_at=domain.verified_at,
        expires_at=domain.verification_expires_at,
    )


@router.post(
    "/domains/{domain_id}/verify",
    response_model=DomainVerificationResponse,
    dependencies=[Depends(require_permissions("organization:update"))],
)
async def verify_domain(
    domain_id: str,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger domain verification check."""
    result = await db.execute(
        select(OrganizationDomain).where(
            OrganizationDomain.id == domain_id,
            OrganizationDomain.organization_id == current_user.organization_id,
        )
    )
    domain = result.scalar_one_or_none()
    
    if not domain:
        raise NotFoundError("Domain not found")
    
    # DNS verification — checks TXT record via dns.resolver
    import dns.resolver
    
    try:
        answers = dns.resolver.resolve(f"_pinot-pulse.{domain.domain}", "TXT")
        for rdata in answers:
            if domain.verification_token in str(rdata):
                domain.status = "verified"
                domain.verified_at = datetime.utcnow()
                await db.commit()
                await db.refresh(domain)
                
                return DomainVerificationResponse(
                    id=str(domain.id),
                    domain=domain.domain,
                    status=domain.status,
                    verification_method=domain.verification_method,
                    verification_token=domain.verification_token,
                    instructions=_get_verification_instructions(domain),
                    created_at=domain.created_at,
                    verified_at=domain.verified_at,
                    expires_at=domain.verification_expires_at,
                )
        
        raise ValidationError("Verification token not found in DNS")
    except Exception as e:
        logger.warning("Domain verification failed", domain=domain.domain, error=str(e))
        raise ValidationError(f"Verification failed: {str(e)}")


@router.delete(
    "/domains/{domain_id}",
    response_model=SuccessResponse,
    dependencies=[Depends(require_permissions("organization:update"))],
)
async def delete_domain(
    domain_id: str,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a domain."""
    result = await db.execute(
        select(OrganizationDomain).where(
            OrganizationDomain.id == domain_id,
            OrganizationDomain.organization_id == current_user.organization_id,
        )
    )
    domain = result.scalar_one_or_none()
    
    if not domain:
        raise NotFoundError("Domain not found")
    
    await db.delete(domain)
    await db.commit()
    
    return SuccessResponse(message="Domain removed successfully")


def _get_verification_instructions(domain: OrganizationDomain) -> str:
    """Generate verification instructions."""
    if domain.verification_method == "dns_txt":
        return (
            f"Add a TXT record to your DNS configuration:\n"
            f"Host: _pinot-pulse.{domain.domain}\n"
            f"Value: {domain.verification_token}\n"
            f"TTL: 3600 (or your preferred value)"
        )
    return "Contact support for verification assistance."


# =============================================================================
# USAGE & BILLING
# =============================================================================

@router.get(
    "/usage",
    response_model=UsageSummary,
    dependencies=[Depends(require_permissions("organization:read"))],
)
async def get_usage_summary(
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
):
    """Get organization usage summary."""
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = result.scalar_one_or_none()
    
    if not org:
        raise NotFoundError("Organization not found")
    
    # Get user count
    user_count_result = await db.execute(
        select(func.count()).where(
            User.organization_id == org.id,
            User.is_deleted == False,
            User.is_active == True,
        )
    )
    active_users = user_count_result.scalar() or 0
    
    # Get usage from Redis (cached)
    queries_today = int(await redis.get(f"usage:{org.id}:queries:today") or 0)
    api_calls_today = int(await redis.get(f"usage:{org.id}:api_calls:today") or 0)
    
    # Calculate period
    now = datetime.utcnow()
    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if now.month == 12:
        period_end = period_start.replace(year=now.year + 1, month=1)
    else:
        period_end = period_start.replace(month=now.month + 1)
    
    return UsageSummary(
        period_start=period_start,
        period_end=period_end,
        data_stored_bytes=org.current_data_bytes,
        data_ingested_bytes=0,  # Tracked when data sources connected
        queries_executed=queries_today,
        query_compute_seconds=0,  # Tracked per query execution
        active_users=active_users,
        api_calls=api_calls_today,
        data_limit_bytes=org.data_limit_bytes or 0,
        user_limit=org.user_limit or 0,
        query_limit=org.query_limit_per_day or 0,
        data_usage_percent=(
            (org.current_data_bytes / org.data_limit_bytes * 100)
            if org.data_limit_bytes else 0
        ),
        user_usage_percent=(
            (active_users / org.user_limit * 100)
            if org.user_limit else 0
        ),
        query_usage_percent=(
            (queries_today / org.query_limit_per_day * 100)
            if org.query_limit_per_day else 0
        ),
    )


@router.get(
    "/billing",
    response_model=BillingInfo,
    dependencies=[Depends(require_permissions("organization:billing"))],
)
async def get_billing_info(
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get organization billing information."""
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = result.scalar_one_or_none()
    
    if not org:
        raise NotFoundError("Organization not found")
    
    # Pricing tiers — could be moved to a config table in future
    tier_pricing = {
        "community": 1499.00,
        "professional": 3999.00,
        "enterprise": 9999.00,
    }

    tier = org.subscription_tier or "community"
    is_active = org.status == "active" and (
        not org.subscription_ends_at or org.subscription_ends_at > datetime.utcnow()
    )

    now = datetime.utcnow()
    cycle_start = now.replace(day=1)
    if now.month == 12:
        cycle_end = cycle_start.replace(year=now.year + 1, month=1)
    else:
        cycle_end = cycle_start.replace(month=now.month + 1)

    return BillingInfo(
        subscription_tier=tier,
        status="active" if is_active else "inactive",
        monthly_price=tier_pricing.get(tier, 0),
        currency="USD",
        billing_cycle_start=cycle_start.date(),
        billing_cycle_end=cycle_end.date(),
        next_invoice_date=cycle_end.date(),
        payment_method="card" if org.stripe_customer_id else None,
        payment_method_last4=None,
        overage_charges=0.0,
        discount_percent=0.0,
    )


# =============================================================================
# ONBOARDING
# =============================================================================

@router.get(
    "/onboarding",
    response_model=OnboardingStatus,
)
async def get_onboarding_status(
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get onboarding checklist status."""
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = result.scalar_one_or_none()
    
    if not org:
        raise NotFoundError("Organization not found")
    
    # Check various onboarding steps
    steps = {
        "profile_completed": bool(org.charter_number and org.headquarters_city),
        "team_invited": org.current_user_count > 1,
        "data_connected": False,  # Updated when data sources configured
        "first_dashboard": False,  # Updated when first dashboard created
        "first_alert": False,  # Updated when first alert configured
        "compliance_configured": bool(org.compliance_settings),
    }
    
    completed_count = sum(steps.values())
    total_steps = len(steps)
    
    # Determine current step
    current_step = "profile_completed"
    for step, completed in steps.items():
        if not completed:
            current_step = step
            break
    
    return OnboardingStatus(
        completed=org.onboarding_completed,
        steps=steps,
        current_step=current_step,
        progress_percent=int(completed_count / total_steps * 100),
    )


@router.post(
    "/onboarding/complete-step",
    response_model=OnboardingStatus,
)
async def complete_onboarding_step(
    step_data: OnboardingStepComplete,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark an onboarding step as complete and persist to DB."""
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = result.scalar_one_or_none()

    if not org:
        raise NotFoundError("Organization not found")

    # Persist step completion to onboarding_step tracker
    step_name = step_data.step if hasattr(step_data, 'step') else None
    step_index = step_data.step_index if hasattr(step_data, 'step_index') else None

    # Update onboarding_step to track highest completed step
    if step_index is not None and (org.onboarding_step or 0) < step_index + 1:
        org.onboarding_step = step_index + 1

    # Store step-specific completion data in settings
    onboarding_data = org.settings.copy() if org.settings else {}
    completed_steps = onboarding_data.get("onboarding_completed_steps", {})
    if step_name:
        completed_steps[step_name] = {
            "completed_at": datetime.utcnow().isoformat(),
            "completed_by": str(current_user.user_id),
        }
    onboarding_data["onboarding_completed_steps"] = completed_steps
    org.settings = onboarding_data

    # Check if this is the final step — mark onboarding as complete
    if step_name == "complete" or (step_index is not None and step_index >= 4):
        org.onboarding_completed = True
        org.onboarding_completed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(org)

    logger.info(
        "Onboarding step completed",
        step=step_name,
        step_index=step_index,
        org_id=str(org.id),
        user_id=str(current_user.user_id),
    )

    # Return current onboarding status from database
    return await get_onboarding_status(current_user, db)


# Import timedelta for domain expiration
from datetime import timedelta


@router.get("/logo")
async def get_organization_logo(
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get organization logo URL from DB."""
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = result.scalar_one_or_none()

    if not org:
        raise NotFoundError("Organization not found")

    return {
        "logo_url": org.logo_url or "/static/images/default-logo.svg",
        "favicon_url": "/static/images/favicon.ico",
        "organization_name": org.display_name or org.name,
    }


@router.put("/logo")
async def upload_organization_logo(
    request: Request,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload organization logo (PUT) — stores file and updates DB."""
    import os as _os
    from uuid import uuid4 as _uuid4

    result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise NotFoundError("Organization not found")

    body = await request.body()
    if not body:
        raise ValidationError("No file data provided")

    # Determine content type and extension
    content_type = request.headers.get("content-type", "image/png")
    ext_map = {"image/png": ".png", "image/jpeg": ".jpg", "image/svg+xml": ".svg", "image/webp": ".webp"}
    ext = ext_map.get(content_type, ".png")

    # Save to static uploads directory
    upload_dir = _os.path.join(_os.path.dirname(__file__), "..", "..", "..", "..", "static", "uploads", "logos")
    _os.makedirs(upload_dir, exist_ok=True)
    filename = f"{org.id}_{_uuid4().hex[:8]}{ext}"
    filepath = _os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        f.write(body)

    logo_url = f"/static/uploads/logos/{filename}"
    org.logo_url = logo_url
    await db.commit()

    logger.info("Logo uploaded", org_id=str(org.id), logo_url=logo_url)
    return {
        "message": "Logo updated successfully",
        "logoUrl": logo_url,
    }


@router.post("/logo")
async def upload_organization_logo_post(
    request: Request,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload organization logo (POST) — delegates to PUT handler."""
    return await upload_organization_logo(request, current_user, db)
