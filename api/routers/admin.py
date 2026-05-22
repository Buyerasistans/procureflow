# routers/admin.py
import os
import uuid
import json
import secrets
import csv
import re
from io import StringIO
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlalchemy import and_, case, delete, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import Any, Literal

from api.core.deps import get_db, get_current_user
from api.core.time import utcnow
from api.core.authz import (
    ADMIN_MANAGED_SYSTEM_ROLES,
    LEGACY_ADMIN_ROLES,
    can_access_admin_surface,
    can_manage_role_catalog,
    can_access_quote_workspace,
    can_create_project,
    can_manage_tenant_governance,
    can_read_admin_catalog,
    can_view_all_projects,
    get_business_role_priority,
    is_admin_managed_account,
    is_platform_staff,
    is_reserved_workspace_role,
    is_super_admin,
    is_tenant_admin,
    normalized_role,
    normalized_system_role,
    resolve_requested_user_system_role,
)
from api.core.security import get_password_hash, verify_password
from api.models import (
    Department,
    OrgCatalogRequest,
    Project,
    Supplier,
    SupplierQuote,
    User,
    Company,
    ProjectFile,
    Role,
    Permission,
    ProjectPermission,
    Quote,
    QuoteApproval,
    QuoteStatusLog,
    UserPermissionOverride,
    RolePermissionDelegation,
    user_company,
    user_department,
    company_department,
    user_managers,
    user_company_roles,
    user_project_permissions,
)
from api.models.assignment import CompanyRole
from api.models.api_key import APIKey
from api.models.project import user_projects
from api.models.project_file import ProjectFile
from api.models.refresh_token import RefreshToken
from api.models.role import role_permissions
from api.models.report import QuoteComparison, SupplierRating, PriceAnalysis, Contract
from api.models.discovery_lab import DiscoveryLabSession
from api.models.billing import BillingInvoice, BillingWebhookEvent, TenantSubscription
from api.models.email_settings import EmailSettings
from api.models.system_email import SystemEmail
from api.models.payment import TenantSubscriptionAddon, CommercialRequestWebhookDelivery
from api.models.onboarding_saas import (
    TenantPremiumFeature,
    CardVerificationTransaction,
    TenantTrialPeriod,
    BusinessPartnerCommission,
    BusinessPartnerLedger,
)
from api.schemas.assignment import (
    CompanyAssignmentCreate,
    CompanyAssignmentUpdate,
    CompanyAssignmentOut,
)
from api.schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentOut
from api.schemas.project import ProjectCreate, ProjectUpdate, ProjectOut, ProjectFileOut
from api.schemas.user import UserCreate, UserUpdate, UserOut
from api.schemas.company import CompanyCreate, CompanyUpdate, CompanyOut
from api.schemas.role import RoleCreate, RoleUpdate, RoleOut
from api.schemas.permission import PermissionOut
from api.schemas.permission_override import (
    PermissionCatalogNode,
    RolePermissionDelegationBulkUpdate,
    RolePermissionDelegationOut,
    UserPermissionOverrideBulkUpdate,
    UserPermissionOverrideOut,
)
from api.schemas.workspace_panel import (
    WorkspacePanelConfig,
    WorkspacePanelProfile,
    WorkspacePanelQuickLink,
)
from api.core.permission_matrix import build_matrix_response
from api.schemas.subscription import SubscriptionCatalogSnapshotOut
from api.schemas.tenant import (
    TenantCreate,
    TenantUpdate,
    TenantOut,
    TenantSupportWorkflowUpdate,
)
from api.services.file_service import FileUploadService
from api.services.subscription_service import (
    build_subscription_catalog_snapshot,
    enforce_active_company_limit,
    enforce_active_internal_user_limit,
    enforce_active_project_limit,
    enforce_project_file_limits,
    validate_subscription_plan_code,
)
from api.services.billing_service import ensure_tenant_subscription_for_plan
from api.services.onboarding_saas_service import activate_premium_features_for_payment
from api.services.commercial_request_webhook_service import (
    dispatch_commercial_request_event,
    retry_commercial_request_webhook_delivery,
)
from api.services.subscription_service import activate_subscription_addons_for_payment
from api.services.user_department_service import resolve_effective_department_id
from api.services.email_service import get_email_service
from api.models.tenant import Tenant, TenantSettings
from api.models.settings import SystemSettings
from api.models.campaign import CampaignEvent, CampaignProgram
from api.models.public_telemetry import PublicTelemetryEvent
from api.models.payment import PaymentTransaction, CommercialRequest
from api.services.public_pricing_service import (
    default_public_pricing_config,
    ensure_public_pricing_json,
    parse_public_pricing_config,
    serialize_public_pricing_config,
)
from api.services.scope_demo_bootstrap import seed_scope_demo_data
from api.services.system_settings_runtime import get_or_create_system_settings

router = APIRouter(prefix="/admin", tags=["admin"])


class OnboardingDecisionIn(BaseModel):
    note: str | None = None


class CommercialRequestStatusUpdateIn(BaseModel):
    status: str
    note: str | None = None
    owner_name: str | None = None
    mark_contacted_now: bool = False


class SubscriptionAddonLifecycleUpdateIn(BaseModel):
    action: str
    expires_at: datetime | None = None
    extension_days: int | None = None


class CommercialRequestWebhookSettingsIn(BaseModel):
    webhook_url: str | None = None
    webhook_secret: str | None = None
    clear_webhook_secret: bool = False


class CommercialRequestWebhookSettingsOut(BaseModel):
    webhook_url: str | None = None
    has_webhook_secret: bool = False


class CommercialRequestWebhookDeliveryOut(BaseModel):
    id: int
    commercial_request_id: int | None = None
    commercial_request_company_name: str | None = None
    commercial_request_requester_email: str | None = None
    event_type: str
    target_url: str | None = None
    delivery_status: str
    http_status_code: int | None = None
    error_message: str | None = None
    payload_raw: str | None = None
    response_body: str | None = None
    attempt_count: int
    delivered_at: datetime | None = None
    last_attempted_at: datetime | None = None
    created_at: datetime


class TenantCategoryReviewDecisionIn(BaseModel):
    category_name: str
    decision: str
    note: str | None = None


class CatalogRequestCreateIn(BaseModel):
    name: str
    description: str | None = None
    parent_id: int | None = None
    permission_ids: list[int] | None = None


class CatalogRequestReviewIn(BaseModel):
    decision: str
    note: str | None = None


class CatalogRequestOut(BaseModel):
    id: int
    entity_type: str
    tenant_id: int | None = None
    requested_by_user_id: int
    requested_by_name: str | None = None
    requested_by_email: str | None = None
    review_status: str
    proposed_name: str
    proposed_description: str | None = None
    proposed_parent_id: int | None = None
    proposed_permission_ids: list[int]
    decision_note: str | None = None
    approved_entity_id: int | None = None
    reviewed_by_user_id: int | None = None
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CatalogMergeItemOut(BaseModel):
    id: int
    name: str
    tenant_id: int | None = None
    is_active: bool = True


class CatalogMergePreviewGroupOut(BaseModel):
    normalized_name: str
    item_count: int
    impacted_assignment_count: int
    items: list[CatalogMergeItemOut]


class CatalogMergePreviewOut(BaseModel):
    entity_type: Literal["role", "department"]
    tenant_id: int | None = None
    groups: list[CatalogMergePreviewGroupOut]


class CatalogMergeApplyIn(BaseModel):
    entity_type: Literal["role", "department"]
    source_ids: list[int]
    target_id: int


class CatalogMergeApplyOut(BaseModel):
    entity_type: Literal["role", "department"]
    tenant_id: int | None = None
    target_id: int
    merged_source_ids: list[int]
    moved_assignment_count: int
    rollback_token: str
    rollback_expires_at: datetime


class CatalogMergeRollbackIn(BaseModel):
    rollback_token: str


class CatalogMergeRollbackOut(BaseModel):
    entity_type: Literal["role", "department"]
    tenant_id: int | None = None
    target_id: int
    restored_source_ids: list[int]
    restored_assignment_count: int
    rolled_back_at: datetime


MERGE_ROLLBACK_WINDOW_MINUTES = 15
_catalog_merge_rollback_cache: dict[str, dict[str, Any]] = {}


class DemoWorkspaceOut(BaseModel):
    key: str
    workspace_type: Literal["supplier_demo", "strategic_demo", "partner_demo"]
    title: str
    scenario: str
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    commission_preview: str | None = None
    related_company_count: int = 0
    related_supplier_count: int = 0
    is_active: bool = True


DEFAULT_TENANT_DEPARTMENT_SEED = [
    (
        "Hammadde Satın Alma",
        "Uretim, stok ve operasyon icin kritik hammadde alimlarini yonetir.",
    ),
    (
        "Endirek Satın Alma",
        "Ofis, hizmet, genel gider ve destek kalemleri alimlarini yonetir.",
    ),
    (
        "Ticari Satın Alma",
        "Ticari urun, kategori ve satis odakli alim planlarini yonetir.",
    ),
    (
        "Teknik Satın Alma",
        "Makine, ekipman, teknik sartname ve proje bagli alimlari yonetir.",
    ),
]

DEFAULT_TENANT_ROLE_SEED = [
    {
        "name": "Satın Alma Admin",
        "description": "Tenant icindeki rol, departman, personel ve satin alma operasyon kataloglarini yonetir.",
        "hierarchy_level": 0,
        "permissions": [
            "create:personnel",
            "read:personnel",
            "update:personnel",
            "delete:personnel",
            "create:department",
            "read:department",
            "update:department",
            "delete:department",
            "create:company",
            "read:company",
            "update:company",
            "delete:company",
            "create:project",
            "read:project",
            "update:project",
            "delete:project",
            "create:role",
            "read:role",
            "update:role",
            "delete:role",
            "create:quote",
            "read:quote",
            "update:quote",
            "delete:quote",
            "approve:quote",
        ],
    },
    {
        "name": "Satın Alma Direktörü",
        "description": "Satın alma stratejisini, approval yapisini ve kritik karar noktalarini sahiplenir.",
        "hierarchy_level": 1,
        "permissions": [
            "read:personnel",
            "read:department",
            "read:company",
            "read:project",
            "read:role",
            "create:quote",
            "read:quote",
            "update:quote",
            "approve:quote",
            "create:project",
            "update:project",
        ],
    },
    {
        "name": "Satın Alma Müdürü",
        "description": "Kategori ekiplerini yonetir, proje ve teklif akislarini takip eder.",
        "hierarchy_level": 2,
        "permissions": [
            "read:personnel",
            "read:department",
            "read:company",
            "read:project",
            "create:quote",
            "read:quote",
            "update:quote",
            "approve:quote",
            "create:project",
            "update:project",
        ],
    },
    {
        "name": "Satın Alma Müdür Yardımcısı",
        "description": "Mudur adina operasyonu koordine eder ve ekip akislarini destekler.",
        "hierarchy_level": 3,
        "permissions": [
            "read:personnel",
            "read:department",
            "read:company",
            "read:project",
            "create:quote",
            "read:quote",
            "update:quote",
            "approve:quote",
        ],
    },
    {
        "name": "Satın Alma Yöneticisi",
        "description": "Gunluk satin alma taleplerini, teklif toplama ve degerlendirme surecini yonetir.",
        "hierarchy_level": 4,
        "permissions": [
            "read:department",
            "read:company",
            "read:project",
            "create:quote",
            "read:quote",
            "update:quote",
            "approve:quote",
        ],
    },
    {
        "name": "Satın Alma Kıdemli Uzmanı",
        "description": "Kritik teklif ve tedarikci degerlendirme sureclerinde uzman rol ustlenir.",
        "hierarchy_level": 5,
        "permissions": [
            "read:department",
            "read:company",
            "read:project",
            "create:quote",
            "read:quote",
            "update:quote",
        ],
    },
    {
        "name": "Satın Alma Uzmanı",
        "description": "Teklif toplama, fiyat karsilastirma ve tedarikci iletisimi operasyonunu yurutur.",
        "hierarchy_level": 6,
        "permissions": [
            "read:department",
            "read:company",
            "read:project",
            "create:quote",
            "read:quote",
            "update:quote",
        ],
    },
    {
        "name": "Satın Alma Personeli",
        "description": "Temel satin alma ve veri girisi adimlarini destekler.",
        "hierarchy_level": 7,
        "permissions": [
            "read:department",
            "read:company",
            "read:project",
            "read:quote",
        ],
    },
]


def _append_onboarding_timeline(
    tenant: Tenant,
    *,
    action: str,
    actor_name: str,
    actor_type: str,
    note: str | None = None,
):
    items: list[dict[str, Any]] = []
    if tenant.onboarding_decision_timeline_json:
        try:
            parsed = json.loads(tenant.onboarding_decision_timeline_json)
            if isinstance(parsed, list):
                items = [item for item in parsed if isinstance(item, dict)]
        except (TypeError, ValueError):
            items = []
    items.append(
        {
            "action": action,
            "actor_name": actor_name,
            "actor_type": actor_type,
            "note": note,
            "at": utcnow().isoformat(),
        }
    )
    tenant.onboarding_decision_timeline_json = json.dumps(items[-20:])


def _read_onboarding_timeline(tenant: Tenant) -> list[dict[str, Any]]:
    if not tenant.onboarding_decision_timeline_json:
        return []
    try:
        parsed = json.loads(tenant.onboarding_decision_timeline_json)
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
    except (TypeError, ValueError):
        return []
    return []


def _read_json_string_list(raw_value: str | None) -> list[str]:
    if not raw_value:
        return []
    try:
        parsed = json.loads(raw_value)
    except (TypeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []
    items: list[str] = []
    seen: set[str] = set()
    for value in parsed:
        item = str(value or "").strip()
        if not item:
            continue
        key = item.casefold()
        if key in seen:
            continue
        seen.add(key)
        items.append(item)
    return items


def _write_json_string_list(values: list[str]) -> str | None:
    cleaned = _read_json_string_list(json.dumps(values))
    if not cleaned:
        return None
    return json.dumps(cleaned)


def _read_category_requests(tenant: Tenant) -> list[dict[str, Any]]:
    if not tenant.category_requests_json:
        return []
    try:
        parsed = json.loads(tenant.category_requests_json)
    except (TypeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, dict)]


def _write_category_requests(tenant: Tenant, items: list[dict[str, Any]]) -> None:
    tenant.category_requests_json = json.dumps(items) if items else None


def _category_request_key(name: str) -> str:
    return str(name or "").strip().casefold()


def _append_tenant_category(
    tenant: Tenant, category_name: str, *, applies_to: str
) -> None:
    normalized_name = str(category_name or "").strip()
    if not normalized_name:
        return
    if applies_to == "target":
        values = _read_json_string_list(tenant.target_category_tags_json)
        if _category_request_key(normalized_name) not in {
            _category_request_key(item) for item in values
        }:
            values.append(normalized_name)
        tenant.target_category_tags_json = _write_json_string_list(values)
        return

    values = _read_json_string_list(tenant.category_tags_json)
    if _category_request_key(normalized_name) not in {
        _category_request_key(item) for item in values
    }:
        values.append(normalized_name)
    tenant.category_tags_json = _write_json_string_list(values)
    tenant.category = values[0] if values else normalized_name


def _can_activate_onboarding_tenant(tenant: Tenant) -> bool:
    payment_status = str(tenant.onboarding_payment_status or "not_required").lower()
    approval_status = str(tenant.onboarding_approval_status or "not_required").lower()
    return approval_status == "approved" and payment_status in {
        "verified",
        "succeeded",
        "not_required",
    }


def _seed_default_departments_for_tenant(
    db: Session, tenant: Tenant, owner_user_id: int | None
) -> None:
    existing_names = {
        row.name
        for row in db.query(Department).filter(Department.tenant_id == tenant.id).all()
    }
    for name, description in DEFAULT_TENANT_DEPARTMENT_SEED:
        if name in existing_names:
            continue
        db.add(
            Department(
                name=name,
                description=description,
                tenant_id=tenant.id,
                created_by_id=owner_user_id,
                is_active=True,
            )
        )


def _seed_default_roles_for_tenant(
    db: Session, tenant: Tenant, owner_user_id: int | None
) -> None:
    existing_roles = {
        row.name: row
        for row in db.query(Role).filter(Role.tenant_id == tenant.id).all()
    }
    permission_names = {
        permission.name: permission
        for permission in db.query(Permission)
        .filter(
            Permission.name.in_(
                {
                    perm
                    for item in DEFAULT_TENANT_ROLE_SEED
                    for perm in item["permissions"]
                }
            )
        )
        .all()
    }

    parent_role: Role | None = None
    for item in DEFAULT_TENANT_ROLE_SEED:
        if item["name"] in existing_roles:
            parent_role = existing_roles[item["name"]]
            continue

        new_role = Role(
            name=item["name"],
            description=item["description"],
            tenant_id=tenant.id,
            created_by_id=owner_user_id,
            parent_id=parent_role.id if parent_role else None,
            hierarchy_level=item["hierarchy_level"],
            is_active=True,
        )
        resolved_permissions = [
            permission_names[name]
            for name in item["permissions"]
            if name in permission_names
        ]
        if resolved_permissions:
            new_role.permissions = resolved_permissions
        db.add(new_role)
        db.flush()
        existing_roles[new_role.name] = new_role
        parent_role = new_role


def _seed_default_procurement_catalog_for_tenant(
    db: Session, tenant: Tenant, owner_user_id: int | None
) -> None:
    _seed_default_departments_for_tenant(db, tenant, owner_user_id)
    _seed_default_roles_for_tenant(db, tenant, owner_user_id)


DEFAULT_CHANNEL_DEPARTMENT_SEED = [
    (
        "Müşteri Geliştirme",
        "Yeni müşteri ve partner onboarding süreçlerini, referans dönüşüm takibini yönetir.",
    ),
    (
        "Operasyon",
        "Günlük operasyon koordinasyonu, partner destek süreçleri ve iş akışlarını yönetir.",
    ),
    (
        "Satış ve Büyüme",
        "Kanal büyüme stratejisi, yeni fırsat geliştirme ve satış hedeflerini sahiplenir.",
    ),
    (
        "Finans ve Raporlama",
        "Komisyon takibi, finansal mutabakat ve kanal performans raporlamasını yürütür.",
    ),
]

DEFAULT_CHANNEL_ROLE_SEED = [
    {
        "name": "Kanal Hesap Sahibi",
        "description": "Kanal organizasyonunu tümüyle yönetir; ekip, departman ve raporlama üzerinde tam yetkiye sahiptir.",
        "hierarchy_level": 0,
        "permissions": [
            "create:personnel",
            "read:personnel",
            "update:personnel",
            "delete:personnel",
            "create:department",
            "read:department",
            "update:department",
            "delete:department",
            "create:company",
            "read:company",
            "update:company",
            "delete:company",
            "create:role",
            "read:role",
            "update:role",
            "delete:role",
        ],
    },
    {
        "name": "Kanal Ekip Lideri",
        "description": "Ekip koordinasyonunu yönetir, kanal temsilcilerinin performansını takip eder.",
        "hierarchy_level": 1,
        "permissions": [
            "read:personnel",
            "create:personnel",
            "update:personnel",
            "read:department",
            "read:company",
            "read:role",
        ],
    },
    {
        "name": "Kanal Temsilcisi",
        "description": "Müşteri yönlendirme ve onboarding destek operasyonlarını yürütür.",
        "hierarchy_level": 2,
        "permissions": [
            "read:personnel",
            "read:department",
            "read:company",
        ],
    },
    {
        "name": "Kanal Finans Görüntüleyici",
        "description": "Komisyon raporlarını ve finansal özeti salt okunur olarak görüntüler.",
        "hierarchy_level": 3,
        "permissions": [
            "read:personnel",
            "read:department",
            "read:company",
        ],
    },
    {
        "name": "Kanal Denetçisi",
        "description": "Kanal operasyonlarını ve komisyon kayıtlarını denetleme amacıyla okur.",
        "hierarchy_level": 4,
        "permissions": [
            "read:personnel",
            "read:department",
            "read:company",
        ],
    },
]


def _seed_default_channel_catalog_for_tenant(
    db: Session, tenant: Tenant, owner_user_id: int | None
) -> None:
    existing_dept_names = {
        row.name
        for row in db.query(Department).filter(Department.tenant_id == tenant.id).all()
    }
    for name, description in DEFAULT_CHANNEL_DEPARTMENT_SEED:
        if name in existing_dept_names:
            continue
        db.add(
            Department(
                name=name,
                description=description,
                tenant_id=tenant.id,
                created_by_id=owner_user_id,
                is_active=True,
            )
        )

    existing_roles = {
        row.name: row
        for row in db.query(Role).filter(Role.tenant_id == tenant.id).all()
    }
    permission_names = {
        permission.name: permission
        for permission in db.query(Permission)
        .filter(
            Permission.name.in_(
                {
                    perm
                    for item in DEFAULT_CHANNEL_ROLE_SEED
                    for perm in item["permissions"]
                }
            )
        )
        .all()
    }

    parent_role: Role | None = None
    for item in DEFAULT_CHANNEL_ROLE_SEED:
        if item["name"] in existing_roles:
            parent_role = existing_roles[item["name"]]
            continue

        new_role = Role(
            name=item["name"],
            description=item["description"],
            tenant_id=tenant.id,
            created_by_id=owner_user_id,
            parent_id=parent_role.id if parent_role else None,
            hierarchy_level=item["hierarchy_level"],
            is_active=True,
        )
        resolved_permissions = [
            permission_names[name]
            for name in item["permissions"]
            if name in permission_names
        ]
        if resolved_permissions:
            new_role.permissions = resolved_permissions
        db.add(new_role)
        db.flush()
        existing_roles[new_role.name] = new_role
        parent_role = new_role


def _ensure_channel_workspace_tenant(db: Session, current_user: User) -> Tenant:
    """Kanal sahibi kullanici icin tenant yoksa bireysel workspace tenant olusturur."""
    tenant_id = getattr(current_user, "tenant_id", None)
    if isinstance(tenant_id, int):
        existing = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if existing:
            return existing

    owned_tenant = (
        db.query(Tenant).filter(Tenant.owner_user_id == current_user.id).first()
    )
    if owned_tenant:
        current_user.tenant_id = owned_tenant.id
        db.add(current_user)
        db.flush()
        return owned_tenant

    base_name = (
        current_user.full_name or current_user.email or "Kanal Kullanici"
    ).strip()
    legal_name = f"{base_name} Kisisel Is Ortagi Workspace"
    slug = _ensure_unique_tenant_slug(db, _slugify_tenant(legal_name))

    tenant = Tenant(
        slug=slug,
        legal_name=legal_name,
        brand_name=(current_user.full_name or "Kisisel Is Ortagi").strip(),
        category="Bireysel Is Ortagi",
        subscription_plan_code="starter",
        owner_user_id=current_user.id,
        status="active",
        onboarding_status="bootstrap_completed",
        onboarding_payment_status="not_required",
        onboarding_approval_status="not_required",
        is_active=True,
    )
    db.add(tenant)
    db.flush()

    ensure_tenant_subscription_for_plan(
        db,
        tenant,
        subscription_plan_code=tenant.subscription_plan_code or "starter",
        status_value="active",
    )

    db.add(
        TenantSettings(
            tenant_id=tenant.id,
            smtp_mode="platform_default",
            locale="tr-TR",
            timezone="Europe/Istanbul",
            is_active=True,
        )
    )

    current_user.tenant_id = tenant.id
    db.add(current_user)
    db.flush()
    return tenant


def _ensure_channel_workspace_company(
    db: Session,
    tenant: Tenant,
    owner_user_id: int | None,
) -> Company:
    existing = (
        db.query(Company)
        .filter(Company.tenant_id == tenant.id)
        .order_by(Company.is_primary.desc(), Company.id.asc())
        .first()
    )
    if existing:
        return existing

    base_name = (tenant.brand_name or tenant.legal_name or "Kanal Workspace").strip()
    company_name = f"{base_name} Workspace"
    if (
        db.query(Company)
        .filter(Company.tenant_id == tenant.id, Company.name == company_name)
        .first()
    ):
        company_name = f"{base_name} Kisisel Workspace"

    company = Company(
        name=company_name,
        description="Kanal workspace icin rol/departman atama firmasi",
        color="#3b82f6",
        is_active=True,
        is_primary=True,
        tenant_id=tenant.id,
        created_by_id=owner_user_id,
    )
    db.add(company)
    db.flush()
    return company


def _ensure_assoc_user_company(db: Session, user_id: int, company_id: int) -> None:
    exists = db.execute(
        user_company.select().where(
            and_(
                user_company.c.user_id == user_id,
                user_company.c.company_id == company_id,
            )
        )
    ).first()
    if not exists:
        db.execute(user_company.insert().values(user_id=user_id, company_id=company_id))


def _is_demo_tenant(tenant: Tenant) -> bool:
    bucket_parts = [
        tenant.slug or "",
        tenant.legal_name or "",
        tenant.brand_name or "",
        tenant.category or "",
        tenant.subscription_plan_code or "",
    ]
    bucket_parts.extend(_read_json_string_list(tenant.category_tags_json))
    bucket_parts.extend(_read_json_string_list(tenant.target_category_tags_json))
    normalized = " ".join(str(part) for part in bucket_parts if part).strip().lower()
    return "demo" in normalized


def _ensure_assoc_company_department(
    db: Session, company_id: int, department_id: int
) -> None:
    exists = db.execute(
        company_department.select().where(
            and_(
                company_department.c.company_id == company_id,
                company_department.c.department_id == department_id,
            )
        )
    ).first()
    if not exists:
        db.execute(
            company_department.insert().values(
                company_id=company_id,
                department_id=department_id,
            )
        )


def _ensure_assoc_user_department(
    db: Session, user_id: int, department_id: int
) -> None:
    exists = db.execute(
        user_department.select().where(
            and_(
                user_department.c.user_id == user_id,
                user_department.c.department_id == department_id,
            )
        )
    ).first()
    if not exists:
        db.execute(
            user_department.insert().values(
                user_id=user_id,
                department_id=department_id,
            )
        )


def _ensure_assoc_user_company_role(
    db: Session, user_id: int, company_id: int, role_id: int
) -> None:
    exists = db.execute(
        user_company_roles.select().where(
            and_(
                user_company_roles.c.user_id == user_id,
                user_company_roles.c.company_id == company_id,
                user_company_roles.c.role_id == role_id,
            )
        )
    ).first()
    if not exists:
        db.execute(
            user_company_roles.insert().values(
                user_id=user_id,
                company_id=company_id,
                role_id=role_id,
            )
        )


def _seed_default_channel_personnel_for_tenant(
    db: Session,
    tenant: Tenant,
    owner_user_id: int,
    *,
    email_domain: str = "buyerasistans.com.tr",
    default_password: str = "Aa1234!!",
) -> list[str]:
    role_rows = (
        db.query(Role)
        .filter(Role.tenant_id == tenant.id, Role.is_active.is_(True))
        .all()
    )
    dept_rows = (
        db.query(Department)
        .filter(Department.tenant_id == tenant.id, Department.is_active.is_(True))
        .all()
    )
    role_by_name = {row.name: row for row in role_rows}
    dept_by_name = {row.name: row for row in dept_rows}

    company = _ensure_channel_workspace_company(db, tenant, owner_user_id)

    personnel_specs = [
        {
            "name": "Kanal Ekip Lideri",
            "local": f"channel.{tenant.slug}.lead",
            "role": "channel_agent",
            "role_profile_code": "channel.team_lead",
            "catalog_role": "Kanal Ekip Lideri",
            "department": "Operasyon",
        },
        {
            "name": "Kanal Temsilcisi",
            "local": f"channel.{tenant.slug}.agent",
            "role": "channel_agent",
            "role_profile_code": "channel.agent",
            "catalog_role": "Kanal Temsilcisi",
            "department": "Satis ve Buyume",
        },
        {
            "name": "Kanal Finans Izleyici",
            "local": f"channel.{tenant.slug}.finance",
            "role": "channel_agent",
            "role_profile_code": "channel.finance_viewer",
            "catalog_role": "Kanal Finans Goruntuleyici",
            "department": "Finans ve Raporlama",
        },
        {
            "name": "Kanal Denetci",
            "local": f"channel.{tenant.slug}.audit",
            "role": "channel_agent",
            "role_profile_code": "channel.auditor",
            "catalog_role": "Kanal Denetcisi",
            "department": "Musteri Gelistirme",
        },
    ]

    seeded_emails: list[str] = []
    hashed_password = get_password_hash(default_password)

    for spec in personnel_specs:
        email = f"{spec['local']}@{email_domain}".lower()
        seeded_emails.append(email)
        department = dept_by_name.get(spec["department"])
        catalog_role = role_by_name.get(spec["catalog_role"])

        user_row = db.query(User).filter(User.email == email).first()
        if user_row is None:
            user_row = User(
                email=email,
                full_name=spec["name"],
                hashed_password=hashed_password,
                role=str(spec["role"]),
                system_role="tenant_member",
                approval_limit=0,
                tenant_id=tenant.id,
                created_by_id=owner_user_id,
                department_id=department.id if department else None,
                is_active=True,
                hidden_from_admin=False,
                deleted_original_email=None,
                invitation_token=None,
                invitation_token_expires=None,
                invitation_accepted=True,
                scope_type="channel",
                role_profile_code=str(spec["role_profile_code"]),
            )
            db.add(user_row)
            db.flush()
        else:
            user_row.full_name = spec["name"]
            user_row.hashed_password = hashed_password
            user_row.role = str(spec["role"])
            user_row.system_role = "tenant_member"
            user_row.approval_limit = 0
            user_row.tenant_id = tenant.id
            user_row.created_by_id = owner_user_id
            user_row.department_id = department.id if department else None
            user_row.is_active = True
            user_row.hidden_from_admin = False
            user_row.deleted_original_email = None
            user_row.invitation_token = None
            user_row.invitation_token_expires = None
            user_row.invitation_accepted = True
            user_row.scope_type = "channel"
            user_row.role_profile_code = str(spec["role_profile_code"])
            db.add(user_row)
            db.flush()

        _ensure_assoc_user_company(db, user_row.id, company.id)
        if department is not None:
            _ensure_assoc_company_department(db, company.id, department.id)
            _ensure_assoc_user_department(db, user_row.id, department.id)

        if catalog_role is not None:
            assignment = (
                db.query(CompanyRole)
                .filter(
                    CompanyRole.tenant_id == tenant.id,
                    CompanyRole.user_id == user_row.id,
                    CompanyRole.company_id == company.id,
                )
                .first()
            )
            if assignment is None:
                assignment = CompanyRole(
                    tenant_id=tenant.id,
                    user_id=user_row.id,
                    company_id=company.id,
                    role_id=catalog_role.id,
                    department_id=department.id if department else None,
                    is_active=True,
                )
                db.add(assignment)
            else:
                assignment.role_id = catalog_role.id
                assignment.department_id = department.id if department else None
                assignment.is_active = True
                db.add(assignment)

            _ensure_assoc_user_company_role(
                db, user_row.id, company.id, catalog_role.id
            )

    owner = db.query(User).filter(User.id == owner_user_id).first()
    if owner is not None:
        owner.scope_type = "channel"
        owner.role_profile_code = owner.role_profile_code or "channel.account_owner"
        owner.tenant_id = tenant.id
        db.add(owner)
        db.flush()
        _ensure_assoc_user_company(db, owner.id, company.id)

    return seeded_emails


def _extract_ids(rows: list[tuple[int] | int]) -> list[int]:
    values: list[int] = []
    for row in rows:
        if isinstance(row, int):
            values.append(int(row))
            continue
        values.append(int(row[0]))
    return values


def _purge_tenant_workspace(db: Session, tenant: Tenant) -> None:
    tenant.owner_user_id = None
    tenant.onboarding_approved_by_user_id = None
    tenant.onboarding_rejected_by_user_id = None
    db.flush()

    user_ids = _extract_ids(db.query(User.id).filter(User.tenant_id == tenant.id).all())
    company_ids = _extract_ids(
        db.query(Company.id).filter(Company.tenant_id == tenant.id).all()
    )
    department_ids = _extract_ids(
        db.query(Department.id).filter(Department.tenant_id == tenant.id).all()
    )
    role_ids = _extract_ids(db.query(Role.id).filter(Role.tenant_id == tenant.id).all())
    project_ids = _extract_ids(
        db.query(Project.id).filter(Project.tenant_id == tenant.id).all()
    )
    quote_ids = _extract_ids(
        db.query(Quote.id).filter(Quote.tenant_id == tenant.id).all()
    )
    supplier_ids = _extract_ids(
        db.query(Supplier.id).filter(Supplier.tenant_id == tenant.id).all()
    )
    supplier_quote_ids = _extract_ids(
        db.query(SupplierQuote.id)
        .join(Quote, SupplierQuote.quote_id == Quote.id)
        .filter(Quote.tenant_id == tenant.id)
        .all()
    )

    if user_ids:
        db.execute(
            delete(user_managers).where(
                or_(
                    user_managers.c.user_id.in_(user_ids),
                    user_managers.c.manager_id.in_(user_ids),
                )
            )
        )
        db.execute(delete(APIKey).where(APIKey.user_id.in_(user_ids)))
        db.execute(delete(RefreshToken).where(RefreshToken.user_id.in_(user_ids)))
        db.execute(
            delete(UserPermissionOverride).where(
                or_(
                    UserPermissionOverride.user_id.in_(user_ids),
                    UserPermissionOverride.granted_by_user_id.in_(user_ids),
                )
            )
        )
        db.execute(
            delete(RolePermissionDelegation).where(
                RolePermissionDelegation.created_by_user_id.in_(user_ids)
            )
        )

    if quote_ids:
        session_predicates = [DiscoveryLabSession.procurement_quote_id.in_(quote_ids)]
        if project_ids:
            session_predicates.append(
                DiscoveryLabSession.selected_project_id.in_(project_ids)
            )
        db.execute(delete(QuoteStatusLog).where(QuoteStatusLog.quote_id.in_(quote_ids)))
        db.execute(
            delete(QuoteComparison).where(QuoteComparison.quote_id.in_(quote_ids))
        )
        db.execute(delete(PriceAnalysis).where(PriceAnalysis.quote_id.in_(quote_ids)))
        db.execute(delete(SupplierRating).where(SupplierRating.quote_id.in_(quote_ids)))
        db.execute(delete(DiscoveryLabSession).where(or_(*session_predicates)))

    if supplier_quote_ids:
        db.execute(
            delete(Contract).where(Contract.supplier_quote_id.in_(supplier_quote_ids))
        )

    if supplier_ids:
        db.execute(delete(Contract).where(Contract.supplier_id.in_(supplier_ids)))
        db.execute(
            delete(SupplierRating).where(SupplierRating.supplier_id.in_(supplier_ids))
        )

    if quote_ids:
        db.execute(delete(Contract).where(Contract.quote_id.in_(quote_ids)))

    if user_ids or company_ids or role_ids or department_ids:
        company_role_predicates = [CompanyRole.tenant_id == tenant.id]
        if user_ids:
            company_role_predicates.append(CompanyRole.user_id.in_(user_ids))
        if company_ids:
            company_role_predicates.append(CompanyRole.company_id.in_(company_ids))
        if role_ids:
            company_role_predicates.append(CompanyRole.role_id.in_(role_ids))
        if department_ids:
            company_role_predicates.append(
                CompanyRole.department_id.in_(department_ids)
            )
        db.execute(delete(CompanyRole).where(or_(*company_role_predicates)))

    if user_ids or project_ids:
        project_permission_predicates = []
        if user_ids:
            project_permission_predicates.extend(
                [
                    ProjectPermission.user_id.in_(user_ids),
                    ProjectPermission.granted_by_id.in_(user_ids),
                ]
            )
        if project_ids:
            project_permission_predicates.append(
                ProjectPermission.project_id.in_(project_ids)
            )
        if project_permission_predicates:
            db.execute(
                delete(ProjectPermission).where(or_(*project_permission_predicates))
            )

    if user_ids:
        db.execute(delete(user_company).where(user_company.c.user_id.in_(user_ids)))
        db.execute(
            delete(user_department).where(user_department.c.user_id.in_(user_ids))
        )
        db.execute(
            delete(user_company_roles).where(user_company_roles.c.user_id.in_(user_ids))
        )
        db.execute(
            delete(user_project_permissions).where(
                user_project_permissions.c.user_id.in_(user_ids)
            )
        )
        db.execute(delete(user_projects).where(user_projects.c.user_id.in_(user_ids)))

    if company_ids:
        db.execute(
            delete(company_department).where(
                company_department.c.company_id.in_(company_ids)
            )
        )
        db.execute(
            delete(user_company).where(user_company.c.company_id.in_(company_ids))
        )
        db.execute(
            delete(user_company_roles).where(
                user_company_roles.c.company_id.in_(company_ids)
            )
        )

    if department_ids:
        db.execute(
            delete(company_department).where(
                company_department.c.department_id.in_(department_ids)
            )
        )
        db.execute(
            delete(user_department).where(
                user_department.c.department_id.in_(department_ids)
            )
        )
        db.query(User).filter(User.department_id.in_(department_ids)).update(
            {User.department_id: None}, synchronize_session=False
        )

    if role_ids:
        db.execute(
            delete(user_company_roles).where(user_company_roles.c.role_id.in_(role_ids))
        )
        db.execute(
            delete(role_permissions).where(role_permissions.c.role_id.in_(role_ids))
        )

    if project_ids:
        db.execute(
            delete(user_projects).where(user_projects.c.project_id.in_(project_ids))
        )
        db.execute(
            delete(user_project_permissions).where(
                user_project_permissions.c.project_id.in_(project_ids)
            )
        )

    db.execute(
        delete(BillingWebhookEvent).where(BillingWebhookEvent.tenant_id == tenant.id)
    )
    db.execute(delete(BillingInvoice).where(BillingInvoice.tenant_id == tenant.id))
    db.execute(
        delete(TenantSubscription).where(TenantSubscription.tenant_id == tenant.id)
    )
    db.execute(delete(EmailSettings).where(EmailSettings.tenant_id == tenant.id))
    db.execute(delete(SystemEmail).where(SystemEmail.tenant_id == tenant.id))
    db.execute(delete(TenantSettings).where(TenantSettings.tenant_id == tenant.id))
    db.execute(
        delete(TenantPremiumFeature).where(TenantPremiumFeature.tenant_id == tenant.id)
    )
    db.execute(
        delete(CardVerificationTransaction).where(
            CardVerificationTransaction.tenant_id == tenant.id
        )
    )
    db.execute(
        delete(TenantTrialPeriod).where(TenantTrialPeriod.tenant_id == tenant.id)
    )
    db.execute(
        delete(BusinessPartnerCommission).where(
            or_(
                BusinessPartnerCommission.business_partner_tenant_id == tenant.id,
                BusinessPartnerCommission.referred_supplier_tenant_id == tenant.id,
            )
        )
    )
    db.execute(
        delete(BusinessPartnerLedger).where(
            BusinessPartnerLedger.business_partner_tenant_id == tenant.id
        )
    )
    db.query(PaymentTransaction).filter(
        PaymentTransaction.tenant_id == tenant.id
    ).update({PaymentTransaction.tenant_id: None}, synchronize_session=False)

    for supplier in db.query(Supplier).filter(Supplier.tenant_id == tenant.id).all():
        db.delete(supplier)
    for project in db.query(Project).filter(Project.tenant_id == tenant.id).all():
        db.delete(project)
    for company in db.query(Company).filter(Company.tenant_id == tenant.id).all():
        db.delete(company)
    for role in db.query(Role).filter(Role.tenant_id == tenant.id).all():
        db.delete(role)
    for department in (
        db.query(Department).filter(Department.tenant_id == tenant.id).all()
    ):
        db.delete(department)
    for user in db.query(User).filter(User.tenant_id == tenant.id).all():
        db.delete(user)


CRITICAL_PERMISSION_KEYS = {
    "admin_surface",
    "admin_surface.user_create",
    "admin_surface.user_edit",
    "admin_surface.user_disable",
    "admin_surface.user_delete",
    "manage_users",
    "tenant_governance_write",
    "tenant_governance_write.detail_edit",
    "support_workflow",
    "shared_email",
    "org_catalog.roles.manage",
    "org_catalog.departments.manage",
}

CATALOG_ROLE_MANAGE_PERMISSION_KEY = "org_catalog.roles.manage"
CATALOG_DEPARTMENT_MANAGE_PERMISSION_KEY = "org_catalog.departments.manage"

WORKSPACE_PANEL_ALLOWED_TABS = {
    "panel_home",
    "panel_designer",
    "platform_overview",
    "platform_operations",
    "discovery_lab_operations",
    "onboarding_studio",
    "tenant_governance",
    "packages",
    "platform_analytics",
    "platform_suppliers",
    "public_pricing",
    "campaigns",
    "companies",
    "roles",
    "departments",
    "personnel",
    "projects",
    "suppliers",
    "approvals",
    "reports",
    "settings",
}


def _workspace_panel_profile_key(
    business_role: str, system_role: str | None = None
) -> str:
    return (
        f"{(business_role or '').strip().lower()}:{(system_role or '').strip().lower()}"
    )


def _normalize_workspace_panel_role_key(value: str | None) -> str:
    return (
        str(value or "")
        .strip()
        .lower()
        .replace("ı", "i")
        .replace("ğ", "g")
        .replace("ü", "u")
        .replace("ş", "s")
        .replace("ö", "o")
        .replace("ç", "c")
        .replace(".", "")
        .replace(" ", "_")
    )


def _workspace_panel_role_label(value: str | None) -> str:
    normalized = _normalize_workspace_panel_role_key(value)
    if not normalized:
        return "Yeni Rol"
    return " ".join(part.capitalize() for part in normalized.split("_") if part)


def _default_workspace_panel_quick_links(
    business_role: str,
) -> list[WorkspacePanelQuickLink]:
    normalized = _normalize_workspace_panel_role_key(business_role)
    if normalized in {"supplier_admin", "supplier_user"}:
        return [
            WorkspacePanelQuickLink(
                label="Tedarikci Workspace",
                href="/supplier/workspace?tab=offers",
                description="Teklif, belge ve operasyon islerinizi supplier workspace uzerinden yonetin.",
            ),
            WorkspacePanelQuickLink(
                label="Tedarikci Dashboard",
                href="/supplier/dashboard",
                description="Tedarikci ozet ekranina gidin.",
            ),
            WorkspacePanelQuickLink(
                label="Finans Modulu",
                href="/supplier/finance",
                description="Finans ve odeme ozetlerini inceleyin.",
            ),
        ]

    if normalized in {"channel_owner", "channel_agent"}:
        return [
            WorkspacePanelQuickLink(
                label="Is Ortagi Programi",
                href="/is-ortagi-programi",
                description="Kanal programi kapsamindaki akislari inceleyin.",
            ),
            WorkspacePanelQuickLink(
                label="Programa Basvuru",
                href="/is-ortagi-basvuru",
                description="Kanal / komisyon programi basvuru akisini acin.",
            ),
            WorkspacePanelQuickLink(
                label="Public Fiyatlandirma",
                href="/fiyatlandirma",
                description="Kanal teklif kurgusu icin guncel planlari gorun.",
            ),
        ]

    if normalized in {"manager", "satinalma_direktoru"}:
        return [
            WorkspacePanelQuickLink(
                label="Dashboard",
                href="/dashboard",
                description="Rol ozetinizi ve anlik kartlari gorun.",
            ),
            WorkspacePanelQuickLink(
                label="Teklifler",
                href="/quotes",
                description="Teklif ve satin alma akislarina gidin.",
            ),
            WorkspacePanelQuickLink(
                label="Raporlar",
                href="/reports",
                description="Rol bazli raporlari acin.",
            ),
        ]

    return [
        WorkspacePanelQuickLink(
            label="Dashboard",
            href="/dashboard",
            description="Genel calisma alanina donun.",
        ),
        WorkspacePanelQuickLink(
            label="Teklifler",
            href="/quotes",
            description="Teklif sureclerini acin.",
        ),
        WorkspacePanelQuickLink(
            label="Raporlar",
            href="/reports",
            description="Yetkiniz varsa raporlari inceleyin.",
        ),
    ]


def _build_default_workspace_panel_profile(
    business_role: str,
    system_role: str | None = "tenant_member",
    *,
    role_label: str | None = None,
) -> WorkspacePanelProfile:
    normalized_role = _normalize_workspace_panel_role_key(business_role)
    label = role_label or _workspace_panel_role_label(business_role)
    return WorkspacePanelProfile(
        business_role=normalized_role,
        system_role=(system_role or "").strip().lower() or None,
        title=f"{label} Paneli",
        nav_label=label,
        workspace_label=f"{label} Calisma Alani",
        description=f"{label} rolune ait ayri panel; varsayilan olarak ozet ve yonlendirme deneyimi sunar.",
        hero_title=f"{label} Paneli",
        hero_description=f"{label} rolunun panel akislarini bu calisma alanindan yonetin.",
        allowed_tabs=["panel_home"],
        quick_links=_default_workspace_panel_quick_links(normalized_role),
    )


def _ensure_workspace_panel_profile_for_role(
    db: Session,
    current_user: User,
    role_name: str,
) -> None:
    business_role = _normalize_workspace_panel_role_key(role_name)
    if not business_role:
        return

    settings = _get_or_create_system_settings(db)
    config = _parse_workspace_panel_config(
        getattr(settings, "workspace_panels_json", None)
    )
    profile_key = _workspace_panel_profile_key(business_role, "tenant_member")
    if any(
        _workspace_panel_profile_key(item.business_role, item.system_role)
        == profile_key
        for item in config.profiles
    ):
        return

    config.profiles.append(
        _build_default_workspace_panel_profile(
            business_role,
            "tenant_member",
            role_label=_workspace_panel_role_label(role_name),
        )
    )
    _validate_workspace_panel_config(config)
    settings.workspace_panels_json = _serialize_workspace_panel_config(config)
    settings.updated_by_id = current_user.id
    db.add(settings)
    db.commit()


def _default_workspace_panel_config() -> WorkspacePanelConfig:
    return WorkspacePanelConfig(
        version=1,
        profiles=[
            WorkspacePanelProfile(
                business_role="super_admin",
                system_role="super_admin",
                title="Super Admin Paneli",
                nav_label="Super Admin",
                workspace_label="Platform Kontrol Merkezi",
                description="Platform genelindeki tum yonetim alanlari, tenant governance ve panel tasarimi bu panelden yonetilir.",
                hero_title="Super Admin Paneli • Platform Kontrol Merkezi",
                hero_description="Platform operasyonlari, stratejik partner gecisi, rol panelleri ve global ayarlar bu panel altinda birlestirilir.",
                allowed_tabs=[
                    "panel_home",
                    "platform_overview",
                    "platform_operations",
                    "discovery_lab_operations",
                    "onboarding_studio",
                    "tenant_governance",
                    "packages",
                    "platform_analytics",
                    "platform_suppliers",
                    "public_pricing",
                    "campaigns",
                    "companies",
                    "roles",
                    "departments",
                    "personnel",
                    "projects",
                    "suppliers",
                    "approvals",
                    "reports",
                    "settings",
                    "panel_designer",
                ],
                quick_links=_default_workspace_panel_quick_links("super_admin"),
            ),
            WorkspacePanelProfile(
                business_role="admin",
                system_role="tenant_owner",
                title="Stratejik Ortak Admin Paneli",
                nav_label="Ortak Admin",
                workspace_label="Stratejik Ortak Sahiplik Alani",
                description="Tenant sahipligi, organizasyon omurgasi ve yonetsel operasyonlar icin ayri panel profili.",
                hero_title="Stratejik Ortak Admin Paneli",
                hero_description="Firma, personel, rol, proje ve tedarikci operasyonlarini tenant odakli olarak yonetin.",
                allowed_tabs=[
                    "panel_home",
                    "companies",
                    "roles",
                    "departments",
                    "personnel",
                    "projects",
                    "suppliers",
                    "approvals",
                    "reports",
                    "settings",
                ],
                quick_links=_default_workspace_panel_quick_links("admin"),
            ),
            WorkspacePanelProfile(
                business_role="admin",
                system_role="tenant_admin",
                title="Admin Paneli",
                nav_label="Admin",
                workspace_label="Tenant Yonetim Alani",
                description="Geleneksel tenant admin calisma alani; personel, rol ve operasyon sekmeleri bu profilde toplaniyor.",
                hero_title="Admin Paneli • Tenant Yonetim Alani",
                hero_description="Kendi tenant yapinizin personel, rol, departman ve operasyon alanlarini yonetin.",
                allowed_tabs=[
                    "panel_home",
                    "companies",
                    "roles",
                    "departments",
                    "personnel",
                    "projects",
                    "suppliers",
                    "approvals",
                    "reports",
                    "settings",
                ],
                quick_links=_default_workspace_panel_quick_links("admin"),
            ),
            WorkspacePanelProfile(
                business_role="platform_support",
                system_role="platform_support",
                title="Platform Destek Paneli",
                nav_label="Platform Destek",
                workspace_label="Platform Destek Alani",
                description="Platform destek ekipleri icin ayrilmis operasyon ve governance paneli.",
                hero_title="Platform Destek Paneli",
                hero_description="Destek kuyruklari, tenant governance ve discovery odaklarini destek perspektifinden yonetin.",
                allowed_tabs=[
                    "panel_home",
                    "platform_overview",
                    "platform_operations",
                    "discovery_lab_operations",
                    "onboarding_studio",
                    "tenant_governance",
                    "companies",
                    "roles",
                    "departments",
                    "personnel",
                    "projects",
                    "reports",
                    "settings",
                ],
                quick_links=_default_workspace_panel_quick_links("platform_support"),
            ),
            WorkspacePanelProfile(
                business_role="platform_operator",
                system_role="platform_operator",
                title="Platform Operasyon Paneli",
                nav_label="Platform Ops",
                workspace_label="Platform Operasyon Alani",
                description="Platform operasyon ekipleri icin ayrilmis tenant ve destek koordinasyon paneli.",
                hero_title="Platform Operasyon Paneli",
                hero_description="Operasyon kuyruklarini, tenant akislarini ve sorun yonetimini platform operasyon perspektifinden yonetin.",
                allowed_tabs=[
                    "panel_home",
                    "platform_overview",
                    "platform_operations",
                    "discovery_lab_operations",
                    "onboarding_studio",
                    "tenant_governance",
                    "companies",
                    "roles",
                    "departments",
                    "personnel",
                    "projects",
                    "reports",
                    "settings",
                ],
                quick_links=_default_workspace_panel_quick_links("platform_operator"),
            ),
            WorkspacePanelProfile(
                business_role="manager",
                system_role="tenant_member",
                title="Yonetici Paneli",
                nav_label="Yonetici",
                workspace_label="Yonetici Calisma Alani",
                description="Yonetici rolune ait ayri panel; varsayilan olarak ozet ve yonlendirme ekranlarini icerir.",
                hero_title="Yonetici Paneli",
                hero_description="Ekibinizin onay, teklif ve operasyon akislarina bu panelden yonlenin.",
                allowed_tabs=["panel_home"],
                quick_links=_default_workspace_panel_quick_links("manager"),
            ),
            WorkspacePanelProfile(
                business_role="satinalma_direktoru",
                system_role="tenant_member",
                title="Satin Alma Direktoru Paneli",
                nav_label="Direktor",
                workspace_label="Satin Alma Liderlik Alani",
                description="Satin alma direktorlugu icin ayri panel; varsayilan olarak ozet ve yonlendirme deneyimi sunar.",
                hero_title="Satin Alma Direktoru Paneli",
                hero_description="Onay, karsilastirma ve teklif akislarina yonelik liderlik bakisini bu panelden yonetin.",
                allowed_tabs=["panel_home"],
                quick_links=_default_workspace_panel_quick_links("satinalma_direktoru"),
            ),
            WorkspacePanelProfile(
                business_role="channel_owner",
                system_role="tenant_member",
                title="Kanal Sahibi Paneli",
                nav_label="Kanal Sahibi",
                workspace_label="Kanal Partner Alani",
                description="Kanal hesap sahibine ozel panel; yonlendirme ve rol bazli gelecekteki sekme aktivasyonlari icin hazir.",
                hero_title="Kanal Sahibi Paneli",
                hero_description="Kanal programi, partner yonlendirmeleri ve panel erisimleri bu profilden yonetilir.",
                allowed_tabs=["panel_home"],
                quick_links=_default_workspace_panel_quick_links("channel_owner"),
            ),
            WorkspacePanelProfile(
                business_role="channel_agent",
                system_role="tenant_member",
                title="Kanal Temsilcisi Paneli",
                nav_label="Kanal Temsilcisi",
                workspace_label="Kanal Operasyon Alani",
                description="Kanal temsilcileri icin ayri panel; varsayilan olarak yonlendirme kartlari gosterir.",
                hero_title="Kanal Temsilcisi Paneli",
                hero_description="Kanal operasyonlari ve partner kazanimi akislarina bu panelden ilerleyin.",
                allowed_tabs=["panel_home"],
                quick_links=_default_workspace_panel_quick_links("channel_agent"),
            ),
            WorkspacePanelProfile(
                business_role="supplier_admin",
                system_role="supplier_user",
                title="Tedarikci Yonetici Paneli",
                nav_label="Tedarikci Yoneticisi",
                workspace_label="Tedarikci Yonetim Alani",
                description="Tedarikci yoneticileri icin ayri panel; tedarikci workspace ve finans modullerine yonlendirme sunar.",
                hero_title="Tedarikci Yonetici Paneli",
                hero_description="Tedarikci ekibinizin teklif, belge ve finans akislarini bu panelden yonetin.",
                allowed_tabs=["panel_home"],
                quick_links=_default_workspace_panel_quick_links("supplier_admin"),
            ),
            WorkspacePanelProfile(
                business_role="supplier_user",
                system_role="supplier_user",
                title="Tedarikci Kullanici Paneli",
                nav_label="Tedarikci",
                workspace_label="Tedarikci Calisma Alani",
                description="Tedarikci kullanicilarina ozel panel; rol odakli yonlendirme ve kisitli panel kapsami sunar.",
                hero_title="Tedarikci Kullanici Paneli",
                hero_description="Kendi teklif, belge ve is akisinizi tedarikci panelinden takip edin.",
                allowed_tabs=["panel_home"],
                quick_links=_default_workspace_panel_quick_links("supplier_user"),
            ),
        ],
    )


def _get_or_create_system_settings(db: Session) -> SystemSettings:
    return get_or_create_system_settings(db)


def _merge_workspace_panel_profiles(
    stored: WorkspacePanelConfig,
) -> WorkspacePanelConfig:
    defaults = _default_workspace_panel_config()
    merged: dict[str, WorkspacePanelProfile] = {
        _workspace_panel_profile_key(item.business_role, item.system_role): item
        for item in defaults.profiles
    }
    for item in stored.profiles:
        merged[_workspace_panel_profile_key(item.business_role, item.system_role)] = (
            item
        )
    return WorkspacePanelConfig(version=1, profiles=list(merged.values()))


def _parse_workspace_panel_config(raw_json: str | None) -> WorkspacePanelConfig:
    if not raw_json:
        return _default_workspace_panel_config()
    try:
        parsed = WorkspacePanelConfig.model_validate_json(raw_json)
    except Exception:
        return _default_workspace_panel_config()
    return _merge_workspace_panel_profiles(parsed)


def _serialize_workspace_panel_config(config: WorkspacePanelConfig) -> str:
    return config.model_dump_json()


def _validate_workspace_panel_config(config: WorkspacePanelConfig) -> None:
    seen: set[str] = set()
    for profile in config.profiles:
        profile.business_role = profile.business_role.strip().lower()
        profile.system_role = (profile.system_role or "").strip().lower() or None
        profile.allowed_tabs = [
            item.strip() for item in profile.allowed_tabs if item.strip()
        ]
        profile.quick_links = [
            WorkspacePanelQuickLink(
                label=item.label.strip(),
                href=item.href.strip(),
                description=item.description.strip(),
            )
            for item in profile.quick_links
            if item.label.strip() and item.href.strip() and item.description.strip()
        ]
        if not profile.allowed_tabs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{profile.business_role} rol profili icin en az bir panel sekmesi secilmeli",
            )
        invalid_tabs = [
            item
            for item in profile.allowed_tabs
            if item not in WORKSPACE_PANEL_ALLOWED_TABS
        ]
        if invalid_tabs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Gecersiz panel sekmeleri: {', '.join(sorted(invalid_tabs))}",
            )
        profile_key = _workspace_panel_profile_key(
            profile.business_role, profile.system_role
        )
        if profile_key in seen:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ayni rol profili birden fazla kez tanimlanamaz: {profile_key}",
            )
        seen.add(profile_key)

    sanitized_overrides = []
    for item in config.user_overrides:
        profile_key = (item.profile_key or "").strip().lower()
        user_email = (item.user_email or "").strip().lower() or None
        if not profile_key:
            continue
        if profile_key not in seen:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Override icin gecersiz profil anahtari: {profile_key}",
            )
        if item.user_id is None and not user_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Her user override icin user_id veya user_email gerekli",
            )
        item.profile_key = profile_key
        item.user_email = user_email
        sanitized_overrides.append(item)
    config.user_overrides = sanitized_overrides


PERMISSION_CATALOG_TREE = [
    {
        "key": "workspace_home",
        "label": "Yonetim Ana Sayfasi",
        "description": "Yonetim ozet kartlari ve genel operasyon panelleri.",
        "children": [
            {
                "key": "workspace_home.kpi_cards",
                "label": "KPI Kartlari",
                "description": "Ana KPI kartlarini goruntuleme.",
            },
            {
                "key": "workspace_home.operation_feed",
                "label": "Operasyon Akisi",
                "description": "Son operasyon hareketlerini goruntuleme.",
            },
        ],
    },
    {
        "key": "admin_surface",
        "label": "Yonetim Alani",
        "description": "Kullanici, departman ve yonetim ekranlarina erisim.",
        "children": [
            {
                "key": "admin_surface.user_view",
                "label": "Personel Listeleme",
                "description": "Personel listesi ve detaylarini goruntuleme.",
            },
            {
                "key": "admin_surface.user_create",
                "label": "Personel Olusturma",
                "description": "Yeni personel kaydi acma.",
            },
            {
                "key": "admin_surface.user_edit",
                "label": "Personel Duzenleme",
                "description": "Var olan personel kayitlarini guncelleme.",
            },
            {
                "key": "admin_surface.user_disable",
                "label": "Personel Pasife Alma",
                "description": "Personel kaydini pasif duruma cekme.",
            },
            {
                "key": "admin_surface.user_delete",
                "label": "Personel Silme",
                "description": "Pasif personel kaydini kaldirma.",
            },
        ],
    },
    {
        "key": "manage_users",
        "label": "Kullanici Yonetimi",
        "description": "Rol atama ve kullanici yonetim aksiyonlari.",
        "children": [],
    },
    {
        "key": "org_catalog",
        "label": "Ortak Katalog Yonetimi",
        "description": "Ortak rol ve departman katalogu yonetimi.",
        "children": [
            {
                "key": "org_catalog.roles.manage",
                "label": "Ortak Rol Yonetimi",
                "description": "Ortak rol kataloguna ekleme, guncelleme ve silme.",
            },
            {
                "key": "org_catalog.departments.manage",
                "label": "Ortak Departman Yonetimi",
                "description": "Ortak departman kataloguna ekleme, guncelleme ve silme.",
            },
        ],
    },
    {
        "key": "quote_workspace",
        "label": "Teklif Calisma Alani",
        "description": "Teklif surecleri ve satin alma operasyonlari.",
        "children": [
            {
                "key": "quote_workspace.list",
                "label": "Teklif Listeleme",
                "description": "Teklif listesi ve durumlarini goruntuleme.",
            },
            {
                "key": "quote_workspace.create",
                "label": "Teklif Olusturma",
                "description": "Yeni teklif olusturma.",
            },
            {
                "key": "quote_workspace.edit",
                "label": "Teklif Duzenleme",
                "description": "Mevcut teklif kaydini duzenleme.",
            },
            {
                "key": "quote_workspace.submit_approval",
                "label": "Onaya Gonderme",
                "description": "Teklifi onay surecine gonderme.",
            },
            {
                "key": "quote_workspace.comparison",
                "label": "Teklif Karsilastirma",
                "description": "Teklifleri karsilastirma ekranina erisim.",
            },
        ],
    },
    {
        "key": "approval_review",
        "label": "Onay Inceleme",
        "description": "Onay bekleyen kayitlari inceleme.",
        "children": [],
    },
    {
        "key": "tenant_governance_read",
        "label": "Stratejik Partner Yonetimi (Okuma)",
        "description": "Stratejik partner yonetim kayitlarini goruntuleme.",
        "children": [
            {
                "key": "tenant_governance_read.list",
                "label": "Liste",
                "description": "Stratejik partner listesi ve ozetini goruntuleme.",
            },
            {
                "key": "tenant_governance_read.detail",
                "label": "Detay",
                "description": "Stratejik partner detayini goruntuleme.",
            },
        ],
    },
    {
        "key": "tenant_governance_write",
        "label": "Stratejik Partner Yonetimi (Yazma)",
        "description": "Stratejik partner yonetim kayitlarini guncelleme.",
        "children": [
            {
                "key": "tenant_governance_write.detail_edit",
                "label": "Detay Duzenleme",
                "description": "Stratejik partner detay alanlarini duzenleme.",
            },
        ],
    },
    {
        "key": "support_workflow",
        "label": "Destek Akisi Guncelleme",
        "description": "Destek workflow alanlarina erisim.",
        "children": [],
    },
    {
        "key": "tenant_identity",
        "label": "Stratejik Partner Kimlik Ayarlari",
        "description": "Stratejik partner marka ve kimlik ayarlari.",
        "children": [],
    },
    {
        "key": "shared_email",
        "label": "Ortak E-Posta Profilleri",
        "description": "Platform SMTP/profil yonetimi.",
        "children": [],
    },
]


def _flatten_permission_catalog_keys() -> set[str]:
    keys: set[str] = set()
    for item in PERMISSION_CATALOG_TREE:
        keys.add(item["key"])
        for child in item.get("children", []):
            keys.add(child["key"])
    return keys


def _can_delegate_permission_key(
    db: Session,
    current_user: User,
    permission_key: str,
) -> bool:
    if is_super_admin(current_user):
        return True

    normalized_key = (permission_key or "").strip().lower()
    if not normalized_key:
        return False

    if normalized_key in CRITICAL_PERMISSION_KEYS:
        return False

    existing_rules = (
        db.query(RolePermissionDelegation)
        .filter(RolePermissionDelegation.permission_key == normalized_key)
        .all()
    )

    if existing_rules:
        current_system_role = normalized_system_role(current_user)
        current_business_role = normalized_role(current_user)
        for rule in existing_rules:
            role_match = rule.system_role and rule.system_role == current_system_role
            business_match = (
                rule.business_role and rule.business_role == current_business_role
            )
            if (role_match or business_match) and rule.can_delegate:
                return True
        return False

    return is_tenant_admin(current_user)


def _validate_permission_override_scope(
    db: Session,
    current_user: User,
    target_user: User,
    items: list,
) -> None:
    if is_super_admin(current_user):
        return

    if is_admin_managed_account(target_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yonetici kullanicilarin kisiye ozel izinleri yalnizca super admin tarafindan duzenlenebilir",
        )

    for item in items:
        if not _can_delegate_permission_key(db, current_user, item.permission_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bu izin anahtari icin delege yetkiniz yok: {item.permission_key}",
            )


def _has_user_permission_override(
    db: Session,
    user_id: int | None,
    permission_key: str,
) -> bool:
    if not user_id:
        return False

    normalized_key = (permission_key or "").strip().lower()
    if not normalized_key:
        return False

    override = (
        db.query(UserPermissionOverride)
        .filter(
            UserPermissionOverride.user_id == user_id,
            UserPermissionOverride.permission_key == normalized_key,
            UserPermissionOverride.allowed.is_(True),
        )
        .first()
    )
    return override is not None


def _ensure_common_catalog_manage_access(
    db: Session,
    current_user: User,
    permission_key: str,
) -> None:
    if is_super_admin(current_user):
        return

    if is_tenant_admin(current_user):
        return

    if _has_user_permission_override(db, current_user.id, permission_key):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Bu islem sadece super admin veya super admin tarafindan yetkilendirilmis personel tarafindan yapilabilir",
    )


def _slugify_tenant(value: str) -> str:
    normalized = value.strip().lower()
    normalized = normalized.replace("ı", "i").replace("ğ", "g").replace("ü", "u")
    normalized = normalized.replace("ş", "s").replace("ö", "o").replace("ç", "c")
    normalized = "-".join(
        part
        for part in "".join(ch if ch.isalnum() else "-" for ch in normalized).split("-")
        if part
    )
    return normalized or "tenant"


def _ensure_unique_tenant_slug(
    db: Session, slug: str, current_id: int | None = None
) -> str:
    candidate = slug
    counter = 2
    while True:
        existing = db.query(Tenant).filter(Tenant.slug == candidate).first()
        if not existing or existing.id == current_id:
            return candidate
        candidate = f"{slug}-{counter}"
        counter += 1


def _serialize_tenant(
    db: Session, tenant: Tenant, *, initial_admin_email_sent: bool = False
) -> TenantOut:
    owner = None
    if tenant.owner_user_id:
        owner = db.query(User).filter(User.id == tenant.owner_user_id).first()
    approved_by = None
    if tenant.onboarding_approved_by_user_id:
        approved_by = (
            db.query(User)
            .filter(User.id == tenant.onboarding_approved_by_user_id)
            .first()
        )
    rejected_by = None
    if tenant.onboarding_rejected_by_user_id:
        rejected_by = (
            db.query(User)
            .filter(User.id == tenant.onboarding_rejected_by_user_id)
            .first()
        )
    payment_txn = None
    if tenant.onboarding_payment_reference_id:
        payment_txn = db.get(PaymentTransaction, tenant.onboarding_payment_reference_id)
    activation_delivery_status = "not_sent"
    if owner is not None:
        if getattr(owner, "invitation_accepted", False):
            activation_delivery_status = "activated"
        elif initial_admin_email_sent or getattr(owner, "invitation_token", None):
            activation_delivery_status = "sent"
        else:
            activation_delivery_status = "waiting"

    return TenantOut.model_validate(tenant, from_attributes=True).model_copy(
        update={
            "category_tags": _read_json_string_list(
                getattr(tenant, "category_tags_json", None)
            ),
            "target_category_tags": _read_json_string_list(
                getattr(tenant, "target_category_tags_json", None)
            ),
            "category_requests": _read_category_requests(tenant),
            "owner_email": getattr(owner, "email", None),
            "owner_full_name": getattr(owner, "full_name", None),
            "initial_admin_invitation_accepted": bool(
                getattr(owner, "invitation_accepted", False)
            ),
            "activation_delivery_status": activation_delivery_status,
            "onboarding_approved_by_name": getattr(approved_by, "full_name", None)
            or getattr(approved_by, "email", None),
            "onboarding_rejected_by_name": getattr(rejected_by, "full_name", None)
            or getattr(rejected_by, "email", None),
            "onboarding_payment_receipt_url": getattr(
                payment_txn, "receipt_file_url", None
            ),
            "onboarding_payment_receipt_name": getattr(
                payment_txn, "receipt_original_filename", None
            ),
            "onboarding_payment_note": getattr(payment_txn, "buyer_note", None),
            "onboarding_tracking_expires_at": getattr(
                tenant, "onboarding_tracking_expires_at", None
            ),
            "onboarding_decision_timeline": _read_onboarding_timeline(tenant),
            "initial_admin_email_sent": initial_admin_email_sent,
        }
    )


def _ensure_tenant_owner_candidate(
    db: Session, tenant: Tenant, owner_user_id: int | None
) -> None:
    if owner_user_id is None:
        return

    owner = db.query(User).filter(User.id == owner_user_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Tenant owner adayi bulunamadi")
    if owner.tenant_id != tenant.id:
        raise HTTPException(
            status_code=400, detail="Tenant owner adayi ayni tenant icinde olmali"
        )

    if not is_admin_managed_account(owner):
        raise HTTPException(
            status_code=400,
            detail="Tenant owner yalnizca tenant admin kullanicilardan secilebilir",
        )


# Helper to check if user can manage tenant governance
def require_tenant_governance_manager(current_user: User = Depends(get_current_user)):
    if not can_manage_tenant_governance(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sadece super admin bu işlemi yapabilir",
        )
    return current_user


def require_tenant_governance_reader(current_user: User = Depends(get_current_user)):
    if not (is_super_admin(current_user) or is_platform_staff(current_user)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sadece super admin veya platform personeli bu işlemi yapabilir",
        )
    return current_user


def require_admin_user(current_user: User = Depends(get_current_user)):
    if not can_access_admin_surface(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin yetkisi gerekli",
        )
    return current_user


def require_org_catalog_user(current_user: User = Depends(get_current_user)):
    if not can_access_quote_workspace(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu katalog için yetkiniz yok",
        )
    return current_user


def require_project_workspace_user(current_user: User = Depends(get_current_user)):
    if not can_access_quote_workspace(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu proje yuzeyi icin yetkiniz yok",
        )
    return current_user


def require_admin_catalog_reader(current_user: User = Depends(get_current_user)):
    if not can_read_admin_catalog(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu katalog için yetkiniz yok",
        )
    return current_user


def require_permission_catalog_reader(current_user: User = Depends(get_current_user)):
    if not can_read_admin_catalog(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission katalogunu okumak icin admin yetkisi gerekir",
        )
    return current_user


def require_role_management_user(current_user: User = Depends(get_current_user)):
    if not can_manage_role_catalog(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Rol yonetimi icin yonetici yetkisi gerekir",
        )
    return current_user


def _is_super_admin_account(user: User) -> bool:
    return normalized_system_role(user) == "super_admin"


def _count_other_visible_super_admins(db: Session, excluded_user_id: int) -> int:
    return (
        db.query(User)
        .filter(
            or_(User.system_role == "super_admin", User.role == "super_admin"),
            User.hidden_from_admin.is_(False),
            User.id != excluded_user_id,
        )
        .count()
    )


def _is_scoped_admin(current_user: User) -> bool:
    return is_tenant_admin(current_user) and not is_super_admin(current_user)


def _restrict_roles_query_for_role_management(query: Any, current_user: User):
    if is_super_admin(current_user):
        return query

    tenant_id = _current_tenant_id(current_user)
    if tenant_id is not None:
        return query.filter(Role.tenant_id == tenant_id)

    return query.filter(Role.created_by_id == current_user.id)


def _normalize_catalog_name(value: object | None) -> str:
    raw = str(value or "").strip().lower()
    translation = str.maketrans(
        {
            "\u00e7": "c",
            "\u011f": "g",
            "\u0131": "i",
            "\u00f6": "o",
            "\u015f": "s",
            "\u00fc": "u",
            "\u00c7": "c",
            "\u011e": "g",
            "\u0130": "i",
            "\u00d6": "o",
            "\u015e": "s",
            "\u00dc": "u",
        }
    )
    raw = raw.translate(translation)
    raw = re.sub(r"[^a-z0-9]+", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()


def _pick_preferred_role(current: Role, candidate: Role) -> Role:
    # Prefer global/common role row if present, otherwise keep the lowest id.
    if current.tenant_id is None and candidate.tenant_id is not None:
        return current
    if candidate.tenant_id is None and current.tenant_id is not None:
        return candidate
    return candidate if int(candidate.id) < int(current.id) else current


def _pick_preferred_department(
    current: Department, candidate: Department
) -> Department:
    if current.tenant_id is None and candidate.tenant_id is not None:
        return current
    if candidate.tenant_id is None and current.tenant_id is not None:
        return candidate
    return candidate if int(candidate.id) < int(current.id) else current


def _dedupe_roles_by_normalized_name(rows: list[Role]) -> list[Role]:
    by_name: dict[str, Role] = {}
    for row in rows:
        key = _normalize_catalog_name(row.name)
        if key not in by_name:
            by_name[key] = row
            continue
        by_name[key] = _pick_preferred_role(by_name[key], row)
    return sorted(
        by_name.values(), key=lambda item: (item.hierarchy_level, item.name.lower())
    )


def _dedupe_departments_by_normalized_name(rows: list[Department]) -> list[Department]:
    by_name: dict[str, Department] = {}
    for row in rows:
        key = _normalize_catalog_name(row.name)
        if key not in by_name:
            by_name[key] = row
            continue
        by_name[key] = _pick_preferred_department(by_name[key], row)
    return sorted(by_name.values(), key=lambda item: item.name.lower())


def _find_semantic_duplicate_role(
    rows: list[Role],
    *,
    incoming_name: str,
    excluded_role_id: int | None = None,
) -> Role | None:
    incoming_key = _normalize_catalog_name(incoming_name)
    for row in rows:
        if excluded_role_id is not None and int(row.id) == int(excluded_role_id):
            continue
        if _normalize_catalog_name(row.name) == incoming_key:
            return row
    return None


def _find_semantic_duplicate_department(
    rows: list[Department],
    *,
    incoming_name: str,
    excluded_department_id: int | None = None,
) -> Department | None:
    incoming_key = _normalize_catalog_name(incoming_name)
    for row in rows:
        if excluded_department_id is not None and int(row.id) == int(
            excluded_department_id
        ):
            continue
        if _normalize_catalog_name(row.name) == incoming_key:
            return row
    return None


def _cleanup_expired_catalog_merge_rollbacks() -> None:
    now = utcnow()
    expired = [
        token
        for token, payload in _catalog_merge_rollback_cache.items()
        if payload.get("expires_at") and payload["expires_at"] <= now
    ]
    for token in expired:
        _catalog_merge_rollback_cache.pop(token, None)


def _build_role_duplicate_groups(
    db: Session, rows: list[Role]
) -> list[CatalogMergePreviewGroupOut]:
    grouped: dict[str, list[Role]] = {}
    for row in rows:
        key = _normalize_catalog_name(row.name)
        grouped.setdefault(key, []).append(row)

    groups: list[CatalogMergePreviewGroupOut] = []
    for normalized_name, items in grouped.items():
        if len(items) < 2:
            continue
        role_ids = [int(item.id) for item in items]
        assignment_count = (
            db.query(CompanyRole).filter(CompanyRole.role_id.in_(role_ids)).count()
        )
        groups.append(
            CatalogMergePreviewGroupOut(
                normalized_name=normalized_name,
                item_count=len(items),
                impacted_assignment_count=assignment_count,
                items=[
                    CatalogMergeItemOut(
                        id=int(item.id),
                        name=item.name,
                        tenant_id=item.tenant_id,
                        is_active=bool(item.is_active),
                    )
                    for item in sorted(items, key=lambda row: int(row.id))
                ],
            )
        )
    return sorted(groups, key=lambda item: (item.normalized_name, item.item_count))


def _build_department_duplicate_groups(
    db: Session,
    rows: list[Department],
) -> list[CatalogMergePreviewGroupOut]:
    grouped: dict[str, list[Department]] = {}
    for row in rows:
        key = _normalize_catalog_name(row.name)
        grouped.setdefault(key, []).append(row)

    groups: list[CatalogMergePreviewGroupOut] = []
    for normalized_name, items in grouped.items():
        if len(items) < 2:
            continue
        department_ids = [int(item.id) for item in items]
        assignment_count = (
            db.query(User).filter(User.department_id.in_(department_ids)).count()
            + db.query(CompanyRole)
            .filter(CompanyRole.department_id.in_(department_ids))
            .count()
        )
        groups.append(
            CatalogMergePreviewGroupOut(
                normalized_name=normalized_name,
                item_count=len(items),
                impacted_assignment_count=assignment_count,
                items=[
                    CatalogMergeItemOut(
                        id=int(item.id),
                        name=item.name,
                        tenant_id=item.tenant_id,
                        is_active=bool(item.is_active),
                    )
                    for item in sorted(items, key=lambda row: int(row.id))
                ],
            )
        )
    return sorted(groups, key=lambda item: (item.normalized_name, item.item_count))


def _mark_merged_name(name: str, target_id: int, source_id: int) -> str:
    base = (name or "").strip() or f"merged-{source_id}"
    return f"{base} [merged->{target_id}:{source_id}]"


def _apply_role_merge(
    db: Session,
    target_role: Role,
    source_roles: list[Role],
) -> tuple[dict[str, Any], int]:
    source_ids = [int(item.id) for item in source_roles]
    moved_assignment_count = 0

    company_role_updates: list[dict[str, int]] = []
    company_role_rows = (
        db.query(CompanyRole).filter(CompanyRole.role_id.in_(source_ids)).all()
    )
    for row in company_role_rows:
        company_role_updates.append(
            {"id": int(row.id), "old_role_id": int(row.role_id)}
        )
        row.role_id = int(target_role.id)
    moved_assignment_count += len(company_role_updates)

    user_company_role_actions: list[dict[str, int | str]] = []
    assoc_rows = (
        db.execute(
            user_company_roles.select().where(
                user_company_roles.c.role_id.in_(source_ids)
            )
        )
        .mappings()
        .all()
    )
    for row in assoc_rows:
        user_id = int(row["user_id"])
        company_id = int(row["company_id"])
        source_role_id = int(row["role_id"])
        existing_target = db.execute(
            user_company_roles.select().where(
                and_(
                    user_company_roles.c.user_id == user_id,
                    user_company_roles.c.company_id == company_id,
                    user_company_roles.c.role_id == int(target_role.id),
                )
            )
        ).first()
        if existing_target:
            db.execute(
                delete(user_company_roles).where(
                    and_(
                        user_company_roles.c.user_id == user_id,
                        user_company_roles.c.company_id == company_id,
                        user_company_roles.c.role_id == source_role_id,
                    )
                )
            )
            user_company_role_actions.append(
                {
                    "action": "delete",
                    "user_id": user_id,
                    "company_id": company_id,
                    "old_role_id": source_role_id,
                    "new_role_id": int(target_role.id),
                }
            )
            continue

        db.execute(
            update(user_company_roles)
            .where(
                and_(
                    user_company_roles.c.user_id == user_id,
                    user_company_roles.c.company_id == company_id,
                    user_company_roles.c.role_id == source_role_id,
                )
            )
            .values(role_id=int(target_role.id))
        )
        user_company_role_actions.append(
            {
                "action": "update",
                "user_id": user_id,
                "company_id": company_id,
                "old_role_id": source_role_id,
                "new_role_id": int(target_role.id),
            }
        )
    moved_assignment_count += len(user_company_role_actions)

    child_parent_rows = (
        db.query(Role)
        .filter(Role.parent_id.in_(source_ids), Role.id != int(target_role.id))
        .all()
    )
    child_parent_updates: list[dict[str, int]] = []
    for child in child_parent_rows:
        child_parent_updates.append(
            {"id": int(child.id), "old_parent_id": int(child.parent_id or 0)}
        )
        child.parent_id = int(target_role.id)

    source_rows_snapshot: list[dict[str, Any]] = []
    now = utcnow().isoformat()
    for source in source_roles:
        source_rows_snapshot.append(
            {
                "id": int(source.id),
                "name": source.name,
                "description": source.description,
                "is_active": bool(source.is_active),
            }
        )
        source.name = _mark_merged_name(
            source.name, int(target_role.id), int(source.id)
        )
        base_desc = (source.description or "").strip()
        source.description = (
            f"{base_desc} [merged {now} -> role:{int(target_role.id)}]".strip()
        )
        source.is_active = False

    snapshot: dict[str, Any] = {
        "entity_type": "role",
        "tenant_id": target_role.tenant_id,
        "target_id": int(target_role.id),
        "source_ids": source_ids,
        "company_role_updates": company_role_updates,
        "user_company_role_actions": user_company_role_actions,
        "child_parent_updates": child_parent_updates,
        "source_rows": source_rows_snapshot,
    }
    return snapshot, moved_assignment_count


def _apply_department_merge(
    db: Session,
    target_department: Department,
    source_departments: list[Department],
) -> tuple[dict[str, Any], int]:
    source_ids = [int(item.id) for item in source_departments]
    moved_assignment_count = 0

    user_updates: list[dict[str, int]] = []
    users = db.query(User).filter(User.department_id.in_(source_ids)).all()
    for row in users:
        user_updates.append(
            {"id": int(row.id), "old_department_id": int(row.department_id or 0)}
        )
        row.department_id = int(target_department.id)
    moved_assignment_count += len(user_updates)

    company_role_updates: list[dict[str, int]] = []
    company_roles = (
        db.query(CompanyRole).filter(CompanyRole.department_id.in_(source_ids)).all()
    )
    for row in company_roles:
        company_role_updates.append(
            {"id": int(row.id), "old_department_id": int(row.department_id or 0)}
        )
        row.department_id = int(target_department.id)
    moved_assignment_count += len(company_role_updates)

    user_department_actions: list[dict[str, int | str]] = []
    user_department_rows = (
        db.execute(
            user_department.select().where(
                user_department.c.department_id.in_(source_ids)
            )
        )
        .mappings()
        .all()
    )
    for row in user_department_rows:
        user_id = int(row["user_id"])
        source_department_id = int(row["department_id"])
        target_exists = db.execute(
            user_department.select().where(
                and_(
                    user_department.c.user_id == user_id,
                    user_department.c.department_id == int(target_department.id),
                )
            )
        ).first()
        if target_exists:
            db.execute(
                delete(user_department).where(
                    and_(
                        user_department.c.user_id == user_id,
                        user_department.c.department_id == source_department_id,
                    )
                )
            )
            user_department_actions.append(
                {
                    "action": "delete",
                    "user_id": user_id,
                    "old_department_id": source_department_id,
                    "new_department_id": int(target_department.id),
                }
            )
            continue
        db.execute(
            update(user_department)
            .where(
                and_(
                    user_department.c.user_id == user_id,
                    user_department.c.department_id == source_department_id,
                )
            )
            .values(department_id=int(target_department.id))
        )
        user_department_actions.append(
            {
                "action": "update",
                "user_id": user_id,
                "old_department_id": source_department_id,
                "new_department_id": int(target_department.id),
            }
        )

    company_department_actions: list[dict[str, int | str]] = []
    company_department_rows = (
        db.execute(
            company_department.select().where(
                company_department.c.department_id.in_(source_ids)
            )
        )
        .mappings()
        .all()
    )
    for row in company_department_rows:
        company_id = int(row["company_id"])
        source_department_id = int(row["department_id"])
        target_exists = db.execute(
            company_department.select().where(
                and_(
                    company_department.c.company_id == company_id,
                    company_department.c.department_id == int(target_department.id),
                )
            )
        ).first()
        if target_exists:
            db.execute(
                delete(company_department).where(
                    and_(
                        company_department.c.company_id == company_id,
                        company_department.c.department_id == source_department_id,
                    )
                )
            )
            company_department_actions.append(
                {
                    "action": "delete",
                    "company_id": company_id,
                    "old_department_id": source_department_id,
                    "new_department_id": int(target_department.id),
                }
            )
            continue
        db.execute(
            update(company_department)
            .where(
                and_(
                    company_department.c.company_id == company_id,
                    company_department.c.department_id == source_department_id,
                )
            )
            .values(department_id=int(target_department.id))
        )
        company_department_actions.append(
            {
                "action": "update",
                "company_id": company_id,
                "old_department_id": source_department_id,
                "new_department_id": int(target_department.id),
            }
        )

    moved_assignment_count += len(user_department_actions) + len(
        company_department_actions
    )

    source_rows_snapshot: list[dict[str, Any]] = []
    now = utcnow().isoformat()
    for source in source_departments:
        source_rows_snapshot.append(
            {
                "id": int(source.id),
                "name": source.name,
                "description": source.description,
                "is_active": bool(source.is_active),
            }
        )
        source.name = _mark_merged_name(
            source.name, int(target_department.id), int(source.id)
        )
        base_desc = (source.description or "").strip()
        source.description = f"{base_desc} [merged {now} -> department:{int(target_department.id)}]".strip()
        source.is_active = False

    snapshot: dict[str, Any] = {
        "entity_type": "department",
        "tenant_id": target_department.tenant_id,
        "target_id": int(target_department.id),
        "source_ids": source_ids,
        "user_updates": user_updates,
        "company_role_updates": company_role_updates,
        "user_department_actions": user_department_actions,
        "company_department_actions": company_department_actions,
        "source_rows": source_rows_snapshot,
    }
    return snapshot, moved_assignment_count


def _rollback_role_merge(db: Session, snapshot: dict[str, Any]) -> int:
    restored = 0
    for update_item in snapshot.get("company_role_updates", []):
        db.execute(
            update(CompanyRole)
            .where(CompanyRole.id == int(update_item["id"]))
            .values(role_id=int(update_item["old_role_id"]))
        )
        restored += 1

    for action in reversed(snapshot.get("user_company_role_actions", [])):
        user_id = int(action["user_id"])
        company_id = int(action["company_id"])
        old_role_id = int(action["old_role_id"])
        new_role_id = int(action["new_role_id"])
        if action["action"] == "update":
            db.execute(
                update(user_company_roles)
                .where(
                    and_(
                        user_company_roles.c.user_id == user_id,
                        user_company_roles.c.company_id == company_id,
                        user_company_roles.c.role_id == new_role_id,
                    )
                )
                .values(role_id=old_role_id)
            )
            restored += 1
        else:
            exists = db.execute(
                user_company_roles.select().where(
                    and_(
                        user_company_roles.c.user_id == user_id,
                        user_company_roles.c.company_id == company_id,
                        user_company_roles.c.role_id == old_role_id,
                    )
                )
            ).first()
            if not exists:
                db.execute(
                    user_company_roles.insert().values(
                        user_id=user_id,
                        company_id=company_id,
                        role_id=old_role_id,
                    )
                )
                restored += 1

    for child_item in snapshot.get("child_parent_updates", []):
        old_parent = int(child_item["old_parent_id"])
        db.execute(
            update(Role)
            .where(Role.id == int(child_item["id"]))
            .values(parent_id=old_parent if old_parent > 0 else None)
        )

    for source_row in snapshot.get("source_rows", []):
        role_row = db.query(Role).filter(Role.id == int(source_row["id"])).first()
        if role_row:
            role_row.name = str(source_row.get("name") or role_row.name)
            role_row.description = source_row.get("description")
            role_row.is_active = bool(source_row.get("is_active", True))

    return restored


def _rollback_department_merge(db: Session, snapshot: dict[str, Any]) -> int:
    restored = 0
    for update_item in snapshot.get("user_updates", []):
        old_department_id = int(update_item["old_department_id"])
        db.execute(
            update(User)
            .where(User.id == int(update_item["id"]))
            .values(department_id=old_department_id if old_department_id > 0 else None)
        )
        restored += 1

    for update_item in snapshot.get("company_role_updates", []):
        old_department_id = int(update_item["old_department_id"])
        db.execute(
            update(CompanyRole)
            .where(CompanyRole.id == int(update_item["id"]))
            .values(department_id=old_department_id if old_department_id > 0 else None)
        )
        restored += 1

    for action in reversed(snapshot.get("user_department_actions", [])):
        user_id = int(action["user_id"])
        old_department_id = int(action["old_department_id"])
        new_department_id = int(action["new_department_id"])
        if action["action"] == "update":
            db.execute(
                update(user_department)
                .where(
                    and_(
                        user_department.c.user_id == user_id,
                        user_department.c.department_id == new_department_id,
                    )
                )
                .values(department_id=old_department_id)
            )
            restored += 1
        else:
            exists = db.execute(
                user_department.select().where(
                    and_(
                        user_department.c.user_id == user_id,
                        user_department.c.department_id == old_department_id,
                    )
                )
            ).first()
            if not exists:
                db.execute(
                    user_department.insert().values(
                        user_id=user_id,
                        department_id=old_department_id,
                    )
                )
                restored += 1

    for action in reversed(snapshot.get("company_department_actions", [])):
        company_id = int(action["company_id"])
        old_department_id = int(action["old_department_id"])
        new_department_id = int(action["new_department_id"])
        if action["action"] == "update":
            db.execute(
                update(company_department)
                .where(
                    and_(
                        company_department.c.company_id == company_id,
                        company_department.c.department_id == new_department_id,
                    )
                )
                .values(department_id=old_department_id)
            )
            restored += 1
        else:
            exists = db.execute(
                company_department.select().where(
                    and_(
                        company_department.c.company_id == company_id,
                        company_department.c.department_id == old_department_id,
                    )
                )
            ).first()
            if not exists:
                db.execute(
                    company_department.insert().values(
                        company_id=company_id,
                        department_id=old_department_id,
                    )
                )
                restored += 1

    for source_row in snapshot.get("source_rows", []):
        department_row = (
            db.query(Department).filter(Department.id == int(source_row["id"])).first()
        )
        if department_row:
            department_row.name = str(source_row.get("name") or department_row.name)
            department_row.description = source_row.get("description")
            department_row.is_active = bool(source_row.get("is_active", True))

    return restored


def _ensure_manageable_role_level(current_user: User, role: Role):
    if is_super_admin(current_user):
        return

    if (
        _is_scoped_admin(current_user)
        and role.tenant_id == _current_tenant_id(current_user)
        and not is_reserved_workspace_role(role.name)
    ):
        return

    actor_priority = get_business_role_priority(current_user)
    if role.hierarchy_level <= actor_priority:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yalnizca alt roldeki roller duzenlenebilir",
        )


def _ensure_manageable_new_role_level(
    current_user: User,
    parent_role: Role | None,
):
    if is_super_admin(current_user):
        return

    if _is_scoped_admin(current_user):
        if parent_role is None:
            return
        if parent_role.tenant_id == _current_tenant_id(
            current_user
        ) and not is_reserved_workspace_role(parent_role.name):
            return

    actor_priority = get_business_role_priority(current_user)
    new_role_level = (parent_role.hierarchy_level + 1) if parent_role else 0
    if new_role_level <= actor_priority:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yalnizca kendi alt seviyenize yeni rol olusturabilirsiniz",
        )


def _current_tenant_id(current_user: User) -> int | None:
    return getattr(current_user, "tenant_id", None)


def _current_tenant(db: Session, current_user: User) -> Tenant | None:
    tenant_id = _current_tenant_id(current_user)
    if tenant_id is None:
        return None
    return db.query(Tenant).filter(Tenant.id == tenant_id).first()


def _require_workspace_tenant_scope(current_user: User, *, detail: str) -> None:
    if _current_tenant_id(current_user) is not None or is_super_admin(current_user):
        return

    if normalized_system_role(current_user) in {
        "tenant_owner",
        "tenant_admin",
        "tenant_member",
    }:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _restrict_companies_query_for_admin(query: Any, current_user: User):
    if _is_scoped_admin(current_user):
        if _current_tenant_id(current_user) is not None:
            return query.filter(Company.tenant_id == _current_tenant_id(current_user))
        return query.filter(Company.created_by_id == current_user.id)
    return query


def _serialize_company(
    db: Session,
    company: Company,
) -> CompanyOut:
    owner_full_name: str | None = None
    owner_email: str | None = None
    owner_user: User | None = None

    if (
        company.tenant is not None
        and getattr(company.tenant, "owner_user", None) is not None
    ):
        owner_user = company.tenant.owner_user
    elif company.tenant_id is not None:
        tenant = db.query(Tenant).filter(Tenant.id == company.tenant_id).first()
        owner_user = tenant.owner_user if tenant else None

    if owner_user is None and company.created_by_id is not None:
        owner_user = db.query(User).filter(User.id == company.created_by_id).first()

    if owner_user is not None:
        owner_full_name = owner_user.full_name
        owner_email = owner_user.email

    settings = get_or_create_system_settings(db)
    return CompanyOut.model_validate(company, from_attributes=True).model_copy(
        update={
            "is_platform_primary": company.id
            == getattr(settings, "platform_primary_company_id", None),
            "owner_full_name": owner_full_name,
            "owner_email": owner_email,
        }
    )


def _restrict_users_query_for_admin(query: Any, current_user: User):
    if _is_scoped_admin(current_user):
        tenant_id = _current_tenant_id(current_user)
        query = _exclude_admin_managed_users(query, preserve_user_id=current_user.id)
        if tenant_id is not None:
            return query.filter(User.tenant_id == tenant_id)
        return query.filter(User.created_by_id == current_user.id)
    return query


def _restrict_users_query_for_workspace(query: Any, current_user: User):
    if can_read_admin_catalog(current_user):
        return _restrict_users_query_for_admin(query, current_user)

    tenant_id = _current_tenant_id(current_user)
    query = _exclude_admin_managed_users(query, preserve_user_id=current_user.id)

    if normalized_role(current_user) in {"channel_owner", "channel_agent"}:
        channel_role_filter = or_(
            func.lower(func.coalesce(User.system_role, "")).like("channel_%"),
            func.lower(func.coalesce(User.role, "")).like("channel_%"),
        )
        query = query.filter(channel_role_filter)
        if tenant_id is not None:
            return query.filter(User.tenant_id == tenant_id)

        current_company_ids = select(CompanyRole.company_id).where(
            CompanyRole.user_id == current_user.id,
            CompanyRole.is_active.is_(True),
        )
        peer_user_ids = select(CompanyRole.user_id).where(
            CompanyRole.is_active.is_(True),
            CompanyRole.company_id.in_(current_company_ids),
        )
        return query.filter(or_(User.id == current_user.id, User.id.in_(peer_user_ids)))

    if tenant_id is not None:
        return query.filter(User.tenant_id == tenant_id)
    return query.filter(User.id == current_user.id)


def _restrict_project_query_for_admin(query: Any, current_user: User):
    if _is_scoped_admin(current_user):
        if _current_tenant_id(current_user) is not None:
            return query.filter(Project.tenant_id == _current_tenant_id(current_user))
        return query.filter(Project.created_by_id == current_user.id)
    return query


def _restrict_departments_query_for_admin(query: Any, current_user: User):
    if _is_scoped_admin(current_user):
        if _current_tenant_id(current_user) is not None:
            return query.filter(
                Department.tenant_id == _current_tenant_id(current_user)
            )
        return query.filter(Department.created_by_id == current_user.id)
    return query


def _restrict_departments_query_for_workspace(query: Any, current_user: User):
    if can_read_admin_catalog(current_user):
        return _restrict_departments_query_for_admin(query, current_user)

    tenant_id = _current_tenant_id(current_user)
    if tenant_id is not None:
        return query.filter(Department.tenant_id == tenant_id)
    return query.filter(Department.id == getattr(current_user, "department_id", None))


def _restrict_roles_query_for_admin(query: Any, current_user: User):
    if _is_scoped_admin(current_user):
        if _current_tenant_id(current_user) is not None:
            return query.filter(Role.tenant_id == _current_tenant_id(current_user))
        return query.filter(Role.created_by_id == current_user.id)
    return query


def _exclude_admin_managed_users(query: Any, preserve_user_id: int | None = None):
    base_filter = and_(
        or_(
            User.system_role.is_(None),
            User.system_role.notin_(tuple(ADMIN_MANAGED_SYSTEM_ROLES)),
        ),
        User.role.notin_(tuple(LEGACY_ADMIN_ROLES)),
    )
    if preserve_user_id is not None:
        return query.filter(or_(User.id == preserve_user_id, base_filter))
    return query.filter(base_filter)


def _ensure_department_scope(
    db: Session, current_user: User, department_id: int | None
):
    if not _is_scoped_admin(current_user) or department_id is None:
        return
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(
            status_code=403, detail="Bu departman üzerinde yetkiniz yok"
        )
    tenant_id = _current_tenant_id(current_user)
    if tenant_id is not None and department.tenant_id != tenant_id:
        raise HTTPException(
            status_code=403, detail="Bu departman üzerinde yetkiniz yok"
        )
    if tenant_id is None and department.created_by_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Bu departman üzerinde yetkiniz yok"
        )


def _ensure_role_scope(db: Session, current_user: User, role_id: int | None):
    if is_super_admin(current_user) or role_id is None:
        return
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=403, detail="Bu rol üzerinde yetkiniz yok")
    tenant_id = _current_tenant_id(current_user)
    if tenant_id is not None and role.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Bu rol üzerinde yetkiniz yok")
    if tenant_id is None and role.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu rol üzerinde yetkiniz yok")


def _can_review_catalog_requests(current_user: User) -> bool:
    return is_super_admin(current_user) or is_platform_staff(current_user)


def _serialize_catalog_request(row: OrgCatalogRequest) -> CatalogRequestOut:
    permission_ids: list[int] = []
    if row.proposed_permission_ids_json:
        try:
            parsed = json.loads(row.proposed_permission_ids_json)
            if isinstance(parsed, list):
                permission_ids = [int(item) for item in parsed if str(item).isdigit()]
        except Exception:
            permission_ids = []

    return CatalogRequestOut(
        id=row.id,
        entity_type=row.entity_type,
        tenant_id=row.tenant_id,
        requested_by_user_id=row.requested_by_user_id,
        requested_by_name=getattr(row.requested_by, "full_name", None),
        requested_by_email=getattr(row.requested_by, "email", None),
        review_status=row.review_status,
        proposed_name=row.proposed_name,
        proposed_description=row.proposed_description,
        proposed_parent_id=row.proposed_parent_id,
        proposed_permission_ids=permission_ids,
        decision_note=row.decision_note,
        approved_entity_id=row.approved_entity_id,
        reviewed_by_user_id=row.reviewed_by_user_id,
        reviewed_by_name=getattr(row.reviewed_by, "full_name", None),
        reviewed_at=row.reviewed_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _catalog_request_query_for_user(db: Session, current_user: User):
    query = db.query(OrgCatalogRequest)
    if _can_review_catalog_requests(current_user):
        return query.order_by(OrgCatalogRequest.created_at.desc())

    tenant_id = _current_tenant_id(current_user)
    if tenant_id is not None:
        return query.filter(
            or_(
                OrgCatalogRequest.tenant_id == tenant_id,
                OrgCatalogRequest.requested_by_user_id == current_user.id,
            )
        ).order_by(OrgCatalogRequest.created_at.desc())

    return query.filter(
        OrgCatalogRequest.requested_by_user_id == current_user.id
    ).order_by(OrgCatalogRequest.created_at.desc())


def _approve_catalog_request(
    db: Session, row: OrgCatalogRequest, reviewer: User
) -> None:
    if row.entity_type == "department":
        existing = (
            db.query(Department)
            .filter(
                Department.tenant_id == row.tenant_id,
                Department.name == row.proposed_name,
            )
            .first()
        )
        if existing:
            row.approved_entity_id = existing.id
            return

        department = Department(
            name=row.proposed_name,
            description=row.proposed_description,
            tenant_id=row.tenant_id,
            created_by_id=row.requested_by_user_id,
            is_active=True,
        )
        db.add(department)
        db.flush()
        row.approved_entity_id = department.id
        return

    if row.entity_type == "role":
        existing = (
            db.query(Role)
            .filter(
                Role.tenant_id == row.tenant_id,
                Role.name == row.proposed_name,
            )
            .first()
        )
        if existing:
            row.approved_entity_id = existing.id
            return

        hierarchy_level = 0
        parent_role = None
        if row.proposed_parent_id:
            parent_role = (
                db.query(Role).filter(Role.id == row.proposed_parent_id).first()
            )
            if parent_role:
                hierarchy_level = parent_role.hierarchy_level + 1

        role = Role(
            name=row.proposed_name,
            description=row.proposed_description,
            created_by_id=row.requested_by_user_id,
            tenant_id=row.tenant_id,
            parent_id=parent_role.id if parent_role else None,
            hierarchy_level=hierarchy_level,
            is_active=True,
        )
        permission_ids: list[int] = []
        if row.proposed_permission_ids_json:
            try:
                parsed = json.loads(row.proposed_permission_ids_json)
                if isinstance(parsed, list):
                    permission_ids = [
                        int(item) for item in parsed if str(item).isdigit()
                    ]
            except Exception:
                permission_ids = []
        if permission_ids:
            role.permissions = (
                db.query(Permission).filter(Permission.id.in_(permission_ids)).all()
            )
        db.add(role)
        db.flush()
        _ensure_workspace_panel_profile_for_role(db, reviewer, role.name)
        row.approved_entity_id = role.id


@router.get("/catalog-requests", response_model=list[CatalogRequestOut])
async def list_catalog_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_catalog_user),
    entity_type: str | None = None,
    status_filter: str | None = None,
):
    query = _catalog_request_query_for_user(db, current_user)
    if entity_type:
        query = query.filter(OrgCatalogRequest.entity_type == entity_type)
    if status_filter:
        query = query.filter(OrgCatalogRequest.review_status == status_filter)
    return [_serialize_catalog_request(item) for item in query.all()]


@router.post("/catalog-requests/departments", response_model=CatalogRequestOut)
async def create_department_catalog_request(
    payload: CatalogRequestCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    request_row = OrgCatalogRequest(
        entity_type="department",
        tenant_id=_current_tenant_id(current_user),
        requested_by_user_id=current_user.id,
        proposed_name=payload.name.strip(),
        proposed_description=(payload.description or "").strip() or None,
        proposed_permission_ids_json=None,
    )
    db.add(request_row)
    db.commit()
    db.refresh(request_row)
    return _serialize_catalog_request(request_row)


@router.post("/catalog-requests/roles", response_model=CatalogRequestOut)
async def create_role_catalog_request(
    payload: CatalogRequestCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role_management_user),
):
    request_row = OrgCatalogRequest(
        entity_type="role",
        tenant_id=_current_tenant_id(current_user),
        requested_by_user_id=current_user.id,
        proposed_name=payload.name.strip(),
        proposed_description=(payload.description or "").strip() or None,
        proposed_parent_id=payload.parent_id,
        proposed_permission_ids_json=json.dumps(payload.permission_ids or []),
    )
    db.add(request_row)
    db.commit()
    db.refresh(request_row)
    return _serialize_catalog_request(request_row)


@router.post("/catalog-requests/{request_id}/review", response_model=CatalogRequestOut)
async def review_catalog_request(
    request_id: int,
    payload: CatalogRequestReviewIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    if not _can_review_catalog_requests(current_user):
        raise HTTPException(status_code=403, detail="Bu onay kuyruğu için yetkiniz yok")

    row = db.query(OrgCatalogRequest).filter(OrgCatalogRequest.id == request_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Onay talebi bulunamadi")

    decision = str(payload.decision or "").strip().lower()
    if decision not in {"approved", "rejected"}:
        raise HTTPException(
            status_code=400, detail="Karar approved veya rejected olmalidir"
        )
    if row.review_status != "pending_review":
        raise HTTPException(status_code=400, detail="Bu talep zaten karara baglandi")

    row.review_status = decision
    row.decision_note = (payload.note or "").strip() or None
    row.reviewed_by_user_id = current_user.id
    row.reviewed_at = utcnow()
    if decision == "approved":
        _approve_catalog_request(db, row, current_user)

    db.commit()
    db.refresh(row)
    return _serialize_catalog_request(row)


def _ensure_manageable_user_role(current_user: User, requested_role: str | None):
    if _is_scoped_admin(current_user) and is_reserved_workspace_role(requested_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant admin, admin veya super admin hesabi olusturamaz ya da guncelleyemez.",
        )


def _ensure_manageable_target_user(current_user: User, target_user: User):
    if current_user.id == target_user.id:
        return

    actor_priority = get_business_role_priority(current_user)
    target_priority = get_business_role_priority(target_user)

    # Super admin, kendi kaydi disinda tum kullanicilari yonetebilir.
    # Self-delete korumasi ve son super admin guvencesi delete endpointinde ayrica uygulanir.
    if is_super_admin(current_user):
        return

    if target_priority <= actor_priority:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yalnizca kendi alt rolunuzdeki kullanicilari yonetebilirsiniz",
        )


def _ensure_company_scope(db: Session, current_user: User, company_id: int | None):
    if not _is_scoped_admin(current_user) or company_id is None:
        return
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=403, detail="Bu firma üzerinde yetkiniz yok")
    tenant_id = _current_tenant_id(current_user)
    if tenant_id is not None and company.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Bu firma üzerinde yetkiniz yok")
    if tenant_id is None and company.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu firma üzerinde yetkiniz yok")


def _ensure_company_assignment_tenant_consistency(
    user: User,
    company: Company,
    role: Role,
    department: Department | None = None,
):
    tenant_ids = {
        tenant_id
        for tenant_id in [
            user.tenant_id,
            company.tenant_id,
            role.tenant_id,
            department.tenant_id if department else None,
        ]
        if tenant_id is not None
    }
    if len(tenant_ids) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firma atamasindaki kullanici, firma, rol ve departman ayni tenant kapsaminda olmalidir",
        )


def _ensure_user_scope(user: User, current_user: User):
    if _is_scoped_admin(current_user):
        tenant_id = _current_tenant_id(current_user)
        if tenant_id is not None and user.tenant_id != tenant_id:
            raise HTTPException(
                status_code=403, detail="Bu personel üzerinde yetkiniz yok"
            )
        if tenant_id is None and user.created_by_id != current_user.id:
            raise HTTPException(
                status_code=403, detail="Bu personel üzerinde yetkiniz yok"
            )
    if (
        _is_scoped_admin(current_user)
        and is_admin_managed_account(user)
        and user.id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="Tenant admin bu hesabi personel akisindan yonetemez",
        )
    if can_access_admin_surface(current_user):
        _ensure_manageable_target_user(current_user, user)


def _ensure_project_scope(project: Project, current_user: User):
    if not _is_scoped_admin(current_user):
        return

    tenant_id = _current_tenant_id(current_user)
    if tenant_id is not None and project.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Bu proje üzerinde yetkiniz yok")
    if tenant_id is None and project.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu proje üzerinde yetkiniz yok")


def _can_create_project(current_user: User) -> bool:
    return can_create_project(current_user)


def _can_view_all_projects(current_user: User) -> bool:
    return can_view_all_projects(current_user)


def _ensure_project_member_or_global(project: Project, current_user: User) -> None:
    if _can_view_all_projects(current_user):
        return
    if any(p.id == project.id for p in current_user.projects):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Bu projede işlem yapma yetkiniz yok",
    )


def _resolve_project_responsible_users(
    db: Session,
    current_user: User,
    responsible_user_ids: list[int] | None,
) -> list[User]:
    if not responsible_user_ids:
        return []

    requested_ids = {int(user_id) for user_id in responsible_user_ids}
    users_query = db.query(User).filter(User.id.in_(requested_ids), User.is_active)
    current_tenant_id = _current_tenant_id(current_user)
    if current_tenant_id is not None:
        users_query = users_query.filter(User.tenant_id == current_tenant_id)

    users = users_query.all()
    resolved_ids = {user.id for user in users}
    if resolved_ids != requested_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proje sorumlulari ayni tenant kapsaminda aktif kullanicilar olmalidir",
        )

    return users


def _ensure_unique_project_code(
    db: Session,
    current_user: User,
    code: str,
    *,
    excluded_project_id: int | None = None,
) -> None:
    existing_query = db.query(Project).filter(Project.code == code)
    tenant_id = _current_tenant_id(current_user)
    if tenant_id is not None:
        existing_query = existing_query.filter(Project.tenant_id == tenant_id)
    if excluded_project_id is not None:
        existing_query = existing_query.filter(Project.id != excluded_project_id)
    if existing_query.first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu proje kodu bu tenant icinde zaten mevcut",
        )


# ==================== COMPANY ENDPOINTS ====================


@router.get("/tenants", response_model=list[TenantOut])
async def list_tenants(
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_reader),
):
    tenants = (
        db.query(Tenant).order_by(Tenant.created_at.desc(), Tenant.id.desc()).all()
    )
    return [_serialize_tenant(db, tenant) for tenant in tenants]


@router.get("/subscription-catalog", response_model=SubscriptionCatalogSnapshotOut)
async def get_subscription_catalog(
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_manager),
):
    return build_subscription_catalog_snapshot(db)


@router.get("/onboarding-studio/summary")
async def get_onboarding_studio_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_reader),
):
    tenant_rows = db.query(Tenant).all()
    onboarding_queue_count = sum(
        1
        for tenant in tenant_rows
        if str(tenant.onboarding_status or "").lower() != "active"
    )
    owner_pending_count = sum(1 for tenant in tenant_rows if not tenant.owner_user_id)
    branding_pending_count = sum(
        1 for tenant in tenant_rows if not tenant.brand_name or not tenant.logo_url
    )
    new_membership_count = sum(
        1
        for tenant in tenant_rows
        if str(tenant.onboarding_status or "").lower() == "pending_activation"
    )
    payment_review_count = sum(
        1
        for tenant in tenant_rows
        if str(tenant.onboarding_payment_status or "").lower()
        in {"submitted", "processing", "pending_review"}
    )
    information_requested_count = sum(
        1
        for tenant in tenant_rows
        if str(tenant.onboarding_approval_status or "").lower() == "needs_info"
    )
    activation_approval_waiting_count = sum(
        1
        for tenant in tenant_rows
        if str(tenant.onboarding_approval_status or "").lower() == "pending"
    )
    approved_membership_count = sum(
        1
        for tenant in tenant_rows
        if str(tenant.onboarding_approval_status or "").lower() == "approved"
    )
    recent_memberships = [
        _serialize_tenant(db, tenant)
        for tenant in sorted(
            tenant_rows,
            key=lambda row: (row.created_at, row.id),
            reverse=True,
        )[:8]
        if str(tenant.onboarding_status or "").lower() == "pending_activation"
        or str(tenant.onboarding_approval_status or "").lower()
        in {"pending", "approved", "needs_info"}
    ]

    quotes_missing_tenant = (
        db.query(func.count(Quote.id)).filter(Quote.tenant_id.is_(None)).scalar() or 0
    )
    approvals_missing_tenant = (
        db.query(func.count(QuoteApproval.id))
        .filter(QuoteApproval.tenant_id.is_(None))
        .scalar()
        or 0
    )
    quotes_project_tenant_mismatch = (
        db.query(func.count(Quote.id))
        .join(Project, Project.id == Quote.project_id)
        .filter(
            Quote.tenant_id.is_not(None),
            Project.tenant_id.is_not(None),
            Quote.tenant_id != Project.tenant_id,
        )
        .scalar()
        or 0
    )
    supplier_private_count = (
        db.query(func.count(Supplier.id))
        .filter(Supplier.tenant_id.is_not(None))
        .scalar()
        or 0
    )
    supplier_platform_network_count = (
        db.query(func.count(Supplier.id)).filter(Supplier.tenant_id.is_(None)).scalar()
        or 0
    )
    supplier_quote_scope_mismatch = (
        db.query(func.count(SupplierQuote.id))
        .join(Quote, Quote.id == SupplierQuote.quote_id)
        .join(Supplier, Supplier.id == SupplierQuote.supplier_id)
        .filter(
            Quote.tenant_id.is_not(None),
            Supplier.tenant_id.is_not(None),
            Quote.tenant_id != Supplier.tenant_id,
        )
        .scalar()
        or 0
    )
    approvals_quote_tenant_mismatch = (
        db.query(func.count(QuoteApproval.id))
        .join(Quote, Quote.id == QuoteApproval.quote_id)
        .filter(
            QuoteApproval.tenant_id.is_not(None),
            Quote.tenant_id.is_not(None),
            QuoteApproval.tenant_id != Quote.tenant_id,
        )
        .scalar()
        or 0
    )
    supplier_quotes_platform_network_count = (
        db.query(func.count(SupplierQuote.id))
        .join(Supplier, Supplier.id == SupplierQuote.supplier_id)
        .filter(Supplier.tenant_id.is_(None))
        .scalar()
        or 0
    )

    return {
        "tenant_count": len(tenant_rows),
        "onboarding_queue_count": onboarding_queue_count,
        "owner_pending_count": owner_pending_count,
        "branding_pending_count": branding_pending_count,
        "new_membership_count": new_membership_count,
        "payment_review_count": payment_review_count,
        "information_requested_count": information_requested_count,
        "activation_approval_waiting_count": activation_approval_waiting_count,
        "approved_membership_count": approved_membership_count,
        "recent_memberships": recent_memberships,
        "rfq_readiness": {
            "quotes_missing_tenant": quotes_missing_tenant,
            "approvals_quote_tenant_mismatch": approvals_quote_tenant_mismatch,
            "approvals_missing_tenant": approvals_missing_tenant,
            "quotes_project_tenant_mismatch": quotes_project_tenant_mismatch,
            "supplier_quote_scope_mismatch": supplier_quote_scope_mismatch,
            "supplier_quotes_platform_network_count": supplier_quotes_platform_network_count,
            "transition_ready": (
                quotes_missing_tenant == 0
                and approvals_missing_tenant == 0
                and approvals_quote_tenant_mismatch == 0
                and quotes_project_tenant_mismatch == 0
                and supplier_quote_scope_mismatch == 0
            ),
        },
        "supplier_mix": {
            "private_count": supplier_private_count,
            "platform_network_count": supplier_platform_network_count,
        },
    }


@router.post("/tenants/{tenant_id}/verify-onboarding-payment", response_model=TenantOut)
async def verify_onboarding_payment(
    tenant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_manager),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant bulunamadi")

    payment_status = str(tenant.onboarding_payment_status or "not_required").lower()
    if payment_status == "not_required":
        raise HTTPException(
            status_code=400, detail="Bu uyelik icin odeme dogrulamasi gerekmiyor"
        )

    tenant.onboarding_payment_status = "verified"
    tenant.onboarding_payment_verified_at = utcnow()
    if tenant.onboarding_payment_reference_id:
        payment_txn = db.get(PaymentTransaction, tenant.onboarding_payment_reference_id)
        if payment_txn is not None:
            payment_txn.status = "succeeded"
            payment_txn.completed_at = utcnow()
            db.add(payment_txn)
            activate_premium_features_for_payment(db, payment_txn, tenant_id=tenant.id)
    if str(tenant.onboarding_approval_status or "").lower() in {
        "not_required",
        "needs_info",
    }:
        tenant.onboarding_approval_status = "pending"
    _append_onboarding_timeline(
        tenant,
        action="payment_verified",
        actor_name="Super Admin",
        actor_type="admin",
        note="Odeme dogrulandi",
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return _serialize_tenant(db, tenant)


@router.post("/payment-transactions/{txn_id}/verify")
async def verify_payment_transaction(
    txn_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_manager),
):
    txn = db.get(PaymentTransaction, txn_id)
    if txn is None:
        raise HTTPException(status_code=404, detail="Odeme islemi bulunamadi")

    txn.status = "succeeded"
    txn.completed_at = utcnow()
    db.add(txn)
    activations = activate_premium_features_for_payment(
        db, txn, tenant_id=txn.tenant_id
    )
    addon_activations = activate_subscription_addons_for_payment(
        db, txn, tenant_id=txn.tenant_id
    )
    db.commit()
    db.refresh(txn)

    return {
        "transaction_id": txn.id,
        "status": txn.status,
        "tenant_id": txn.tenant_id,
        "activated_feature_count": len(activations),
        "activated_addon_count": len(addon_activations),
        "receipt_file_url": txn.receipt_file_url,
    }


@router.get("/commercial-requests")
async def list_commercial_requests(
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_manager),
):
    rows = (
        db.query(CommercialRequest)
        .order_by(CommercialRequest.created_at.desc(), CommercialRequest.id.desc())
        .limit(200)
        .all()
    )
    return [
        {
            "id": row.id,
            "tenant_id": row.tenant_id,
            "tenant_name": row.tenant.brand_name
            if row.tenant and row.tenant.brand_name
            else (row.tenant.legal_name if row.tenant else None),
            "request_type": row.request_type,
            "audience": row.audience,
            "status": row.status,
            "source_surface": row.source_surface,
            "package_code": row.package_code,
            "package_name": row.package_name,
            "addon_code": row.addon_code,
            "addon_name": row.addon_name,
            "requester_name": row.requester_name,
            "requester_email": row.requester_email,
            "company_name": row.company_name,
            "phone": row.phone,
            "owner_name": row.owner_name,
            "last_contacted_at": row.last_contacted_at,
            "notes": row.notes,
            "review_note": row.review_note,
            "reviewed_at": row.reviewed_at,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@router.post("/commercial-requests/{request_id}/status")
async def update_commercial_request_status(
    request_id: int,
    payload: CommercialRequestStatusUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_governance_manager),
):
    row = db.get(CommercialRequest, request_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Ticari talep bulunamadi")

    next_status = (payload.status or "").strip().lower()
    if next_status not in {"new", "contacted", "qualified", "won", "lost"}:
        raise HTTPException(status_code=400, detail="Gecersiz ticari talep durumu")

    row.status = next_status
    row.review_note = (payload.note or "").strip() or row.review_note
    if payload.owner_name is not None:
        row.owner_name = (payload.owner_name or "").strip() or None
    if payload.mark_contacted_now:
        row.last_contacted_at = utcnow()
    row.reviewed_at = utcnow()
    row.reviewed_by_user_id = current_user.id
    db.add(row)
    db.commit()
    db.refresh(row)
    dispatch_commercial_request_event(db, row, event_type="commercial_request.updated")
    return {
        "id": row.id,
        "status": row.status,
        "review_note": row.review_note,
        "owner_name": row.owner_name,
        "last_contacted_at": row.last_contacted_at,
        "reviewed_at": row.reviewed_at,
    }


@router.get("/subscription-addons")
async def list_subscription_addons(
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_manager),
):
    rows = (
        db.query(TenantSubscriptionAddon)
        .order_by(
            TenantSubscriptionAddon.created_at.desc(), TenantSubscriptionAddon.id.desc()
        )
        .limit(200)
        .all()
    )
    return [
        {
            "id": row.id,
            "tenant_id": row.tenant_id,
            "tenant_name": row.tenant.brand_name
            if row.tenant and row.tenant.brand_name
            else (row.tenant.legal_name if row.tenant else None),
            "addon_code": row.addon_code,
            "addon_name": row.addon_name,
            "limit_key": row.limit_key,
            "quantity": row.quantity,
            "increment_per_unit": row.increment_per_unit,
            "total_increment": row.total_increment,
            "status": row.status,
            "payment_transaction_id": row.payment_transaction_id,
            "activated_at": row.activated_at,
            "expires_at": row.expires_at,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@router.post("/subscription-addons/{addon_id}/lifecycle")
async def update_subscription_addon_lifecycle(
    addon_id: int,
    payload: SubscriptionAddonLifecycleUpdateIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_manager),
):
    row = db.get(TenantSubscriptionAddon, addon_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Subscription add-on bulunamadi")

    action = (payload.action or "").strip().lower()
    if action == "renew":
        extension_days = int(payload.extension_days or 30)
        if extension_days <= 0:
            raise HTTPException(status_code=400, detail="extension_days pozitif olmali")
        base_date = (
            row.expires_at if row.expires_at and row.expires_at > utcnow() else utcnow()
        )
        row.expires_at = base_date + timedelta(days=extension_days)
        row.status = "active"
    elif action == "cancel":
        row.status = "cancelled"
        row.expires_at = utcnow()
    elif action == "set_expiry":
        if payload.expires_at is None:
            raise HTTPException(status_code=400, detail="expires_at zorunlu")
        row.expires_at = payload.expires_at
        if row.expires_at <= utcnow():
            row.status = "expired"
    elif action == "reactivate":
        row.status = "active"
        row.expires_at = payload.expires_at or (utcnow() + timedelta(days=30))
    else:
        raise HTTPException(status_code=400, detail="Gecersiz lifecycle aksiyonu")

    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "status": row.status,
        "expires_at": row.expires_at,
    }


@router.post("/tenants/{tenant_id}/request-onboarding-info", response_model=TenantOut)
async def request_onboarding_info(
    tenant_id: int,
    payload: OnboardingDecisionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_governance_manager),
    email_service=Depends(get_email_service),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant bulunamadi")

    tenant.onboarding_approval_status = "needs_info"
    tenant.onboarding_activation_notes = (payload.note or "").strip() or None
    tenant.onboarding_status = "pending_activation"
    tenant.status = "paused"
    tenant.is_active = False
    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    owner = None
    if tenant.owner_user_id:
        owner = db.query(User).filter(User.id == tenant.owner_user_id).first()
    if owner and owner.email:
        email_service.send_onboarding_status_update(
            to_email=owner.email,
            full_name=owner.full_name,
            company_name=tenant.brand_name or tenant.legal_name,
            decision="needs_info",
            note=tenant.onboarding_activation_notes,
            action_url=f"{email_service.app_url}/onboarding?tracking_token={tenant.onboarding_tracking_token}",
            owner_user_id=current_user.id,
        )

    _append_onboarding_timeline(
        tenant,
        action="information_requested",
        actor_name=current_user.full_name,
        actor_type="admin",
        note=tenant.onboarding_activation_notes,
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    return _serialize_tenant(db, tenant)


@router.post("/tenants/{tenant_id}/category-requests/review", response_model=TenantOut)
async def review_tenant_category_request(
    tenant_id: int,
    payload: TenantCategoryReviewDecisionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant bulunamadi")

    decision = str(payload.decision or "").strip().lower()
    actor_is_support = is_platform_staff(current_user) or is_super_admin(current_user)
    if decision == "support_approved":
        if not actor_is_support:
            raise HTTPException(
                status_code=403,
                detail="Bu kategori incelemesini yalnizca destek ekibi yapabilir",
            )
    elif decision == "final_approved":
        if not is_super_admin(current_user):
            raise HTTPException(
                status_code=403,
                detail="Final kategori onayi yalnizca super admin tarafindan verilebilir",
            )
    elif decision != "rejected":
        raise HTTPException(status_code=400, detail="Gecersiz kategori karar tipi")

    if decision == "rejected" and not actor_is_support:
        raise HTTPException(
            status_code=403,
            detail="Kategori talebini yalnizca destek ekibi veya super admin reddedebilir",
        )

    requests = _read_category_requests(tenant)
    target_key = _category_request_key(payload.category_name)
    matched_item: dict[str, Any] | None = None
    for item in requests:
        if _category_request_key(item.get("name")) == target_key:
            matched_item = item
            break

    if matched_item is None:
        raise HTTPException(status_code=404, detail="Kategori talebi bulunamadi")

    current_status = str(matched_item.get("status") or "pending_support").lower()
    actor_name = current_user.full_name or current_user.email or "Platform"
    review_note = (payload.note or "").strip() or None

    if decision == "support_approved":
        if current_status != "pending_support":
            raise HTTPException(
                status_code=400,
                detail="Bu kategori talebi destek onay asamasinda degil",
            )
        matched_item["status"] = "support_approved"
        matched_item["support_reviewer_name"] = actor_name
        matched_item["support_reviewed_at"] = utcnow().isoformat()
        matched_item["note"] = review_note
        _append_onboarding_timeline(
            tenant,
            action="category_support_approved",
            actor_name=actor_name,
            actor_type="support",
            note=matched_item.get("name"),
        )
    elif decision == "final_approved":
        if current_status not in {"pending_support", "support_approved"}:
            raise HTTPException(
                status_code=400, detail="Bu kategori talebi final onay asamasinda degil"
            )
        matched_item["status"] = "final_approved"
        if current_status == "pending_support":
            matched_item["support_reviewer_name"] = actor_name
            matched_item["support_reviewed_at"] = utcnow().isoformat()
        matched_item["final_reviewer_name"] = actor_name
        matched_item["final_reviewed_at"] = utcnow().isoformat()
        matched_item["note"] = review_note
        _append_tenant_category(
            tenant,
            str(matched_item.get("name") or ""),
            applies_to=str(matched_item.get("applies_to") or "offered"),
        )
        _append_onboarding_timeline(
            tenant,
            action="category_final_approved",
            actor_name=actor_name,
            actor_type="admin",
            note=matched_item.get("name"),
        )
    else:
        if current_status == "final_approved":
            raise HTTPException(
                status_code=400, detail="Final onaylanmis kategori reddedilemez"
            )
        matched_item["status"] = "rejected"
        matched_item["note"] = review_note
        matched_item["final_reviewer_name"] = (
            actor_name
            if is_super_admin(current_user)
            else matched_item.get("final_reviewer_name")
        )
        matched_item["final_reviewed_at"] = (
            utcnow().isoformat()
            if is_super_admin(current_user)
            else matched_item.get("final_reviewed_at")
        )
        if actor_is_support and not matched_item.get("support_reviewed_at"):
            matched_item["support_reviewer_name"] = actor_name
            matched_item["support_reviewed_at"] = utcnow().isoformat()
        _append_onboarding_timeline(
            tenant,
            action="category_request_rejected",
            actor_name=actor_name,
            actor_type="support" if is_platform_staff(current_user) else "admin",
            note=f"{matched_item.get('name')}: {review_note or 'Reddedildi'}",
        )

    _write_category_requests(tenant, requests)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return _serialize_tenant(db, tenant)


@router.post(
    "/tenants/{tenant_id}/approve-onboarding-activation", response_model=TenantOut
)
async def approve_onboarding_activation(
    tenant_id: int,
    db: Session = Depends(get_db),
    email_service=Depends(get_email_service),
    current_user: User = Depends(require_tenant_governance_manager),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant bulunamadi")

    payment_status = str(tenant.onboarding_payment_status or "not_required").lower()
    if payment_status not in {"verified", "not_required", "succeeded"}:
        raise HTTPException(
            status_code=400, detail="Uyelik aktivasyonu icin odeme once dogrulanmali"
        )
    unresolved_category_requests = [
        item
        for item in _read_category_requests(tenant)
        if str(item.get("status") or "pending_support").lower()
        not in {"final_approved", "rejected"}
    ]
    if unresolved_category_requests:
        raise HTTPException(
            status_code=400,
            detail="Bekleyen kategori talepleri cozulmeden uyelik aktivasyonu onaylanamaz",
        )

    tenant.onboarding_approval_status = "approved"
    tenant.onboarding_rejected_at = None
    tenant.onboarding_rejected_by_user_id = None
    tenant.onboarding_activation_notes = None
    tenant.onboarding_approved_at = utcnow()
    tenant.onboarding_approved_by_user_id = current_user.id
    tenant.onboarding_status = "active"
    tenant.status = "active"
    tenant.is_active = True
    _append_onboarding_timeline(
        tenant,
        action="activation_approved",
        actor_name=current_user.full_name,
        actor_type="admin",
        note="Uyelik aktivasyonu onaylandi",
    )
    ensure_tenant_subscription_for_plan(
        db,
        tenant,
        subscription_plan_code=tenant.subscription_plan_code or "starter",
        status_value="active",
    )
    admin_user = None
    if tenant.owner_user_id:
        admin_user = db.query(User).filter(User.id == tenant.owner_user_id).first()
    _seed_default_procurement_catalog_for_tenant(
        db,
        tenant,
        admin_user.id if admin_user else tenant.owner_user_id,
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    invitation_sent = False
    if (
        admin_user
        and admin_user.invitation_token
        and not admin_user.invitation_accepted
    ):
        try:
            invitation_sent = email_service.send_internal_user_invitation(
                to_email=admin_user.email,
                full_name=admin_user.full_name,
                activation_token=admin_user.invitation_token,
                company_name=tenant.brand_name or tenant.legal_name,
                owner_user_id=current_user.id,
            )
        except Exception:
            invitation_sent = False
    return _serialize_tenant(db, tenant, initial_admin_email_sent=invitation_sent)


@router.post(
    "/tenants/{tenant_id}/approve-onboarding-activation-force", response_model=TenantOut
)
async def force_approve_onboarding_activation(
    tenant_id: int,
    db: Session = Depends(get_db),
    email_service=Depends(get_email_service),
    current_user: User = Depends(require_tenant_governance_manager),
):
    if not is_super_admin(current_user):
        raise HTTPException(
            status_code=403, detail="Bu islem sadece super admin tarafindan yapilabilir"
        )

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant bulunamadi")
    if not _is_demo_tenant(tenant):
        raise HTTPException(
            status_code=400,
            detail="Zorla aktivasyon onayi yalnizca demo tenantlar icin kullanilabilir",
        )

    payment_status = str(tenant.onboarding_payment_status or "not_required").lower()
    if payment_status not in {"verified", "not_required", "succeeded"}:
        tenant.onboarding_payment_status = "verified"
        tenant.onboarding_payment_method = (
            tenant.onboarding_payment_method or "super_admin_force"
        )
        tenant.onboarding_payment_verified_at = (
            tenant.onboarding_payment_verified_at or utcnow()
        )

    tenant.onboarding_approval_status = "approved"
    tenant.onboarding_rejected_at = None
    tenant.onboarding_rejected_by_user_id = None
    tenant.onboarding_activation_notes = None
    tenant.onboarding_approved_at = utcnow()
    tenant.onboarding_approved_by_user_id = current_user.id
    tenant.onboarding_status = "active"
    tenant.status = "active"
    tenant.is_active = True
    _append_onboarding_timeline(
        tenant,
        action="activation_approved_force",
        actor_name=current_user.full_name,
        actor_type="admin",
        note="Demo tenant icin super admin zorla aktivasyon onayi verdi",
    )
    ensure_tenant_subscription_for_plan(
        db,
        tenant,
        subscription_plan_code=tenant.subscription_plan_code or "starter",
        status_value="active",
    )

    admin_user = None
    if tenant.owner_user_id:
        admin_user = db.query(User).filter(User.id == tenant.owner_user_id).first()
    _seed_default_procurement_catalog_for_tenant(
        db,
        tenant,
        admin_user.id if admin_user else tenant.owner_user_id,
    )

    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    invitation_sent = False
    if (
        admin_user
        and admin_user.invitation_token
        and not admin_user.invitation_accepted
    ):
        try:
            invitation_sent = email_service.send_internal_user_invitation(
                to_email=admin_user.email,
                full_name=admin_user.full_name,
                activation_token=admin_user.invitation_token,
                company_name=tenant.brand_name or tenant.legal_name,
                owner_user_id=current_user.id,
            )
        except Exception:
            invitation_sent = False

    return _serialize_tenant(db, tenant, initial_admin_email_sent=invitation_sent)


@router.post(
    "/tenants/{tenant_id}/reject-onboarding-activation", response_model=TenantOut
)
async def reject_onboarding_activation(
    tenant_id: int,
    payload: OnboardingDecisionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_governance_manager),
    email_service=Depends(get_email_service),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant bulunamadi")

    tenant.onboarding_approval_status = "rejected"
    tenant.onboarding_rejected_at = utcnow()
    tenant.onboarding_rejected_by_user_id = current_user.id
    tenant.onboarding_approved_at = None
    tenant.onboarding_approved_by_user_id = None
    tenant.onboarding_activation_notes = (payload.note or "").strip() or None
    tenant.onboarding_status = "draft"
    tenant.status = "paused"
    tenant.is_active = False
    _append_onboarding_timeline(
        tenant,
        action="activation_rejected",
        actor_name=current_user.full_name,
        actor_type="admin",
        note=tenant.onboarding_activation_notes,
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    owner = None
    if tenant.owner_user_id:
        owner = db.query(User).filter(User.id == tenant.owner_user_id).first()
    if owner and owner.email:
        email_service.send_onboarding_status_update(
            to_email=owner.email,
            full_name=owner.full_name,
            company_name=tenant.brand_name or tenant.legal_name,
            decision="rejected",
            note=tenant.onboarding_activation_notes,
            owner_user_id=current_user.id,
        )

    return _serialize_tenant(db, tenant)


@router.post("/tenants", response_model=TenantOut)
async def create_tenant(
    payload: TenantCreate,
    db: Session = Depends(get_db),
    email_service=Depends(get_email_service),
    current_user: User = Depends(require_tenant_governance_manager),
):
    try:
        subscription_plan_code = validate_subscription_plan_code(
            payload.subscription_plan_code
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    initial_admin_user: User | None = None
    initial_admin_email_sent = False

    if payload.initial_admin:
        existing_user = (
            db.query(User).filter(User.email == payload.initial_admin.email).first()
        )
        if existing_user and not existing_user.hidden_from_admin:
            raise HTTPException(
                status_code=400, detail="Ilk tenant admin e-postasi zaten kayitli"
            )

    slug = _ensure_unique_tenant_slug(
        db, _slugify_tenant(payload.slug or payload.brand_name or payload.legal_name)
    )
    tenant = Tenant(
        slug=slug,
        legal_name=payload.legal_name,
        brand_name=payload.brand_name,
        category=payload.category,
        category_tags_json=_write_json_string_list(payload.category_tags),
        target_category_tags_json=_write_json_string_list(payload.target_category_tags),
        category_requests_json=(
            json.dumps(payload.category_requests) if payload.category_requests else None
        ),
        logo_url=payload.logo_url,
        tax_number=payload.tax_number,
        tax_office=payload.tax_office,
        country=payload.country,
        city=payload.city,
        address=payload.address,
        subscription_plan_code=subscription_plan_code,
        owner_user_id=payload.owner_user_id,
        status=payload.status,
        onboarding_status=payload.onboarding_status,
        is_active=payload.is_active,
    )
    db.add(tenant)
    db.flush()
    ensure_tenant_subscription_for_plan(
        db,
        tenant,
        subscription_plan_code=subscription_plan_code,
        status_value="active" if payload.is_active else "paused",
    )
    db.add(
        TenantSettings(
            tenant_id=tenant.id,
            smtp_mode="platform_default",
            locale="tr-TR",
            timezone="Europe/Istanbul",
            is_active=True,
        )
    )

    if payload.initial_admin:
        placeholder_password = secrets.token_urlsafe(24)
        invitation_token = secrets.token_urlsafe(32)
        invitation_expires = datetime.now(timezone.utc) + timedelta(hours=24)
        initial_admin_user = User(
            email=payload.initial_admin.email,
            full_name=payload.initial_admin.full_name,
            hashed_password=get_password_hash(placeholder_password),
            role="admin",
            system_role="tenant_admin",
            approval_limit=300000,
            personal_phone=payload.initial_admin.personal_phone,
            company_phone=payload.initial_admin.company_phone,
            company_phone_short=payload.initial_admin.company_phone_short,
            is_active=True,
            hidden_from_admin=False,
            deleted_original_email=None,
            tenant_id=tenant.id,
            created_by_id=current_user.id,
            invitation_token=invitation_token,
            invitation_token_expires=invitation_expires,
            invitation_accepted=False,
        )
        db.add(initial_admin_user)
        db.flush()
        tenant.owner_user_id = initial_admin_user.id

    db.commit()
    db.refresh(tenant)
    if initial_admin_user is not None:
        db.refresh(initial_admin_user)
        try:
            initial_admin_email_sent = email_service.send_internal_user_invitation(
                to_email=initial_admin_user.email,
                full_name=initial_admin_user.full_name,
                activation_token=initial_admin_user.invitation_token,
                company_name=tenant.brand_name or tenant.legal_name,
                owner_user_id=None,
            )
        except Exception:
            initial_admin_email_sent = False
    return _serialize_tenant(
        db, tenant, initial_admin_email_sent=initial_admin_email_sent
    )


@router.put("/tenants/{tenant_id}", response_model=TenantOut)
async def update_tenant(
    tenant_id: int,
    payload: TenantUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_manager),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant bulunamadi")

    update_data = payload.model_dump(exclude_unset=True)
    if "subscription_plan_code" in update_data:
        try:
            update_data["subscription_plan_code"] = validate_subscription_plan_code(
                update_data.get("subscription_plan_code")
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    if "owner_user_id" in update_data:
        _ensure_tenant_owner_candidate(db, tenant, update_data["owner_user_id"])
    if "slug" in update_data and update_data["slug"]:
        update_data["slug"] = _ensure_unique_tenant_slug(
            db, _slugify_tenant(str(update_data["slug"])), tenant.id
        )
    elif any(key in update_data for key in {"brand_name", "legal_name"}):
        base_name = str(
            update_data.get("brand_name")
            or update_data.get("legal_name")
            or tenant.brand_name
            or tenant.legal_name
        )
        update_data["slug"] = _ensure_unique_tenant_slug(
            db, _slugify_tenant(base_name), tenant.id
        )

    if "category_tags" in update_data:
        category_tags = [
            str(item or "").strip() for item in update_data.pop("category_tags") or []
        ]
        tenant.category_tags_json = _write_json_string_list(category_tags)
        if category_tags and not update_data.get("category"):
            update_data["category"] = category_tags[0]
    if "target_category_tags" in update_data:
        target_category_tags = [
            str(item or "").strip()
            for item in update_data.pop("target_category_tags") or []
        ]
        tenant.target_category_tags_json = _write_json_string_list(target_category_tags)
    if "category_requests" in update_data:
        category_requests = update_data.pop("category_requests") or []
        tenant.category_requests_json = (
            json.dumps(category_requests) if category_requests else None
        )

    next_status = str(update_data.get("status") or tenant.status or "").lower()
    next_onboarding_status = str(
        update_data.get("onboarding_status") or tenant.onboarding_status or ""
    ).lower()
    next_is_active = update_data.get("is_active")
    wants_active = (
        next_status == "active"
        or next_onboarding_status == "active"
        or next_is_active is True
    )
    if wants_active and not _can_activate_onboarding_tenant(tenant):
        raise HTTPException(
            status_code=409,
            detail="Bu tenant odeme dogrulama ve uyelik aktivasyon onayi tamamlanmadan aktif edilemez",
        )

    for key, value in update_data.items():
        setattr(tenant, key, value)

    ensure_tenant_subscription_for_plan(
        db,
        tenant,
        subscription_plan_code=tenant.subscription_plan_code or "starter",
        status_value="active" if tenant.is_active else "paused",
    )

    db.commit()
    db.refresh(tenant)
    return _serialize_tenant(db, tenant)


@router.delete("/tenants/{tenant_id}")
async def delete_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_manager),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant bulunamadi")
    if tenant.is_active or str(tenant.status or "").lower() == "active":
        raise HTTPException(
            status_code=400,
            detail="Tenant tamamen silinmeden once pasife alinmalidir",
        )

    try:
        _purge_tenant_workspace(db, tenant)
        db.query(Tenant).filter(Tenant.id == tenant_id).delete(
            synchronize_session=False
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Tenant silinirken hata olustu: {exc}",
        ) from exc

    return {"message": "Tenant ve iliskili kayitlari silindi"}


@router.patch("/tenants/{tenant_id}/support-workflow", response_model=TenantOut)
async def update_tenant_support_workflow(
    tenant_id: int,
    payload: TenantSupportWorkflowUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_reader),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant bulunamadi")

    update_data = payload.model_dump(exclude_unset=True)
    next_status = (
        str(update_data.get("support_status") or tenant.support_status or "new")
        .strip()
        .lower()
    )
    resolution_reason = str(
        update_data.get("support_resolution_reason")
        or tenant.support_resolution_reason
        or ""
    ).strip()
    if next_status == "resolved" and not resolution_reason:
        raise HTTPException(
            status_code=400,
            detail="Cozulen destek kaydi icin kapanis nedeni zorunludur",
        )
    if next_status != "resolved" and "support_resolution_reason" not in update_data:
        update_data["support_resolution_reason"] = None

    for key, value in update_data.items():
        setattr(tenant, key, value)

    db.commit()
    db.refresh(tenant)
    return _serialize_tenant(db, tenant)


@router.get("/companies", response_model=list[CompanyOut])
async def list_companies(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_catalog_reader),
):
    """Tüm firmaları listele"""
    query = db.query(Company)
    query = _restrict_companies_query_for_admin(query, current_user)
    companies = query.order_by(Company.name.asc()).all()

    company_ids = [company.id for company in companies]
    quote_count_by_company_id: dict[int, int] = {}
    personnel_count_by_company_id: dict[int, int] = {}
    tenant_personnel_count_by_tenant_id: dict[int, int] = {}

    if company_ids:
        quote_rows = (
            db.query(
                Project.company_id.label("company_id"),
                func.count(Quote.id).label("quote_count"),
            )
            .join(Quote, Quote.project_id == Project.id)
            .filter(
                Project.company_id.in_(company_ids),
                Quote.deleted_at.is_(None),
            )
            .group_by(Project.company_id)
            .all()
        )
        quote_count_by_company_id = {
            int(row.company_id): int(row.quote_count or 0)
            for row in quote_rows
            if row.company_id is not None
        }

        personnel_rows = (
            db.query(
                CompanyRole.company_id.label("company_id"),
                func.count(func.distinct(CompanyRole.user_id)).label("personnel_count"),
            )
            .join(User, User.id == CompanyRole.user_id)
            .filter(
                CompanyRole.company_id.in_(company_ids),
                CompanyRole.is_active.is_(True),
                User.is_active.is_(True),
            )
            .group_by(CompanyRole.company_id)
            .all()
        )
        personnel_count_by_company_id = {
            int(row.company_id): int(row.personnel_count or 0)
            for row in personnel_rows
            if row.company_id is not None
        }

        tenant_ids = sorted(
            {
                int(company.tenant_id)
                for company in companies
                if company.tenant_id is not None
            }
        )
        if tenant_ids:
            tenant_personnel_rows = (
                db.query(
                    User.tenant_id.label("tenant_id"),
                    func.count(User.id).label("personnel_count"),
                )
                .filter(
                    User.tenant_id.in_(tenant_ids),
                    User.is_active.is_(True),
                )
                .group_by(User.tenant_id)
                .all()
            )
            tenant_personnel_count_by_tenant_id = {
                int(row.tenant_id): int(row.personnel_count or 0)
                for row in tenant_personnel_rows
                if row.tenant_id is not None
            }

    settings = get_or_create_system_settings(db)
    primary_company_id = getattr(settings, "platform_primary_company_id", None)
    companies.sort(
        key=lambda company: (
            0 if company.id == primary_company_id else 1,
            company.name.lower(),
        )
    )
    response: list[CompanyOut] = []
    for company in companies:
        owner_full_name: str | None = None
        owner_email: str | None = None
        owner_user: User | None = None

        if (
            company.tenant is not None
            and getattr(company.tenant, "owner_user", None) is not None
        ):
            owner_user = company.tenant.owner_user
        elif company.tenant_id is not None:
            tenant = db.query(Tenant).filter(Tenant.id == company.tenant_id).first()
            owner_user = tenant.owner_user if tenant else None

        if owner_user is None and company.created_by_id is not None:
            owner_user = db.query(User).filter(User.id == company.created_by_id).first()

        if owner_user is not None:
            owner_full_name = owner_user.full_name
            owner_email = owner_user.email

        fallback_tenant_personnel_count = (
            tenant_personnel_count_by_tenant_id.get(int(company.tenant_id), 0)
            if company.tenant_id is not None
            else 0
        )
        resolved_personnel_count = personnel_count_by_company_id.get(
            company.id,
            fallback_tenant_personnel_count,
        )
        response.append(
            CompanyOut.model_validate(company, from_attributes=True).model_copy(
                update={
                    "is_platform_primary": company.id == primary_company_id,
                    "quote_count": quote_count_by_company_id.get(company.id, 0),
                    "personnel_count": resolved_personnel_count,
                    "owner_full_name": owner_full_name,
                    "owner_email": owner_email,
                }
            )
        )
    return response


@router.post("/companies", response_model=CompanyOut)
async def create_company(
    company: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """Yeni firma ekle"""
    existing_query = db.query(Company).filter(Company.name == company.name)
    existing_query = _restrict_companies_query_for_admin(existing_query, current_user)
    existing = existing_query.first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Bu firma zaten mevcut"
        )

    enforce_active_company_limit(db, _current_tenant(db, current_user))

    tenant_id = _current_tenant_id(current_user)
    company_payload = company.model_dump()
    requested_primary = bool(company_payload.get("is_primary", False))
    has_primary = False
    if tenant_id is not None:
        has_primary = (
            db.query(Company.id)
            .filter(Company.tenant_id == tenant_id, Company.is_primary == True)
            .first()
            is not None
        )
        company_payload["is_primary"] = requested_primary or not has_primary

    new_company = Company(
        **company_payload,
        created_by_id=current_user.id,
        tenant_id=tenant_id,
    )
    db.add(new_company)
    db.commit()
    db.refresh(new_company)
    if tenant_id is not None and new_company.is_primary:
        (
            db.query(Company)
            .filter(Company.tenant_id == tenant_id, Company.id != new_company.id)
            .update({"is_primary": False}, synchronize_session=False)
        )
        db.commit()
        db.refresh(new_company)
    settings = get_or_create_system_settings(db)
    if is_super_admin(current_user) and _current_tenant_id(current_user) is None:
        if getattr(settings, "platform_primary_company_id", None) is None:
            settings.platform_primary_company_id = new_company.id
            db.add(settings)
            db.commit()
            db.refresh(new_company)
    return _serialize_company(db, new_company)


@router.put("/companies/{company_id}", response_model=CompanyOut)
async def update_company(
    company_id: int,
    company: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """Firma bilgilerini güncelle"""
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if not db_company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Firma bulunamadı"
        )

    _ensure_company_scope(db, current_user, company_id)

    settings = get_or_create_system_settings(db)
    is_platform_primary = db_company.id == getattr(
        settings, "platform_primary_company_id", None
    )

    update_data = company.model_dump(exclude_unset=True)
    if is_platform_primary and update_data.get("is_active") is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Platform ana firma pasife alinamaz",
        )

    if "name" in update_data and update_data["name"] != db_company.name:
        existing_query = db.query(Company).filter(
            Company.name == str(update_data["name"])
        )
        existing_query = _restrict_companies_query_for_admin(
            existing_query, current_user
        )
        existing_query = existing_query.filter(Company.id != company_id)
        existing = existing_query.first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Bu firma zaten mevcut"
            )
    for key, value in update_data.items():
        setattr(db_company, key, value)

    if update_data.get("is_primary") is True and db_company.tenant_id is not None:
        (
            db.query(Company)
            .filter(
                Company.tenant_id == db_company.tenant_id,
                Company.id != db_company.id,
            )
            .update({"is_primary": False}, synchronize_session=False)
        )

    if update_data.get("is_primary") is False and db_company.tenant_id is not None:
        has_other_primary = (
            db.query(Company.id)
            .filter(
                Company.tenant_id == db_company.tenant_id,
                Company.id != db_company.id,
                Company.is_primary == True,
            )
            .first()
            is not None
        )
        if not has_other_primary:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="En az bir ana firma bulunmalidir",
            )

    db.commit()
    db.refresh(db_company)
    return _serialize_company(db, db_company)


@router.post("/companies/{company_id}/logo", response_model=dict)
async def upload_company_logo(
    company_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """Firma logosu yükle (dosya)"""
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Firma bulunamadı")
    _ensure_company_scope(db, current_user, company_id)

    allowed_types = {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
    }
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Sadece resim dosyaları yüklenebilir (JPEG, PNG, GIF, WebP, SVG)",
        )

    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Logo dosyası 2MB'dan büyük olamaz")

    upload_dir = os.path.join("uploads", "company_logos")
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "logo.png")[1].lower() or ".png"
    filename = f"company_{company_id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(upload_dir, filename)

    if db_company.logo_url:
        old_file = os.path.basename(str(db_company.logo_url))
        old_path = os.path.join(upload_dir, old_file)
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception:
                pass

    with open(file_path, "wb") as f:
        f.write(content)

    logo_url = f"/api/v1/admin/company-logo/{filename}"
    db_company.logo_url = logo_url
    db.commit()
    db.refresh(db_company)
    return {"status": "success", "logo_url": logo_url}


@router.get("/company-logo/{filename}")
async def get_company_logo(filename: str):
    """Firma logosunu sun"""
    safe_name = os.path.basename(filename)
    file_path = os.path.join("uploads", "company_logos", safe_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Logo bulunamadı")
    return FileResponse(file_path)


@router.delete("/companies/{company_id}")
async def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """Firma sil"""
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if not db_company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Firma bulunamadı"
        )

    _ensure_company_scope(db, current_user, company_id)

    settings = get_or_create_system_settings(db)
    if db_company.id == getattr(settings, "platform_primary_company_id", None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Platform ana firma silinemez",
        )

    db.execute(delete(CompanyRole).where(CompanyRole.company_id == company_id))
    db.execute(
        delete(user_company_roles).where(user_company_roles.c.company_id == company_id)
    )
    db.execute(delete(user_company).where(user_company.c.company_id == company_id))
    db.execute(
        delete(company_department).where(company_department.c.company_id == company_id)
    )

    db.delete(db_company)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firma silinemedi. Firmaya bağlı kayıtları (proje/atama) önce kaldırın.",
        ) from exc
    return {"message": "Firma başarıyla silindi"}


# ==================== DEPARTMENT ENDPOINTS ====================


@router.get("/departments", response_model=list[DepartmentOut])
async def list_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_catalog_user),
    is_active: bool | None = None,
    include_duplicates: bool = False,
    tenant_id: int | None = None,
):
    """Tüm departmanları veya filtreli listele"""
    query = db.query(Department)
    if tenant_id is not None:
        if not is_super_admin(current_user):
            current_tenant_id = _current_tenant_id(current_user)
            if current_tenant_id is None or int(current_tenant_id) != int(tenant_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Bu tenant icin departman katalogu goruntuleme yetkiniz yok",
                )
        query = query.filter(Department.tenant_id == tenant_id)
    query = _restrict_departments_query_for_workspace(query, current_user)
    if is_active is not None:
        query = query.filter(Department.is_active == is_active)
    rows = query.all()
    if include_duplicates:
        return rows
    return _dedupe_departments_by_normalized_name(rows)


@router.post("/departments", response_model=DepartmentOut)
async def create_department(
    dept: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """Yeni departman ekle"""
    _ensure_common_catalog_manage_access(
        db, current_user, CATALOG_DEPARTMENT_MANAGE_PERMISSION_KEY
    )

    existing_query = db.query(Department).filter(Department.name == dept.name)
    target_tenant_id = (
        int(dept.tenant_id)
        if is_super_admin(current_user) and dept.tenant_id is not None
        else _current_tenant_id(current_user)
    )
    existing_query = _restrict_departments_query_for_admin(existing_query, current_user)
    existing_query = existing_query.filter(Department.tenant_id == target_tenant_id)
    existing = existing_query.first()
    if not existing:
        semantic_scope_query = _restrict_departments_query_for_admin(
            db.query(Department), current_user
        )
        semantic_scope_query = semantic_scope_query.filter(
            Department.tenant_id == target_tenant_id
        )
        semantic_duplicate = _find_semantic_duplicate_department(
            semantic_scope_query.all(), incoming_name=dept.name
        )
        existing = semantic_duplicate
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Bu departman zaten mevcut"
        )

    new_dept = Department(
        **dept.model_dump(exclude={"tenant_id"}),
        created_by_id=None if is_super_admin(current_user) else current_user.id,
        tenant_id=target_tenant_id,
    )
    db.add(new_dept)
    db.commit()
    db.refresh(new_dept)
    return new_dept


@router.put("/departments/{dept_id}", response_model=DepartmentOut)
async def update_department(
    dept_id: int,
    dept_data: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """Departman güncelle"""
    _ensure_common_catalog_manage_access(
        db, current_user, CATALOG_DEPARTMENT_MANAGE_PERMISSION_KEY
    )

    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Departman bulunamadı")
    _ensure_department_scope(db, current_user, dept_id)

    update_data = dept_data.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != dept.name:
        existing_query = db.query(Department).filter(
            Department.name == str(update_data["name"])
        )
        existing_query = _restrict_departments_query_for_admin(
            existing_query, current_user
        )
        existing_query = existing_query.filter(Department.tenant_id == dept.tenant_id)
        existing_query = existing_query.filter(Department.id != dept_id)
        existing = existing_query.first()
        if not existing:
            semantic_scope_query = _restrict_departments_query_for_admin(
                db.query(Department), current_user
            ).filter(Department.id != dept_id)
            semantic_scope_query = semantic_scope_query.filter(
                Department.tenant_id == dept.tenant_id
            )
            semantic_duplicate = _find_semantic_duplicate_department(
                semantic_scope_query.all(),
                incoming_name=str(update_data["name"]),
                excluded_department_id=dept_id,
            )
            existing = semantic_duplicate
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bu departman zaten mevcut",
            )
    for field, value in update_data.items():
        if field == "tenant_id":
            continue
        setattr(dept, field, value)

    db.commit()
    db.refresh(dept)
    return dept


@router.delete("/departments/{dept_id}")
async def delete_department(
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """Departman sil"""
    _ensure_common_catalog_manage_access(
        db, current_user, CATALOG_DEPARTMENT_MANAGE_PERMISSION_KEY
    )

    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Departman bulunamadı")
    _ensure_department_scope(db, current_user, dept_id)

    if is_super_admin(current_user):
        try:
            db.execute(
                delete(company_department).where(
                    company_department.c.department_id == dept_id
                )
            )
            db.execute(
                delete(user_department).where(
                    user_department.c.department_id == dept_id
                )
            )
            db.query(CompanyRole).filter(CompanyRole.department_id == dept_id).update(
                {CompanyRole.department_id: None}, synchronize_session=False
            )
            db.query(User).filter(User.department_id == dept_id).update(
                {User.department_id: None}, synchronize_session=False
            )
            db.query(Quote).filter(Quote.department_id == dept_id).update(
                {Quote.department_id: None}, synchronize_session=False
            )
            db.delete(dept)
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500, detail=f"Departman silinirken hata oluÅŸtu: {str(e)}"
            )
        return {"message": "Departman silindi"}

    # Check if department has users
    users_count = db.query(User).filter(User.department_id == dept_id).count()
    if users_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bu departmanda {users_count} personel var. Önce onları başka departmana taşıyın",
        )

    try:
        db.delete(dept)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Departman silinirken hata oluştu: {str(e)}"
        )
    return {"message": "Departman silindi"}


# ==================== ROLE ENDPOINTS ====================


@router.get("/roles", response_model=list[RoleOut])
async def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_catalog_reader),
    include_duplicates: bool = False,
    tenant_id: int | None = None,
    exclude_reserved: bool = False,
):
    """Tüm rolleri listele"""
    query = db.query(Role).filter(Role.is_active)

    if tenant_id is not None:
        if not is_super_admin(current_user):
            current_tenant_id = _current_tenant_id(current_user)
            if current_tenant_id is None or int(current_tenant_id) != int(tenant_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Bu tenant icin rol katalogu goruntuleme yetkiniz yok",
                )
        query = query.filter(Role.tenant_id == tenant_id)

    query = _restrict_roles_query_for_role_management(query, current_user)
    rows = query.all()

    if exclude_reserved:
        rows = [row for row in rows if not is_reserved_workspace_role(row.name)]

    if include_duplicates:
        return rows
    return _dedupe_roles_by_normalized_name(rows)


@router.post("/roles", response_model=RoleOut)
async def create_role(
    role_data: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role_management_user),
):
    """Yeni rol ekle"""
    _ensure_common_catalog_manage_access(
        db, current_user, CATALOG_ROLE_MANAGE_PERMISSION_KEY
    )

    if not is_super_admin(current_user) and is_reserved_workspace_role(role_data.name):
        raise HTTPException(
            status_code=400,
            detail="Admin ve super admin rolleri tenant bazinda olusturulamaz",
        )

    target_tenant_id = (
        int(role_data.tenant_id)
        if is_super_admin(current_user) and role_data.tenant_id is not None
        else _current_tenant_id(current_user)
    )

    existing_query = db.query(Role).filter(Role.name == role_data.name)
    existing_query = _restrict_roles_query_for_role_management(
        existing_query, current_user
    )
    existing_query = existing_query.filter(Role.tenant_id == target_tenant_id)
    existing = existing_query.first()
    if not existing:
        semantic_scope_query = _restrict_roles_query_for_role_management(
            db.query(Role), current_user
        )
        semantic_scope_query = semantic_scope_query.filter(
            Role.tenant_id == target_tenant_id
        )
        semantic_duplicate = _find_semantic_duplicate_role(
            semantic_scope_query.all(), incoming_name=role_data.name
        )
        existing = semantic_duplicate
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Bu rol zaten mevcut"
        )

    # Calculate hierarchy level based on parent
    hierarchy_level = 0
    if role_data.parent_id:
        _ensure_role_scope(db, current_user, role_data.parent_id)
        parent_role = db.query(Role).filter(Role.id == role_data.parent_id).first()
        if not parent_role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Parent rol bulunamadı"
            )
        _ensure_manageable_role_level(current_user, parent_role)
        _ensure_manageable_new_role_level(current_user, parent_role)
        hierarchy_level = parent_role.hierarchy_level + 1
    else:
        _ensure_manageable_new_role_level(current_user, None)

    new_role = Role(
        name=role_data.name,
        description=role_data.description,
        created_by_id=None if is_super_admin(current_user) else current_user.id,
        tenant_id=target_tenant_id,
        parent_id=role_data.parent_id,
        hierarchy_level=hierarchy_level,
        is_active=True,
    )

    # Add permissions if provided
    if role_data.permission_ids:
        permissions = (
            db.query(Permission)
            .filter(Permission.id.in_(role_data.permission_ids))
            .all()
        )
        new_role.permissions = permissions

    db.add(new_role)
    db.commit()
    db.refresh(new_role)
    _ensure_workspace_panel_profile_for_role(db, current_user, role_data.name)
    return new_role


@router.put("/roles/{role_id}", response_model=RoleOut)
async def update_role(
    role_id: int,
    role_data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role_management_user),
):
    """Rol güncelle"""
    _ensure_common_catalog_manage_access(
        db, current_user, CATALOG_ROLE_MANAGE_PERMISSION_KEY
    )

    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rol bulunamadı"
        )

    _ensure_role_scope(db, current_user, role_id)
    if not is_super_admin(current_user) and is_reserved_workspace_role(role.name):
        raise HTTPException(
            status_code=400, detail="Admin kendi yonetici rolunu duzenleyemez"
        )
    _ensure_manageable_role_level(current_user, role)

    update_data = role_data.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != role.name:
        existing_query = db.query(Role).filter(Role.name == str(update_data["name"]))
        existing_query = _restrict_roles_query_for_role_management(
            existing_query, current_user
        )
        existing_query = existing_query.filter(Role.tenant_id == role.tenant_id)
        existing_query = existing_query.filter(Role.id != role_id)
        existing = existing_query.first()
        if not existing:
            semantic_scope_query = _restrict_roles_query_for_role_management(
                db.query(Role), current_user
            ).filter(Role.id != role_id)
            semantic_scope_query = semantic_scope_query.filter(
                Role.tenant_id == role.tenant_id
            )
            semantic_duplicate = _find_semantic_duplicate_role(
                semantic_scope_query.all(),
                incoming_name=str(update_data["name"]),
                excluded_role_id=role_id,
            )
            existing = semantic_duplicate
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Bu rol zaten mevcut"
            )

    # Handle permissions separately
    update_data.pop("tenant_id", None)
    permission_ids = update_data.pop("permission_ids", None)
    parent_id = update_data.pop("parent_id", None)

    # If parent_id changed, recalculate hierarchy_level
    if parent_id is not None:
        _ensure_role_scope(db, current_user, parent_id)
        parent_role = db.query(Role).filter(Role.id == parent_id).first()
        if parent_role:
            _ensure_manageable_role_level(current_user, parent_role)
            _ensure_manageable_new_role_level(current_user, parent_role)
            update_data["hierarchy_level"] = parent_role.hierarchy_level + 1
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Parent rol bulunamadı"
            )

    # Apply updates
    for field, value in update_data.items():
        setattr(role, field, value)

    if parent_id is not None:
        role.parent_id = parent_id

    if permission_ids is not None:
        permissions = (
            db.query(Permission).filter(Permission.id.in_(permission_ids)).all()
        )
        role.permissions = permissions

    db.commit()
    db.refresh(role)
    return role


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role_management_user),
):
    """Rol sil"""
    _ensure_common_catalog_manage_access(
        db, current_user, CATALOG_ROLE_MANAGE_PERMISSION_KEY
    )

    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rol bulunamadı"
        )

    _ensure_role_scope(db, current_user, role_id)
    if not is_super_admin(current_user) and is_reserved_workspace_role(role.name):
        raise HTTPException(
            status_code=400, detail="Admin kendi yonetici rolunu silemez"
        )
    _ensure_manageable_role_level(current_user, role)

    try:
        db.execute(
            delete(user_company_roles).where(user_company_roles.c.role_id == role_id)
        )
        db.execute(
            delete(role_permissions).where(role_permissions.c.role_id == role_id)
        )
        db.query(CompanyRole).filter(CompanyRole.role_id == role_id).delete(
            synchronize_session=False
        )
        db.query(Role).filter(Role.parent_id == role_id).update(
            {Role.parent_id: None, Role.hierarchy_level: 0}, synchronize_session=False
        )
        db.delete(role)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Rol silinirken hata olustu: {str(e)}"
        )
    return {"message": "Rol basariyla silindi"}


@router.get("/catalog-merges/preview", response_model=CatalogMergePreviewOut)
async def preview_catalog_merges(
    entity_type: Literal["role", "department"],
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role_management_user),
):
    if not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Duplicate merge onizlemesi yalnizca super admin tarafindan yapilabilir",
        )

    if entity_type == "role":
        query = db.query(Role)
        if tenant_id is None:
            query = query.filter(Role.tenant_id.is_(None))
        else:
            query = query.filter(Role.tenant_id == tenant_id)
        rows = query.all()
        groups = _build_role_duplicate_groups(db, rows)
    else:
        query = db.query(Department)
        if tenant_id is None:
            query = query.filter(Department.tenant_id.is_(None))
        else:
            query = query.filter(Department.tenant_id == tenant_id)
        rows = query.all()
        groups = _build_department_duplicate_groups(db, rows)

    return CatalogMergePreviewOut(
        entity_type=entity_type,
        tenant_id=tenant_id,
        groups=groups,
    )


@router.post("/catalog-merges/apply", response_model=CatalogMergeApplyOut)
async def apply_catalog_merge(
    payload: CatalogMergeApplyIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role_management_user),
):
    if not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Duplicate merge islemi yalnizca super admin tarafindan yapilabilir",
        )

    source_ids = sorted(
        {
            int(item)
            for item in payload.source_ids
            if int(item) != int(payload.target_id)
        }
    )
    if not source_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Merge icin en az bir kaynak kayit secilmelidir",
        )

    if payload.entity_type == "role":
        target = db.query(Role).filter(Role.id == int(payload.target_id)).first()
        if not target:
            raise HTTPException(status_code=404, detail="Hedef rol bulunamadi")
        sources = db.query(Role).filter(Role.id.in_(source_ids)).all()
        if len(sources) != len(source_ids):
            raise HTTPException(
                status_code=404, detail="Kaynak rollerden biri bulunamadi"
            )
        if any(int(item.id) == int(target.id) for item in sources):
            raise HTTPException(
                status_code=400, detail="Hedef rol kaynak listesine dahil olamaz"
            )
        if any(item.tenant_id != target.tenant_id for item in sources):
            raise HTTPException(
                status_code=400, detail="Ayni tenant disindaki roller birlestirilemez"
            )
        if any(
            _normalize_catalog_name(item.name) != _normalize_catalog_name(target.name)
            for item in sources
        ):
            raise HTTPException(
                status_code=400,
                detail="Sadece ayni normalize ada sahip roller birlestirilebilir",
            )

        snapshot, moved_count = _apply_role_merge(db, target, sources)
        tenant_id = target.tenant_id
    else:
        target = (
            db.query(Department).filter(Department.id == int(payload.target_id)).first()
        )
        if not target:
            raise HTTPException(status_code=404, detail="Hedef departman bulunamadi")
        sources = db.query(Department).filter(Department.id.in_(source_ids)).all()
        if len(sources) != len(source_ids):
            raise HTTPException(
                status_code=404, detail="Kaynak departmanlardan biri bulunamadi"
            )
        if any(int(item.id) == int(target.id) for item in sources):
            raise HTTPException(
                status_code=400, detail="Hedef departman kaynak listesine dahil olamaz"
            )
        if any(item.tenant_id != target.tenant_id for item in sources):
            raise HTTPException(
                status_code=400,
                detail="Ayni tenant disindaki departmanlar birlestirilemez",
            )
        if any(
            _normalize_catalog_name(item.name) != _normalize_catalog_name(target.name)
            for item in sources
        ):
            raise HTTPException(
                status_code=400,
                detail="Sadece ayni normalize ada sahip departmanlar birlestirilebilir",
            )

        snapshot, moved_count = _apply_department_merge(db, target, sources)
        tenant_id = target.tenant_id

    rollback_token = secrets.token_urlsafe(24)
    rollback_expires_at = utcnow() + timedelta(minutes=MERGE_ROLLBACK_WINDOW_MINUTES)
    snapshot["expires_at"] = rollback_expires_at
    _cleanup_expired_catalog_merge_rollbacks()
    _catalog_merge_rollback_cache[rollback_token] = snapshot

    try:
        db.commit()
    except Exception:
        db.rollback()
        _catalog_merge_rollback_cache.pop(rollback_token, None)
        raise

    return CatalogMergeApplyOut(
        entity_type=payload.entity_type,
        tenant_id=tenant_id,
        target_id=int(payload.target_id),
        merged_source_ids=source_ids,
        moved_assignment_count=moved_count,
        rollback_token=rollback_token,
        rollback_expires_at=rollback_expires_at,
    )


@router.post("/catalog-merges/rollback", response_model=CatalogMergeRollbackOut)
async def rollback_catalog_merge(
    payload: CatalogMergeRollbackIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role_management_user),
):
    if not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Merge geri alma islemi yalnizca super admin tarafindan yapilabilir",
        )

    _cleanup_expired_catalog_merge_rollbacks()
    snapshot = _catalog_merge_rollback_cache.get(payload.rollback_token)
    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rollback token bulunamadi veya suresi doldu",
        )

    expires_at = snapshot.get("expires_at")
    if not expires_at or expires_at <= utcnow():
        _catalog_merge_rollback_cache.pop(payload.rollback_token, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rollback penceresi suresi doldu",
        )

    if snapshot.get("entity_type") == "role":
        restored_count = _rollback_role_merge(db, snapshot)
    else:
        restored_count = _rollback_department_merge(db, snapshot)

    db.commit()
    _catalog_merge_rollback_cache.pop(payload.rollback_token, None)

    return CatalogMergeRollbackOut(
        entity_type=snapshot["entity_type"],
        tenant_id=snapshot.get("tenant_id"),
        target_id=int(snapshot.get("target_id")),
        restored_source_ids=[int(item) for item in snapshot.get("source_ids", [])],
        restored_assignment_count=restored_count,
        rolled_back_at=utcnow(),
    )


# ==================== PERMISSION ENDPOINTS ====================


@router.get("/permissions", response_model=list[PermissionOut])
async def list_permissions(
    db: Session = Depends(get_db), _: User = Depends(require_permission_catalog_reader)
):
    """Tüm izinleri listele"""
    return db.query(Permission).all()


@router.get("/permission-catalog", response_model=list[PermissionCatalogNode])
async def get_permission_catalog(_: User = Depends(require_admin_catalog_reader)):
    """Menu ve alt menu seviyesinde izin katalogunu don."""
    return PERMISSION_CATALOG_TREE


@router.get("/role-permission-matrix")
async def get_role_permission_matrix(_: User = Depends(require_admin_catalog_reader)):
    """
    Rol tabanlı menü görünürlük matrisi — tek kaynak.
    Her rol profili için aktif permission key listesini döner.
    Frontend önizleme bileşeni bu endpoint'ten beslenmeli.
    """
    return build_matrix_response()


@router.get("/workspace-panels", response_model=WorkspacePanelConfig)
async def get_workspace_panel_config(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    settings = _get_or_create_system_settings(db)
    return _parse_workspace_panel_config(
        getattr(settings, "workspace_panels_json", None)
    )


@router.put("/workspace-panels", response_model=WorkspacePanelConfig)
async def update_workspace_panel_config(
    payload: WorkspacePanelConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_governance_manager),
):
    _validate_workspace_panel_config(payload)
    settings = _get_or_create_system_settings(db)
    settings.workspace_panels_json = _serialize_workspace_panel_config(payload)
    settings.updated_by_id = current_user.id
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return _parse_workspace_panel_config(settings.workspace_panels_json)


@router.get(
    "/commercial-request-webhook-settings",
    response_model=CommercialRequestWebhookSettingsOut,
)
async def get_commercial_request_webhook_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_manager),
):
    settings = _get_or_create_system_settings(db)
    webhook_url = (
        str(getattr(settings, "commercial_request_webhook_url", "") or "").strip()
        or None
    )
    webhook_secret = str(
        getattr(settings, "commercial_request_webhook_secret", "") or ""
    ).strip()
    return CommercialRequestWebhookSettingsOut(
        webhook_url=webhook_url,
        has_webhook_secret=bool(webhook_secret),
    )


@router.put(
    "/commercial-request-webhook-settings",
    response_model=CommercialRequestWebhookSettingsOut,
)
async def update_commercial_request_webhook_settings(
    payload: CommercialRequestWebhookSettingsIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_governance_manager),
):
    settings = _get_or_create_system_settings(db)
    settings.commercial_request_webhook_url = (
        str(payload.webhook_url or "").strip() or None
    )
    if payload.clear_webhook_secret:
        settings.commercial_request_webhook_secret = None
    elif payload.webhook_secret is not None:
        settings.commercial_request_webhook_secret = (
            str(payload.webhook_secret or "").strip() or None
        )
    settings.updated_by_id = current_user.id
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return CommercialRequestWebhookSettingsOut(
        webhook_url=settings.commercial_request_webhook_url,
        has_webhook_secret=bool(settings.commercial_request_webhook_secret),
    )


@router.get(
    "/commercial-request-webhook-deliveries",
    response_model=list[CommercialRequestWebhookDeliveryOut],
)
async def list_commercial_request_webhook_deliveries(
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_manager),
):
    rows = (
        db.query(CommercialRequestWebhookDelivery)
        .order_by(
            CommercialRequestWebhookDelivery.created_at.desc(),
            CommercialRequestWebhookDelivery.id.desc(),
        )
        .limit(100)
        .all()
    )
    return [
        CommercialRequestWebhookDeliveryOut(
            id=row.id,
            commercial_request_id=row.commercial_request_id,
            commercial_request_company_name=(
                row.commercial_request.company_name if row.commercial_request else None
            ),
            commercial_request_requester_email=(
                row.commercial_request.requester_email
                if row.commercial_request
                else None
            ),
            event_type=row.event_type,
            target_url=row.target_url,
            delivery_status=row.delivery_status,
            http_status_code=row.http_status_code,
            error_message=row.error_message,
            payload_raw=row.payload_raw,
            response_body=row.response_body,
            attempt_count=row.attempt_count,
            delivered_at=row.delivered_at,
            last_attempted_at=row.last_attempted_at,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post(
    "/commercial-request-webhook-deliveries/{delivery_id}/retry",
    response_model=CommercialRequestWebhookDeliveryOut,
)
async def retry_commercial_request_webhook_delivery_endpoint(
    delivery_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_manager),
):
    row = db.get(CommercialRequestWebhookDelivery, delivery_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Webhook teslim kaydi bulunamadi")
    try:
        row = retry_commercial_request_webhook_delivery(db, row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CommercialRequestWebhookDeliveryOut(
        id=row.id,
        commercial_request_id=row.commercial_request_id,
        commercial_request_company_name=(
            row.commercial_request.company_name if row.commercial_request else None
        ),
        commercial_request_requester_email=(
            row.commercial_request.requester_email if row.commercial_request else None
        ),
        event_type=row.event_type,
        target_url=row.target_url,
        delivery_status=row.delivery_status,
        http_status_code=row.http_status_code,
        error_message=row.error_message,
        payload_raw=row.payload_raw,
        response_body=row.response_body,
        attempt_count=row.attempt_count,
        delivered_at=row.delivered_at,
        last_attempted_at=row.last_attempted_at,
        created_at=row.created_at,
    )


@router.get(
    "/users/{user_id}/permission-overrides",
    response_model=list[UserPermissionOverrideOut],
)
async def get_user_permission_overrides(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Personel bulunamadi")

    _ensure_user_scope(target_user, current_user)

    overrides = (
        db.query(UserPermissionOverride)
        .filter(UserPermissionOverride.user_id == user_id)
        .order_by(UserPermissionOverride.permission_key.asc())
        .all()
    )
    return overrides


@router.put(
    "/users/{user_id}/permission-overrides",
    response_model=list[UserPermissionOverrideOut],
)
async def replace_user_permission_overrides(
    user_id: int,
    payload: UserPermissionOverrideBulkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Personel bulunamadi")

    _ensure_user_scope(target_user, current_user)
    _validate_permission_override_scope(db, current_user, target_user, payload.items)

    valid_keys = _flatten_permission_catalog_keys()
    for item in payload.items:
        if item.permission_key not in valid_keys:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Gecersiz permission anahtari: {item.permission_key}",
            )

    db.query(UserPermissionOverride).filter(
        UserPermissionOverride.user_id == user_id
    ).delete()

    created_items: list[UserPermissionOverride] = []
    for item in payload.items:
        new_item = UserPermissionOverride(
            user_id=user_id,
            permission_key=item.permission_key,
            allowed=item.allowed,
            granted_by_user_id=current_user.id,
        )
        db.add(new_item)
        created_items.append(new_item)

    db.commit()
    for item in created_items:
        db.refresh(item)
    return created_items


@router.get(
    "/role-permission-delegations", response_model=list[RolePermissionDelegationOut]
)
async def list_role_permission_delegations(
    system_role: str | None = None,
    business_role: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_manager),
):
    query = db.query(RolePermissionDelegation)
    if system_role:
        query = query.filter(RolePermissionDelegation.system_role == system_role)
    if business_role:
        query = query.filter(RolePermissionDelegation.business_role == business_role)
    return query.order_by(RolePermissionDelegation.permission_key.asc()).all()


@router.put(
    "/role-permission-delegations", response_model=list[RolePermissionDelegationOut]
)
async def replace_role_permission_delegations(
    payload: RolePermissionDelegationBulkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_governance_manager),
):
    normalized_system_role = (payload.system_role or "").strip().lower() or None
    normalized_business_role = (payload.business_role or "").strip().lower() or None

    if not normalized_system_role and not normalized_business_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="En az bir rol kapsami girilmeli (system_role veya business_role)",
        )

    valid_keys = _flatten_permission_catalog_keys()
    for item in payload.items:
        if item.permission_key not in valid_keys:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Gecersiz permission anahtari: {item.permission_key}",
            )

    db.query(RolePermissionDelegation).filter(
        RolePermissionDelegation.system_role == normalized_system_role,
        RolePermissionDelegation.business_role == normalized_business_role,
    ).delete()

    created: list[RolePermissionDelegation] = []
    for item in payload.items:
        row = RolePermissionDelegation(
            system_role=normalized_system_role,
            business_role=normalized_business_role,
            permission_key=item.permission_key,
            can_delegate=item.can_delegate,
            created_by_user_id=current_user.id,
        )
        db.add(row)
        created.append(row)

    db.commit()
    for row in created:
        db.refresh(row)
    return created


# ==================== PROJECT ENDPOINTS ====================


@router.get("/projects", response_model=list[ProjectOut])
async def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_workspace_user),
):
    """Tüm projeleri listele"""
    query = db.query(Project).filter(Project.is_active)
    query = _restrict_project_query_for_admin(query, current_user)
    if _can_view_all_projects(current_user):
        return query.all()
    return (
        query.join(Project.personnel)
        .filter(User.id == current_user.id)
        .distinct()
        .all()
    )


@router.post("/projects", response_model=ProjectOut)
async def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Yeni proje ekle (proje oluşturma yetkisi olan personel)"""
    try:
        if not _can_create_project(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Proje oluşturma yetkiniz yok",
            )
        _require_workspace_tenant_scope(
            current_user,
            detail="Tenant kapsamı olmayan kullanıcı proje oluşturamaz. Önce tenant bootstrap akışını tamamlayın.",
        )

        print(f"[DEBUG] Proje oluşturma isteği alındı: {project}")
        print(f"[DEBUG] Kullanıcı: {current_user.email} ({current_user.role})")

        _ensure_unique_project_code(db, current_user, project.code)

        # Schema data'sını model'e dönüştür
        data = project.model_dump(exclude={"responsible_user_ids"})
        print(f"[DEBUG] Proje data: {data}")

        _ensure_company_scope(db, current_user, data.get("company_id"))
        enforce_active_project_limit(db, _current_tenant(db, current_user))

        new_project = Project(
            **data,
            created_by_id=current_user.id,
            tenant_id=_current_tenant_id(current_user),
        )
        db.add(new_project)
        db.commit()
        db.refresh(new_project)

        # Projeyi oluşturan kişi otomatik olarak projeye eklenir.
        if current_user not in new_project.personnel:
            new_project.personnel.append(current_user)

        # UI'da seçilen satın alma sorumlularını projeye ata.
        if project.responsible_user_ids:
            users = _resolve_project_responsible_users(
                db,
                current_user,
                project.responsible_user_ids,
            )
            for user in users:
                if user not in new_project.personnel:
                    new_project.personnel.append(user)

        db.commit()
        db.refresh(new_project)

        print(f"[DEBUG] Proje başarıyla oluşturuldu: ID={new_project.id}")
        return new_project

    except ValueError as e:
        print(f"[ERROR] Validation hatası: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation hatası: {str(e)}",
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        print(f"[ERROR] Proje oluşturma hatası: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Proje oluşturulamadı: {str(e)}",
        )


@router.put("/projects/{proj_id}", response_model=ProjectOut)
async def update_project(
    proj_id: int,
    proj_data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Proje güncelle"""
    proj = db.query(Project).filter(Project.id == proj_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")

    _ensure_project_scope(proj, current_user)

    _ensure_project_member_or_global(proj, current_user)

    if not _can_create_project(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Projeyi güncelleme yetkiniz yok",
        )

    update_data = proj_data.model_dump(
        exclude_unset=True, exclude={"responsible_user_ids"}
    )
    if "code" in update_data and update_data.get("code"):
        _ensure_unique_project_code(
            db,
            current_user,
            update_data["code"],
            excluded_project_id=proj_id,
        )
    if "company_id" in update_data:
        _ensure_company_scope(db, current_user, update_data.get("company_id"))
    for field, value in update_data.items():
        setattr(proj, field, value)

    if proj_data.responsible_user_ids is not None:
        users = _resolve_project_responsible_users(
            db,
            current_user,
            proj_data.responsible_user_ids,
        )
        # Proje sahibini düşürme: current user her zaman projede kalsın.
        if current_user not in users:
            users.append(current_user)
        proj.personnel = users

    db.commit()
    db.refresh(proj)
    return proj


@router.delete("/projects/{proj_id}")
async def delete_project(
    proj_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Proje sil"""
    proj = db.query(Project).filter(Project.id == proj_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")

    _ensure_project_scope(proj, current_user)

    _ensure_project_member_or_global(proj, current_user)

    if not _can_create_project(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Projeyi silme yetkiniz yok",
        )

    try:
        # Some legacy tables are not wired with ORM cascades; clear them explicitly.
        quote_ids = [
            qid
            for (qid,) in db.query(Quote.id).filter(Quote.project_id == proj_id).all()
        ]
        if quote_ids:
            db.execute(delete(Contract).where(Contract.quote_id.in_(quote_ids)))
            db.execute(
                delete(PriceAnalysis).where(PriceAnalysis.quote_id.in_(quote_ids))
            )
            db.execute(
                delete(SupplierRating).where(SupplierRating.quote_id.in_(quote_ids))
            )
            db.execute(
                delete(QuoteComparison).where(QuoteComparison.quote_id.in_(quote_ids))
            )
            db.execute(
                delete(QuoteStatusLog).where(QuoteStatusLog.quote_id.in_(quote_ids))
            )

        db.execute(
            delete(ProjectPermission).where(ProjectPermission.project_id == proj_id)
        )
        db.execute(
            delete(user_project_permissions).where(
                user_project_permissions.c.project_id == proj_id
            )
        )
        db.execute(delete(user_projects).where(user_projects.c.project_id == proj_id))

        db.delete(proj)
        db.commit()
        return {"message": "Proje silindi"}
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Proje silinemedi: projeye bagli kayitlar var ({str(e.orig)})",
        )


# ==================== USER/PERSONNEL ENDPOINTS ====================


@router.get("/users", response_model=list[UserOut])
async def list_users(
    scope: Literal["all", "portal", "partner", "channel", "supplier"] = "all",
    status_filter: Literal["all", "active", "passive"] = "all",
    owner_user_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_catalog_user),
):
    """Tüm personeli listele"""
    query = db.query(User).filter(User.hidden_from_admin.is_(False))
    query = _restrict_users_query_for_workspace(query, current_user)

    role_portal_filter = or_(
        func.lower(func.coalesce(User.system_role, "")).in_(
            ["super_admin", "platform_support", "platform_operator", "finance_officer"]
        ),
        func.lower(func.coalesce(User.role, "")) == "super_admin",
    )
    role_supplier_filter = or_(
        func.lower(func.coalesce(User.system_role, "")) == "supplier_user",
        func.lower(func.coalesce(User.role, "")) == "supplier",
        func.lower(func.coalesce(User.role, "")).like("supplier_%"),
    )
    role_channel_filter = or_(
        func.lower(func.coalesce(User.system_role, "")).like("channel_%"),
        func.lower(func.coalesce(User.role, "")).like("channel_%"),
    )

    if scope == "portal":
        query = query.filter(role_portal_filter)
    elif scope == "supplier":
        query = query.filter(role_supplier_filter)
    elif scope == "channel":
        query = query.filter(role_channel_filter)
    elif scope == "partner":
        query = query.filter(
            ~role_portal_filter, ~role_supplier_filter, ~role_channel_filter
        )

    if status_filter == "active":
        query = query.filter(User.is_active.is_(True))
    elif status_filter == "passive":
        query = query.filter(User.is_active.is_(False))

    if owner_user_id is not None:
        owner = db.query(User).filter(User.id == owner_user_id).first()
        if owner is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Owner kullanici bulunamadi",
            )
        if owner.tenant_id is not None:
            query = query.filter(User.tenant_id == owner.tenant_id)
        query = query.filter(
            or_(
                User.id == owner_user_id,
                User.created_by_id == owner_user_id,
            )
        )

    query = query.order_by(User.full_name.asc(), User.id.asc())
    users = query.all()
    for user in users:
        resolve_effective_department_id(db, user)
    db.commit()
    return users


@router.get("/channel-users", response_model=list[UserOut])
async def list_channel_users(
    channel_org_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_catalog_user),
):
    """Channel scope kullanicilarini listele"""
    query = db.query(User).filter(User.hidden_from_admin.is_(False))
    query = _restrict_users_query_for_workspace(query, current_user)
    query = query.filter(
        or_(
            func.lower(func.coalesce(User.system_role, "")).like("channel_%"),
            func.lower(func.coalesce(User.role, "")).like("channel_%"),
        )
    )
    if channel_org_id is not None:
        query = query.filter(User.tenant_id == channel_org_id)
    users = query.order_by(User.full_name.asc(), User.id.asc()).all()
    for user in users:
        resolve_effective_department_id(db, user)
    db.commit()
    return users


@router.post("/users", response_model=UserOut)
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    email_service=Depends(get_email_service),
    current_user: User = Depends(require_admin_user),
):
    """Yeni personel ekle"""
    _ensure_manageable_user_role(current_user, user_data.role)
    email_owner_id = None if is_super_admin(current_user) else current_user.id
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing and not existing.hidden_from_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Bu email zaten kayıtlı"
        )

    enforce_active_internal_user_limit(db, _current_tenant(db, current_user))

    archived_user = (
        db.query(User)
        .filter(
            User.hidden_from_admin.is_(True),
            User.deleted_original_email == user_data.email,
        )
        .first()
    )

    # Set default approval limits based on role
    approval_limits = {
        "satinalmaci": 100000,
        "satinalma_uzmani": 200000,
        "satinalma_yoneticisi": 300000,
        "satinalma_direktoru": 1000000,
    }
    placeholder_password = secrets.token_urlsafe(24)
    invitation_token = secrets.token_urlsafe(32)
    invitation_expires = datetime.now(timezone.utc) + timedelta(hours=24)

    requested_tenant_id = user_data.tenant_id
    if is_super_admin(current_user):
        if requested_tenant_id is not None:
            tenant_row = (
                db.query(Tenant).filter(Tenant.id == requested_tenant_id).first()
            )
            if tenant_row is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Secilen tenant bulunamadi",
                )
        effective_tenant_id = requested_tenant_id
    else:
        effective_tenant_id = _current_tenant_id(current_user)

    payload = {
        "email": user_data.email,
        "work_email": user_data.work_email,
        "full_name": user_data.full_name,
        "hashed_password": get_password_hash(placeholder_password),
        "role": user_data.role,
        "tenant_id": effective_tenant_id,
        "approval_limit": user_data.approval_limit
        or approval_limits.get(user_data.role, 100000),
        "department_id": user_data.department_id,
        "photo": user_data.photo,
        "personal_phone": user_data.personal_phone,
        "company_phone": user_data.company_phone,
        "company_phone_short": user_data.company_phone_short,
        "address": user_data.address,
        "hide_location": user_data.hide_location,
        "share_on_whatsapp": user_data.share_on_whatsapp,
        "is_active": user_data.is_active,
        "hidden_from_admin": False,
        "deleted_original_email": None,
        "created_by_id": current_user.id,
        "invitation_token": invitation_token,
        "invitation_token_expires": invitation_expires,
        "invitation_accepted": False,
    }

    if archived_user:
        _ensure_department_scope(db, current_user, user_data.department_id)
        for field, value in payload.items():
            setattr(archived_user, field, value)
        db.commit()
        db.refresh(archived_user)
        email_sent = False
        try:
            email_sent = email_service.send_internal_user_invitation(
                to_email=archived_user.email,
                full_name=archived_user.full_name,
                activation_token=archived_user.invitation_token,
                owner_user_id=email_owner_id,
            )
        except Exception:
            pass
        return UserOut.model_validate(archived_user, from_attributes=True).model_copy(
            update={"invitation_email_sent": email_sent}
        )

    new_user = User(
        **payload,
        system_role=resolve_requested_user_system_role(
            current_user,
            user_data.role,
            user_data.system_role,
        ),
    )
    _ensure_department_scope(db, current_user, user_data.department_id)

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    email_sent = False
    try:
        email_sent = email_service.send_internal_user_invitation(
            to_email=new_user.email,
            full_name=new_user.full_name,
            activation_token=new_user.invitation_token,
            owner_user_id=email_owner_id,
        )
    except Exception:
        pass
    return UserOut.model_validate(new_user, from_attributes=True).model_copy(
        update={"invitation_email_sent": email_sent}
    )


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """Personel güncelle (Sadece Super Admin)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Personel bulunamadı")

    is_self_update = user.id == current_user.id

    _ensure_user_scope(user, current_user)
    if "department_id" in user_data.model_dump(exclude_unset=True):
        _ensure_department_scope(db, current_user, user_data.department_id)

    update_data = user_data.model_dump(exclude_unset=True)
    if (
        is_self_update
        and _is_scoped_admin(current_user)
        and not is_super_admin(current_user)
    ):
        update_data.pop("role", None)
        update_data.pop("system_role", None)
        update_data.pop("tenant_id", None)

        allowed_self_fields = {
            "email",
            "work_email",
            "full_name",
            "approval_limit",
            "department_id",
            "photo",
            "personal_phone",
            "company_phone",
            "company_phone_short",
            "address",
            "hide_location",
            "share_on_whatsapp",
            "is_active",
        }
        update_data = {
            field: value
            for field, value in update_data.items()
            if field in allowed_self_fields
        }

        for field, value in update_data.items():
            setattr(user, field, value)

        db.commit()
        db.refresh(user)
        return user

    if not is_super_admin(current_user) and "tenant_id" in update_data:
        requested_tenant_id = update_data.get("tenant_id")
        if requested_tenant_id != _current_tenant_id(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant admin personeli baska tenant'a tasiyamaz",
            )
        update_data["tenant_id"] = _current_tenant_id(current_user)

    if "role" in update_data or "system_role" in update_data:
        requested_role = str(update_data.get("role") or user.role or "")
        requested_system_role = str(
            update_data.get("system_role") or user.system_role or ""
        )
        if not (
            user.id == current_user.id
            and requested_role.strip().lower()
            == str(current_user.role or "").strip().lower()
        ):
            _ensure_manageable_user_role(current_user, requested_role)
        if (
            not is_super_admin(current_user)
            and requested_system_role.strip().lower() in ADMIN_MANAGED_SYSTEM_ROLES
            and not (
                user.id == current_user.id
                and requested_system_role.strip().lower()
                == str(current_user.system_role or "").strip().lower()
            )
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant admin personel akisinda yonetici sistem rolune gecis yapamaz",
            )
        update_data["system_role"] = resolve_requested_user_system_role(
            current_user,
            requested_role,
            requested_system_role,
        )
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """Pasif personeli listeden kaldırarak arşivle (Sadece Super Admin)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Personel bulunamadı")

    if is_super_admin(current_user) and user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Super admin kendi kaydini silemez.",
        )

    allow_peer_super_admin_delete = (
        is_super_admin(current_user)
        and _is_super_admin_account(user)
        and user.id != current_user.id
    )
    if not allow_peer_super_admin_delete:
        _ensure_user_scope(user, current_user)

    if user.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Aktif personel silinemez. Önce personeli pasife alın.",
        )

    if _is_super_admin_account(user):
        if _count_other_visible_super_admins(db, user_id) == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Son super admin kaydı kaldırılamaz.",
            )

    db.query(CompanyRole).filter(CompanyRole.user_id == user_id).delete()
    db.query(ProjectPermission).filter(ProjectPermission.user_id == user_id).delete()
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete()
    db.query(APIKey).filter(APIKey.user_id == user_id).delete()

    db.execute(delete(user_company).where(user_company.c.user_id == user_id))
    db.execute(delete(user_department).where(user_department.c.user_id == user_id))
    db.execute(delete(user_managers).where(user_managers.c.user_id == user_id))
    db.execute(delete(user_managers).where(user_managers.c.manager_id == user_id))
    db.execute(
        delete(user_company_roles).where(user_company_roles.c.user_id == user_id)
    )
    db.execute(
        delete(user_project_permissions).where(
            user_project_permissions.c.user_id == user_id
        )
    )
    db.execute(delete(user_projects).where(user_projects.c.user_id == user_id))

    db.query(Quote).filter(Quote.assigned_to_id == user_id).update(
        {Quote.assigned_to_id: None}, synchronize_session=False
    )
    db.query(QuoteApproval).filter(QuoteApproval.approved_by_id == user_id).update(
        {QuoteApproval.approved_by_id: None}, synchronize_session=False
    )
    db.query(ProjectFile).filter(ProjectFile.uploaded_by == user_id).update(
        {ProjectFile.uploaded_by: None}, synchronize_session=False
    )
    db.query(ProjectPermission).filter(
        ProjectPermission.granted_by_id == user_id
    ).update({ProjectPermission.granted_by_id: None}, synchronize_session=False)
    db.query(Contract).filter(Contract.signed_by_id == user_id).update(
        {Contract.signed_by_id: None}, synchronize_session=False
    )

    suffix = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    original_email = user.email
    user.email = f"deleted-user-{user.id}-{suffix}@procureflow.local"
    user.full_name = "Silinen Personel (Isten Ayrildi)"
    user.photo = None
    user.personal_phone = None
    user.company_phone = None
    user.company_phone_short = None
    user.address = None
    user.hide_location = True
    user.share_on_whatsapp = False
    user.department_id = None
    user.approval_limit = 0
    user.hidden_from_admin = True
    user.deleted_original_email = original_email
    user.hashed_password = get_password_hash(f"deleted-{user.id}-{suffix}")
    db.commit()
    return {"message": "Personel listeden kaldırıldı"}


@router.post("/users/{user_id}/projects/{project_id}")
async def assign_user_to_project(
    user_id: int,
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """Personeli projeye ata"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Personel bulunamadı")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")

    _ensure_user_scope(user, current_user)
    _ensure_project_scope(project, current_user)

    _ensure_project_member_or_global(project, current_user)

    if project not in user.projects:
        user.projects.append(project)
        db.commit()

    return {"message": f"{user.full_name} {project.name} projesine atandı"}


@router.delete("/users/{user_id}/projects/{project_id}")
async def remove_user_from_project(
    user_id: int,
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """Personeli projeden çıkar"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Personel bulunamadı")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")

    _ensure_user_scope(user, current_user)
    _ensure_project_scope(project, current_user)

    _ensure_project_member_or_global(project, current_user)

    if project in user.projects:
        user.projects.remove(project)
        db.commit()

    return {"message": f"{user.full_name} {project.name} projesinden çıkarıldı"}


# ==================== PROJECT FILE ENDPOINTS ====================


@router.post("/projects/{proj_id}/files", response_model=ProjectFileOut)
async def upload_project_file(
    proj_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Projeye dosya yukle"""
    # Proje kontrolu
    project = db.query(Project).filter(Project.id == proj_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proje bulunamadi")

    _ensure_project_scope(project, current_user)
    _ensure_project_member_or_global(project, current_user)
    if not _can_create_project(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Proje dosyasi yukleme yetkiniz yok",
        )

    # Sirket kontrolu
    if not project.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proje bir sirkete atanmis olmali",
        )

    # Dosya içeriğini oku
    file_content = await file.read()
    file_size = len(file_content)

    upload_filename = file.filename or "upload.bin"

    # Dosya doğrulama
    is_valid, error_msg = FileUploadService.validate_file(upload_filename, file_size)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    enforce_project_file_limits(
        db,
        _current_tenant(db, current_user),
        proj_id,
        file_size,
    )

    # Önce veritabanında kayıt oluştur (ID almak için)
    project_file = ProjectFile(
        project_id=proj_id,
        filename="",  # Gecici, dosya kaydettikten sonra guncellenecek
        original_filename=upload_filename,
        file_type=file.content_type or FileUploadService.get_file_type(upload_filename),
        file_size=file_size,
        file_path="",  # Gecici, dosya kaydettikten sonra guncellenecek
        uploaded_by=current_user.id,
    )

    db.add(project_file)
    db.flush()  # ID'yi almak için flush et
    file_id = project_file.id

    # Dosyayı kaydet (sirket/proje kategorisine)
    try:
        file_path = FileUploadService.save_file(
            company_id=project.company_id,
            project_id=proj_id,
            file_id=file_id,
            file_content=file_content,
            original_filename=upload_filename,
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dosya kaydedilemedi: {str(e)}",
        )

    # Dosya yolunu ve adını güncelle
    filename = FileUploadService.generate_filename(file_id, upload_filename)
    project_file.filename = filename
    project_file.file_path = file_path

    db.commit()
    db.refresh(project_file)

    return project_file


@router.get("/projects/{proj_id}/files", response_model=list[ProjectFileOut])
async def list_project_files(
    proj_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    """Proje dosyalar�n� listele"""
    project = db.query(Project).filter(Project.id == proj_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proje bulunamad�")

    current_user = _
    _ensure_project_scope(project, current_user)
    _ensure_project_member_or_global(project, current_user)

    files = db.query(ProjectFile).filter(ProjectFile.project_id == proj_id).all()
    return files


@router.delete("/files/{file_id}")
async def delete_project_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """Proje dosyas�n� sil (Sadece Super Admin)"""
    project_file = db.query(ProjectFile).filter(ProjectFile.id == file_id).first()
    if not project_file:
        raise HTTPException(status_code=404, detail="Dosya bulunamad�")
    project = db.query(Project).filter(Project.id == project_file.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")
    _ensure_project_scope(project, current_user)
    _ensure_project_member_or_global(project, current_user)
    if not _can_create_project(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Proje dosyasi silme yetkiniz yok",
        )

    # Fiziksel dosyay� sil
    FileUploadService.delete_file(project_file.file_path)

    # Veritaban�ndan sil
    db.delete(project_file)
    db.commit()

    return {"message": "Dosya silindi"}


# ==================== DEMO DATA ENDPOINTS ====================


@router.post("/load-demo-data")
async def load_demo_data(
    db: Session = Depends(get_db), _: User = Depends(require_tenant_governance_manager)
):
    """Demo verilerini yükle (Sadece Super Admin)"""
    try:
        return seed_scope_demo_data(db)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Demo veri yükleme hatası: {str(e)}",
        )


# ==================== COMPANY ASSIGNMENT ENDPOINTS ====================


@router.get(
    "/users/{user_id}/company-assignments", response_model=list[CompanyAssignmentOut]
)
async def list_user_company_assignments(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """Personelin firma atamalarını listele"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Personel bulunamadı")
    _ensure_user_scope(user, current_user)
    return (
        db.query(CompanyRole)
        .filter(CompanyRole.user_id == user_id, CompanyRole.is_active.is_(True))
        .all()
    )


@router.post(
    "/users/{user_id}/company-assignments",
    response_model=CompanyAssignmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_user_company_assignment(
    user_id: int,
    data: CompanyAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """Personele firma+rol+departman ataması ekle"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Personel bulunamadı")
    _ensure_user_scope(user, current_user)
    _ensure_company_scope(db, current_user, data.company_id)
    _ensure_role_scope(db, current_user, data.role_id)
    _ensure_department_scope(db, current_user, data.department_id)

    existing = (
        db.query(CompanyRole)
        .filter(
            CompanyRole.user_id == user_id,
            CompanyRole.company_id == data.company_id,
            CompanyRole.is_active.is_(True),
        )
        .first()
    )

    company = db.query(Company).filter(Company.id == data.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Firma bulunamadı")

    role = db.query(Role).filter(Role.id == data.role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Rol bulunamadı")

    dept = None
    if data.department_id:
        dept = db.query(Department).filter(Department.id == data.department_id).first()
        if not dept:
            raise HTTPException(status_code=404, detail="Departman bulunamadı")

    _ensure_company_assignment_tenant_consistency(user, company, role, dept)

    if existing:
        existing.role_id = data.role_id
        existing.department_id = data.department_id
        existing.sub_items_json = json.dumps(data.sub_items, ensure_ascii=False)
        existing.tenant_id = (
            user.tenant_id
            or company.tenant_id
            or role.tenant_id
            or (dept.tenant_id if dept else None)
        )
        db.commit()
        db.refresh(existing)
        return existing

    assignment = CompanyRole(
        tenant_id=user.tenant_id
        or company.tenant_id
        or role.tenant_id
        or (dept.tenant_id if dept else None),
        user_id=user_id,
        company_id=data.company_id,
        role_id=data.role_id,
        department_id=data.department_id,
        sub_items_json=json.dumps(data.sub_items, ensure_ascii=False),
        is_active=True,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.put(
    "/users/{user_id}/company-assignments/{assignment_id}",
    response_model=CompanyAssignmentOut,
)
async def update_user_company_assignment(
    user_id: int,
    assignment_id: int,
    data: CompanyAssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """Personel firma atamasını güncelle (rol/departman değiştir)"""
    assignment = (
        db.query(CompanyRole)
        .filter(CompanyRole.id == assignment_id, CompanyRole.user_id == user_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Atama bulunamadı")
    _ensure_user_scope(assignment.user, current_user)
    _ensure_company_scope(db, current_user, assignment.company_id)
    role = assignment.role
    department = assignment.department
    if data.role_id is not None:
        _ensure_role_scope(db, current_user, data.role_id)
        role = db.query(Role).filter(Role.id == data.role_id).first()
        if not role:
            raise HTTPException(status_code=404, detail="Rol bulunamadı")
    if data.department_id is not None:
        _ensure_department_scope(db, current_user, data.department_id)
        department = None
        if data.department_id:
            department = (
                db.query(Department).filter(Department.id == data.department_id).first()
            )
            if not department:
                raise HTTPException(status_code=404, detail="Departman bulunamadı")

    _ensure_company_assignment_tenant_consistency(
        assignment.user, assignment.company, role, department
    )

    update_data = data.model_dump(exclude_unset=True)
    if "sub_items" in update_data:
        update_data["sub_items_json"] = json.dumps(
            update_data.pop("sub_items") or [], ensure_ascii=False
        )
    for field, value in update_data.items():
        setattr(assignment, field, value)
    assignment.tenant_id = (
        assignment.user.tenant_id
        or assignment.company.tenant_id
        or role.tenant_id
        or (department.tenant_id if department else None)
    )

    db.commit()
    db.refresh(assignment)
    return assignment


@router.delete("/users/{user_id}/company-assignments/{assignment_id}")
async def remove_user_company_assignment(
    user_id: int,
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """Personelin firma atamasını kaldır"""
    assignment = (
        db.query(CompanyRole)
        .filter(CompanyRole.id == assignment_id, CompanyRole.user_id == user_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Atama bulunamadı")
    _ensure_user_scope(assignment.user, current_user)
    _ensure_company_scope(db, current_user, assignment.company_id)

    db.delete(assignment)
    db.commit()
    return {"message": "Firma ataması kaldırıldı"}


# ==================== PASSWORD RESET (ADMIN) ====================


@router.post("/users/{user_id}/reset-password")
async def admin_reset_password(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Personel şifresini sıfırla (Super Admin veya reset_password iznine sahip roller)"""
    if not is_super_admin(current_user):
        has_permission = (
            db.query(Permission)
            .join(Permission.roles)
            .join(Role.company_roles)
            .filter(
                CompanyRole.user_id == current_user.id,
                Permission.name == "users.reset_password",
            )
            .first()
        )
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Şifre sıfırlama yetkiniz yok",
            )

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Personel bulunamadı")
    _ensure_user_scope(target, current_user)

    temp_password = "Temp1234!"
    target.hashed_password = get_password_hash(temp_password)
    db.commit()

    return {
        "message": f"{target.full_name} şifresi sıfırlandı",
        "temp_password": temp_password,
    }


@router.post("/users/{user_id}/resend-invitation")
async def resend_user_invitation(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
    email_service=Depends(get_email_service),
):
    """Personel aktivasyon davetini yeniden gönder."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Personel bulunamadı")

    _ensure_user_scope(target, current_user)
    if not target.is_active:
        raise HTTPException(
            status_code=400, detail="Pasif personel için davet gönderilemez"
        )
    if getattr(target, "invitation_accepted", False):
        raise HTTPException(
            status_code=409, detail="Bu kullanıcı daveti zaten onaylamış"
        )

    target.invitation_token = secrets.token_urlsafe(32)
    target.invitation_token_expires = datetime.now(timezone.utc) + timedelta(hours=24)
    target.invitation_accepted = False

    db.commit()
    db.refresh(target)

    email_owner_id = None if is_super_admin(current_user) else current_user.id
    invitation_email_sent = False
    try:
        invitation_email_sent = email_service.send_internal_user_invitation(
            to_email=target.email,
            full_name=target.full_name,
            activation_token=target.invitation_token,
            owner_user_id=email_owner_id,
        )
    except Exception:
        invitation_email_sent = False

    return {
        "status": "success" if invitation_email_sent else "warning",
        "message": (
            f"{target.full_name} için aktivasyon daveti yeniden gönderildi"
            if invitation_email_sent
            else f"{target.full_name} için davet token yenilendi ancak e-posta gönderilemedi"
        ),
        "invitation_email_sent": invitation_email_sent,
    }


@router.post("/users/{user_id}/contact-email", response_model=dict)
async def send_user_contact_email(
    user_id: int,
    to_email: str = Form(...),
    subject: str = Form(...),
    body: str = Form(""),
    cc: str | None = Form(None),
    system_email_id: int | None = Form(None),
    attachments: list[UploadFile] | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    email_service=Depends(get_email_service),
):
    if not can_access_admin_surface(current_user):
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Personel bulunamadı")
    _ensure_user_scope(target, current_user)
    email_owner_id = None if is_super_admin(current_user) else current_user.id

    payload_attachments: list[tuple[str, str, bytes]] = []
    total_size = 0
    for upload in attachments or []:
        content = await upload.read()
        total_size += len(content)
        if total_size > 20 * 1024 * 1024:
            raise HTTPException(
                status_code=400, detail="Toplam ek boyutu 20MB sınırını aşamaz"
            )
        filename = (upload.filename or "ek").strip() or "ek"
        content_type = upload.content_type or "application/octet-stream"
        payload_attachments.append((filename, content_type, content))

    email_sent = email_service.send_custom_email(
        to_email=to_email,
        subject=subject,
        body=body,
        cc=cc,
        attachments=payload_attachments,
        owner_user_id=email_owner_id,
        system_email_id=system_email_id,
    )
    if not email_sent:
        raise HTTPException(status_code=500, detail="E-posta gönderilemedi")

    return {
        "status": "success",
        "message": f"{target.full_name} için e-posta gönderildi",
    }


# ---------------------------------------------------------------------------
# Platform Supplier Havuzu (super admin)
# ---------------------------------------------------------------------------


@router.get("/platform-suppliers")
async def list_platform_suppliers(
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_reader),
):
    """
    Platform genelinde tenant'a bagli olmayan (kaynak: platform_network) tedarikci havuzu.
    """
    suppliers = (
        db.query(Supplier)
        .filter(Supplier.tenant_id.is_(None), Supplier.is_active == True)
        .order_by(Supplier.company_name)
        .all()
    )
    return [
        {
            "id": s.id,
            "name": s.company_name,
            "email": s.email,
            "phone": s.phone,
            "website": s.website,
            "city": s.city,
            "is_active": s.is_active,
            "source_type": s.source_type,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in suppliers
    ]


@router.post("/platform-suppliers", status_code=201)
async def create_platform_supplier(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_governance_manager),
):
    """
    Platform genelinde kullanilabilecek (tenant'a bagli olmayan) tedarikci olustur.
    """
    name: str = (payload.get("name") or "").strip()
    email: str = (payload.get("email") or "").strip()
    phone: str = (payload.get("phone") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name zorunlu")
    if not email:
        raise HTTPException(status_code=400, detail="email zorunlu")
    if not phone:
        raise HTTPException(status_code=400, detail="phone zorunlu")

    existing = db.query(Supplier).filter(Supplier.email == email).first()
    if existing:
        raise HTTPException(
            status_code=409, detail="Bu e-posta ile bir tedarikci zaten kayitli"
        )

    supplier = Supplier(
        company_name=name,
        email=email,
        phone=phone,
        website=payload.get("website"),
        city=payload.get("city"),
        is_active=True,
        tenant_id=None,
        created_by_id=current_user.id,
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return {
        "id": supplier.id,
        "name": supplier.company_name,
        "email": supplier.email,
        "source_type": supplier.source_type,
    }


@router.get("/tenants/{tenant_id}/suppliers")
async def list_tenant_suppliers(
    tenant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_reader),
):
    """
    Bir tenant'a (firmaya) davet edilen tedarikçileri listele.
    source_type == 'private' ve tenant_id ile eşleşenleri döndür.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant bulunamadi")

    suppliers = (
        db.query(Supplier)
        .filter(Supplier.tenant_id == tenant_id)
        .order_by(Supplier.company_name)
        .all()
    )

    inviter_company_name = None
    tenant_companies = (
        db.query(Company)
        .filter(Company.tenant_id == tenant_id, Company.is_active == True)
        .order_by(Company.is_primary.desc(), Company.name.asc())
        .all()
    )
    if tenant_companies:
        inviter_company_name = tenant_companies[0].name

    special_listing_active = (
        db.query(TenantSubscriptionAddon.id)
        .filter(
            TenantSubscriptionAddon.tenant_id == tenant_id,
            TenantSubscriptionAddon.status == "active",
            func.lower(func.coalesce(TenantSubscriptionAddon.addon_code, ""))
            == "special_listing",
        )
        .first()
        is not None
    )

    return [
        {
            "id": s.id,
            "company_name": s.company_name,
            "email": s.email,
            "phone": s.phone,
            "website": s.website,
            "city": s.city,
            "is_active": s.is_active,
            "source_type": s.source_type,
            "tenant_id": s.tenant_id,
            "inviter_company_name": inviter_company_name,
            "special_listing_active": special_listing_active,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in suppliers
    ]


@router.get("/demo-workspaces", response_model=list[DemoWorkspaceOut])
async def list_demo_workspaces(
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_reader),
):
    now = utcnow()
    settings = get_or_create_system_settings(db)
    primary_company_id = getattr(settings, "platform_primary_company_id", None)
    strategic_company_q = db.query(func.count(Company.id)).filter(
        Company.is_active == True
    )
    if primary_company_id:
        strategic_company_q = strategic_company_q.filter(
            Company.id != primary_company_id
        )
    strategic_company_count = strategic_company_q.scalar() or 0
    partner_count = (
        db.query(func.count(Tenant.id)).filter(Tenant.is_active == True).scalar() or 0
    )
    platform_supplier_count = (
        db.query(func.count(Supplier.id))
        .filter(Supplier.is_active == True, Supplier.tenant_id.is_(None))
        .scalar()
        or 0
    )
    private_supplier_count = (
        db.query(func.count(Supplier.id))
        .filter(Supplier.is_active == True, Supplier.tenant_id.isnot(None))
        .scalar()
        or 0
    )

    return [
        DemoWorkspaceOut(
            key="demo-supplier-onboarding",
            workspace_type="supplier_demo",
            title="Demo Tedarikci Aktivasyonu",
            scenario="Platform havuzundan secilen tedarikcilerin paket kontrolu ve ilk teklif donus hizini olcmek icin canli demo alani.",
            starts_at=now - timedelta(days=2),
            ends_at=now + timedelta(days=28),
            commission_preview="Aylik %2 aktivasyon komisyonu + ilk teklifte sabit bonus",
            related_company_count=int(strategic_company_count),
            related_supplier_count=int(platform_supplier_count),
            is_active=True,
        ),
        DemoWorkspaceOut(
            key="demo-strategic-rollout",
            workspace_type="strategic_demo",
            title="Demo Stratejik Firma Rollout",
            scenario="Ana/alt firma hiyerarsisi ile proje dagitimi ve kanal davet akisini ceyrek donemlik planla dogrulama.",
            starts_at=now - timedelta(days=7),
            ends_at=now + timedelta(days=45),
            commission_preview="Stratejik is ortagi gelir paylasimi: %5 islem bazli",
            related_company_count=int(strategic_company_count),
            related_supplier_count=int(private_supplier_count),
            is_active=True,
        ),
        DemoWorkspaceOut(
            key="demo-partner-governance",
            workspace_type="partner_demo",
            title="Demo Is Ortagi Yonetisim",
            scenario="Kanal ekipleri icin davet, proje acilis ve onboarding gecis adimlarini governance raporlariyla izleme.",
            starts_at=now,
            ends_at=now + timedelta(days=60),
            commission_preview="Kanal is ortagi yonlendirme komisyonu: kademeli 3-7%",
            related_company_count=int(partner_count),
            related_supplier_count=int(
                private_supplier_count + platform_supplier_count
            ),
            is_active=True,
        ),
    ]


# ---------------------------------------------------------------------------
# Platform Analitikleri (super admin)
# ---------------------------------------------------------------------------


@router.get("/platform-analytics")
async def get_platform_analytics(
    host: str | None = None,
    event_type: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_reader),
):
    """
    Super admin icin platform geneli ozet metrikler.
    """
    from api.services.subscription_service import build_subscription_catalog

    total_tenants = db.query(func.count(Tenant.id)).scalar() or 0
    active_tenants = (
        db.query(func.count(Tenant.id)).filter(Tenant.is_active == True).scalar() or 0
    )
    total_internal_users = (
        db.query(func.count(User.id)).filter(User.hidden_from_admin == False).scalar()
        or 0
    )
    total_suppliers = (
        db.query(func.count(Supplier.id)).filter(Supplier.is_active == True).scalar()
        or 0
    )
    platform_suppliers = (
        db.query(func.count(Supplier.id))
        .filter(Supplier.is_active == True, Supplier.tenant_id.is_(None))
        .scalar()
        or 0
    )
    private_suppliers = (
        db.query(func.count(Supplier.id))
        .filter(Supplier.is_active == True, Supplier.tenant_id.isnot(None))
        .scalar()
        or 0
    )
    total_projects = db.query(func.count(Project.id)).scalar() or 0
    total_quotes = db.query(func.count(Quote.id)).scalar() or 0
    parsed_start_date = _parse_optional_iso_datetime(start_date)
    parsed_end_date = _parse_optional_iso_datetime(end_date)
    settings = get_or_create_system_settings(db)
    ensure_public_pricing_json(settings)
    public_pricing = parse_public_pricing_config(settings.public_pricing_json)

    # Plan dagilimi
    catalog = build_subscription_catalog()
    plan_distribution = []
    for plan in catalog.plans:
        count = (
            db.query(func.count(Tenant.id))
            .filter(Tenant.subscription_plan_code == plan.code)
            .scalar()
            or 0
        )
        plan_distribution.append(
            {"plan_code": plan.code, "plan_name": plan.name, "tenant_count": count}
        )

    # Onboarding durumu dagilimi
    onboarding_rows = (
        db.query(Tenant.onboarding_status, func.count(Tenant.id))
        .group_by(Tenant.onboarding_status)
        .all()
    )
    onboarding_distribution = [
        {"status": row[0] or "unknown", "count": row[1]} for row in onboarding_rows
    ]

    strategic_partner_plans = (
        public_pricing.get("strategic_partner", {}).get("plans", [])
        if isinstance(public_pricing.get("strategic_partner"), dict)
        else []
    )
    supplier_plans = (
        public_pricing.get("supplier", {}).get("plans", [])
        if isinstance(public_pricing.get("supplier"), dict)
        else []
    )
    public_campaign_count = (
        db.query(func.count(CampaignProgram.id))
        .filter(CampaignProgram.is_public == True)
        .scalar()
        or 0
    )
    active_public_campaign_count = (
        db.query(func.count(CampaignProgram.id))
        .filter(
            CampaignProgram.is_public == True,
            CampaignProgram.status.in_(["active", "live"]),
        )
        .scalar()
        or 0
    )
    total_campaign_events = (
        db.query(func.coalesce(func.sum(CampaignEvent.quantity), 0)).scalar() or 0
    )
    supplier_signup_events = (
        db.query(func.coalesce(func.sum(CampaignEvent.quantity), 0))
        .filter(CampaignEvent.event_type == "supplier_signup")
        .scalar()
        or 0
    )
    partner_signup_events = (
        db.query(func.coalesce(func.sum(CampaignEvent.quantity), 0))
        .filter(CampaignEvent.event_type == "partner_signup")
        .scalar()
        or 0
    )
    pending_onboarding_leads = (
        db.query(func.count(Tenant.id))
        .filter(Tenant.onboarding_status.in_(["draft", "pending_activation", "trial"]))
        .scalar()
        or 0
    )
    telemetry_filters = []
    if host:
        telemetry_filters.append(PublicTelemetryEvent.host == host)
    if event_type:
        telemetry_filters.append(PublicTelemetryEvent.event_type == event_type)
    if parsed_start_date:
        telemetry_filters.append(PublicTelemetryEvent.created_at >= parsed_start_date)
    if parsed_end_date:
        telemetry_filters.append(PublicTelemetryEvent.created_at <= parsed_end_date)

    total_public_page_views = (
        db.query(func.count(PublicTelemetryEvent.id))
        .filter(PublicTelemetryEvent.event_type == "page_view", *telemetry_filters)
        .scalar()
        or 0
    )
    total_public_cta_clicks = (
        db.query(func.count(PublicTelemetryEvent.id))
        .filter(PublicTelemetryEvent.event_type == "cta_click", *telemetry_filters)
        .scalar()
        or 0
    )
    total_public_form_submits = (
        db.query(func.count(PublicTelemetryEvent.id))
        .filter(PublicTelemetryEvent.event_type == "form_submit", *telemetry_filters)
        .scalar()
        or 0
    )

    public_summary = {
        "strategic_partner_plan_count": len(strategic_partner_plans),
        "supplier_plan_count": len(supplier_plans),
        "public_campaign_count": public_campaign_count,
        "active_public_campaign_count": active_public_campaign_count,
        "campaign_event_count": int(total_campaign_events),
        "partner_signup_events": int(partner_signup_events),
        "supplier_signup_events": int(supplier_signup_events),
        "pending_onboarding_leads": pending_onboarding_leads,
        "platform_network_suppliers": platform_suppliers,
        "page_view_count": int(total_public_page_views),
        "cta_click_count": int(total_public_cta_clicks),
        "form_submit_count": int(total_public_form_submits),
    }

    telemetry_rows = (
        db.query(
            PublicTelemetryEvent.host,
            PublicTelemetryEvent.intent,
            func.count(PublicTelemetryEvent.id),
        )
        .filter(*telemetry_filters)
        .group_by(PublicTelemetryEvent.host, PublicTelemetryEvent.intent)
        .all()
    )
    telemetry_by_host = {
        row[0]: {"intent": row[1], "count": int(row[2])} for row in telemetry_rows
    }
    telemetry_breakdown_rows = (
        db.query(
            PublicTelemetryEvent.host,
            PublicTelemetryEvent.intent,
            PublicTelemetryEvent.event_type,
            func.count(PublicTelemetryEvent.id),
        )
        .filter(*telemetry_filters)
        .group_by(
            PublicTelemetryEvent.host,
            PublicTelemetryEvent.intent,
            PublicTelemetryEvent.event_type,
        )
        .order_by(
            PublicTelemetryEvent.host.asc(),
            PublicTelemetryEvent.event_type.asc(),
        )
        .all()
    )
    telemetry_breakdown = [
        {
            "host": row[0],
            "intent": row[1],
            "event_type": row[2],
            "count": int(row[3]),
        }
        for row in telemetry_breakdown_rows
    ]

    domain_intent_summary = [
        {
            "host": "buyerasistans.com.tr",
            "intent": "corporate",
            "primary_kpi": telemetry_by_host.get("buyerasistans.com.tr", {}).get(
                "count", pending_onboarding_leads
            ),
            "primary_kpi_label": "Tracked Visit / Lead",
        },
        {
            "host": "buyerasistans.com",
            "intent": "global",
            "primary_kpi": telemetry_by_host.get("buyerasistans.com", {}).get(
                "count", int(partner_signup_events)
            ),
            "primary_kpi_label": "Tracked Visit / Partner Event",
        },
        {
            "host": "buyerasistans.online",
            "intent": "campaign",
            "primary_kpi": telemetry_by_host.get("buyerasistans.online", {}).get(
                "count", int(partner_signup_events + supplier_signup_events)
            ),
            "primary_kpi_label": "Tracked Campaign Event",
        },
        {
            "host": "buyerasistans.info",
            "intent": "knowledge",
            "primary_kpi": telemetry_by_host.get("buyerasistans.info", {}).get(
                "count", int(total_campaign_events)
            ),
            "primary_kpi_label": "Tracked Knowledge Event",
        },
    ]

    return {
        "summary": {
            "total_tenants": total_tenants,
            "active_tenants": active_tenants,
            "total_internal_users": total_internal_users,
            "total_suppliers": total_suppliers,
            "platform_suppliers": platform_suppliers,
            "private_suppliers": private_suppliers,
            "total_projects": total_projects,
            "total_quotes": total_quotes,
        },
        "plan_distribution": plan_distribution,
        "onboarding_distribution": onboarding_distribution,
        "public_summary": public_summary,
        "domain_intent_summary": domain_intent_summary,
        "telemetry_breakdown": telemetry_breakdown,
    }


class PublicPricingConfigOut(BaseModel):
    strategic_partner: dict
    supplier: dict


def _parse_optional_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    normalized = value.strip()
    if not normalized:
        return None
    if len(normalized) == 10:
        normalized = f"{normalized}T00:00:00"
    normalized = normalized.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _build_public_telemetry_breakdown(
    db: Session,
    host: str | None = None,
    event_type: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
):
    query = db.query(
        PublicTelemetryEvent.host,
        PublicTelemetryEvent.intent,
        PublicTelemetryEvent.event_type,
        func.count(PublicTelemetryEvent.id),
    )
    if host:
        query = query.filter(PublicTelemetryEvent.host == host)
    if event_type:
        query = query.filter(PublicTelemetryEvent.event_type == event_type)
    if start_date:
        query = query.filter(PublicTelemetryEvent.created_at >= start_date)
    if end_date:
        query = query.filter(PublicTelemetryEvent.created_at <= end_date)

    rows = (
        query.group_by(
            PublicTelemetryEvent.host,
            PublicTelemetryEvent.intent,
            PublicTelemetryEvent.event_type,
        )
        .order_by(
            PublicTelemetryEvent.host.asc(),
            PublicTelemetryEvent.event_type.asc(),
        )
        .all()
    )
    return [
        {
            "host": row[0],
            "intent": row[1],
            "event_type": row[2],
            "count": int(row[3]),
        }
        for row in rows
    ]


@router.get("/platform-analytics/export")
async def export_platform_analytics_telemetry(
    host: str | None = None,
    event_type: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_reader),
):
    rows = _build_public_telemetry_breakdown(
        db,
        host=host or None,
        event_type=event_type or None,
        start_date=_parse_optional_iso_datetime(start_date),
        end_date=_parse_optional_iso_datetime(end_date),
    )

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["host", "intent", "event_type", "count"])
    for row in rows:
        writer.writerow([row["host"], row["intent"], row["event_type"], row["count"]])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="platform-public-telemetry.csv"'
        },
    )


@router.get("/public-pricing-config", response_model=PublicPricingConfigOut)
async def get_public_pricing_config(
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_reader),
):
    settings = _get_or_create_system_settings(db)

    ensure_public_pricing_json(settings)
    db.commit()
    db.refresh(settings)

    return parse_public_pricing_config(settings.public_pricing_json)


@router.put("/public-pricing-config", response_model=PublicPricingConfigOut)
async def update_public_pricing_config(
    payload: PublicPricingConfigOut,
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_manager),
):
    settings = _get_or_create_system_settings(db)

    config = payload.model_dump()
    if not config.get("strategic_partner") or not config.get("supplier"):
        raise HTTPException(
            status_code=422, detail="Strategic partner ve supplier bloklari zorunludur"
        )

    settings.public_pricing_json = serialize_public_pricing_config(config)
    db.commit()
    db.refresh(settings)
    return parse_public_pricing_config(settings.public_pricing_json)


# ---------------------------------------------------------------------------
# Sprint-5: Admin Komisyon Onay Akışı
# ---------------------------------------------------------------------------

from api.models.channel import (
    CommissionLedger,
    CommissionContract,
    ChannelOrganization,
    ChannelReferralEvent,
    ChannelReferralLink,
)  # noqa: E402


class AdminLedgerItemOut(BaseModel):
    id: int
    channel_org_id: int
    org_name: str | None
    event_type: str
    amount: float
    currency: str
    status: str
    note: str | None
    created_at: str
    paid_at: str | None


class AdminLedgerListOut(BaseModel):
    total: int
    items: list[AdminLedgerItemOut]


class BulkApprovePayload(BaseModel):
    ledger_ids: list[int]
    new_status: str = "approved"


class AdminCommissionDashboardOut(BaseModel):
    total_pending: float
    total_approved: float
    total_paid: float
    total_cancelled: float
    org_breakdown: list[dict]
    referral_breakdown: list[dict]


@router.get("/channel/commission-ledger", response_model=AdminLedgerListOut)
def admin_list_commission_ledger(
    status_filter: str | None = None,
    org_id: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Super admin / platform staff: tum komisyon ledger kayitlarini listeler."""
    if not (is_super_admin(current_user) or is_platform_staff(current_user)):
        raise HTTPException(status_code=403, detail="Yetkisiz erisim.")

    query = db.query(CommissionLedger)
    if status_filter:
        query = query.filter(CommissionLedger.status == status_filter)
    if org_id is not None:
        query = query.filter(CommissionLedger.channel_org_id == org_id)

    total = query.count()
    rows = (
        query.order_by(CommissionLedger.created_at.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )

    org_id_to_name: dict[int, str] = {}
    org_ids = list({int(r.channel_org_id) for r in rows})
    if org_ids:
        orgs = (
            db.query(ChannelOrganization)
            .filter(ChannelOrganization.id.in_(org_ids))
            .all()
        )
        org_id_to_name = {o.id: o.name for o in orgs}

    items = [
        AdminLedgerItemOut(
            id=r.id,
            channel_org_id=r.channel_org_id,
            org_name=org_id_to_name.get(r.channel_org_id),
            event_type=r.event_type,
            amount=float(r.amount or 0),
            currency=r.currency,
            status=r.status,
            note=r.note,
            created_at=r.created_at.isoformat() if r.created_at else "",
            paid_at=r.paid_at.isoformat() if r.paid_at else None,
        )
        for r in rows
    ]
    return AdminLedgerListOut(total=total, items=items)


@router.post("/channel/commission-ledger/{ledger_id}/approve")
def admin_approve_ledger_entry(
    ledger_id: int,
    new_status: str = "approved",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tekil ledger kaydini onayla veya odendi olarak isaretle."""
    if not (is_super_admin(current_user) or is_platform_staff(current_user)):
        raise HTTPException(status_code=403, detail="Yetkisiz erisim.")

    allowed = {"approved", "paid", "cancelled"}
    if new_status not in allowed:
        raise HTTPException(
            status_code=422, detail=f"Gecersiz durum. Izin verilenler: {allowed}"
        )

    entry = db.get(CommissionLedger, ledger_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger kaydi bulunamadi.")

    entry.status = new_status
    if new_status == "paid":
        from api.core.time import utcnow as _utcnow

        entry.paid_at = _utcnow()
    db.commit()
    return {"id": ledger_id, "status": new_status}


@router.post("/channel/commission-ledger/bulk-approve")
def admin_bulk_approve_ledger(
    payload: BulkApprovePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Birden fazla ledger kaydini toplu olarak guncelle."""
    if not (is_super_admin(current_user) or is_platform_staff(current_user)):
        raise HTTPException(status_code=403, detail="Yetkisiz erisim.")

    allowed = {"approved", "paid", "cancelled"}
    if payload.new_status not in allowed:
        raise HTTPException(
            status_code=422, detail=f"Gecersiz durum. Izin verilenler: {allowed}"
        )

    if not payload.ledger_ids:
        return {"updated": 0}

    from api.core.time import utcnow as _utcnow

    paid_at_value = _utcnow() if payload.new_status == "paid" else None

    rows = (
        db.query(CommissionLedger)
        .filter(CommissionLedger.id.in_(payload.ledger_ids))
        .all()
    )
    for row in rows:
        row.status = payload.new_status
        if paid_at_value:
            row.paid_at = paid_at_value
    db.commit()
    return {"updated": len(rows)}


@router.get("/channel/commission-dashboard", response_model=AdminCommissionDashboardOut)
def admin_commission_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tum kanal orglar icin komisyon ozet tablosu."""
    if not (is_super_admin(current_user) or is_platform_staff(current_user)):
        raise HTTPException(status_code=403, detail="Yetkisiz erisim.")

    rows = (
        db.query(
            CommissionLedger.channel_org_id,
            CommissionLedger.status,
            func.coalesce(func.sum(CommissionLedger.amount), 0),
        )
        .group_by(CommissionLedger.channel_org_id, CommissionLedger.status)
        .all()
    )

    total: dict[str, float] = {
        "pending": 0.0,
        "approved": 0.0,
        "paid": 0.0,
        "cancelled": 0.0,
    }
    org_map: dict[int, dict[str, float]] = {}
    for org_id_val, status_val, amt_val in rows:
        oid = int(org_id_val)
        st = str(status_val or "").lower()
        amt = float(amt_val or 0)
        total[st] = total.get(st, 0.0) + amt
        org_map.setdefault(
            oid, {"pending": 0.0, "approved": 0.0, "paid": 0.0, "cancelled": 0.0}
        )
        org_map[oid][st] = org_map[oid].get(st, 0.0) + amt

    org_ids = list(org_map.keys())
    org_name_map: dict[int, str] = {}
    if org_ids:
        orgs = (
            db.query(ChannelOrganization)
            .filter(ChannelOrganization.id.in_(org_ids))
            .all()
        )
        org_name_map = {o.id: o.name for o in orgs}

    org_breakdown = [
        {
            "org_id": oid,
            "org_name": org_name_map.get(oid),
            **sums,
        }
        for oid, sums in sorted(org_map.items())
    ]

    referral_rows = (
        db.query(
            ChannelReferralLink.owner_user_id,
            ChannelReferralLink.link_code,
            ChannelReferralLink.campaign_id,
            ChannelReferralLink.target_type,
            ChannelReferralEvent.event_type,
            func.count(ChannelReferralEvent.id),
        )
        .join(
            ChannelReferralEvent,
            ChannelReferralEvent.referral_link_id == ChannelReferralLink.id,
        )
        .group_by(
            ChannelReferralLink.owner_user_id,
            ChannelReferralLink.link_code,
            ChannelReferralLink.campaign_id,
            ChannelReferralLink.target_type,
            ChannelReferralEvent.event_type,
        )
        .all()
    )

    link_net_rows = (
        db.query(
            ChannelReferralLink.link_code,
            func.coalesce(func.sum(CommissionLedger.amount), 0),
        )
        .join(
            ChannelReferralEvent,
            ChannelReferralEvent.id == CommissionLedger.reference_id,
        )
        .join(
            ChannelReferralLink,
            ChannelReferralLink.id == ChannelReferralEvent.referral_link_id,
        )
        .filter(
            CommissionLedger.reference_type == "channel_referral_event",
            CommissionLedger.status.in_(["approved", "paid"]),
        )
        .group_by(ChannelReferralLink.link_code)
        .all()
    )

    campaign_ids = list(
        {
            int(campaign_id)
            for _, _, campaign_id, _, _, _ in referral_rows
            if campaign_id is not None
        }
    )
    campaign_name_map: dict[int, str] = {}
    if campaign_ids:
        programs = (
            db.query(CampaignProgram).filter(CampaignProgram.id.in_(campaign_ids)).all()
        )
        campaign_name_map = {int(item.id): item.name for item in programs}

    link_code_to_net: dict[str, float] = {
        str(link_code): float(net or 0) for link_code, net in link_net_rows if link_code
    }

    owner_ids = list({int(owner_id) for owner_id, _, _, _, _, _ in referral_rows})
    owner_org_rows = []
    if owner_ids:
        owner_org_rows = (
            db.query(
                ChannelOrganization.id,
                ChannelOrganization.name,
                ChannelOrganization.account_owner_user_id,
            )
            .filter(ChannelOrganization.account_owner_user_id.in_(owner_ids))
            .all()
        )
    owner_to_org = {
        int(owner_id): (int(org_id), org_name)
        for org_id, org_name, owner_id in owner_org_rows
        if owner_id is not None
    }

    referral_map: dict[str, dict[str, Any]] = {}
    for (
        owner_user_id,
        link_code,
        campaign_id,
        target_type,
        event_type,
        count_val,
    ) in referral_rows:
        code = str(link_code or "").strip()
        if not code:
            continue
        org_id, org_name = owner_to_org.get(int(owner_user_id), (None, None))
        key = code
        if key not in referral_map:
            referral_map[key] = {
                "org_id": org_id,
                "org_name": org_name,
                "owner_user_id": int(owner_user_id),
                "link_code": code,
                "campaign_id": int(campaign_id) if campaign_id is not None else None,
                "campaign_name": campaign_name_map.get(int(campaign_id))
                if campaign_id is not None
                else None,
                "target_type": target_type,
                "clicks": 0,
                "signups": 0,
                "activations": 0,
                "net_commission": link_code_to_net.get(code, 0.0),
            }

        event_type_key = str(event_type or "").strip().lower()
        value = int(count_val or 0)
        if event_type_key == "click":
            referral_map[key]["clicks"] += value
        if event_type_key in {"signup", "partner_signup", "supplier_signup"}:
            referral_map[key]["signups"] += value
        if event_type_key in {
            "activation",
            "partner_activation",
            "supplier_activation",
        }:
            referral_map[key]["activations"] += value

    referral_breakdown = sorted(
        referral_map.values(),
        key=lambda item: (
            float(item.get("net_commission", 0.0)),
            int(item.get("signups", 0)),
            int(item.get("clicks", 0)),
            str(item.get("link_code", "")),
        ),
        reverse=True,
    )

    return AdminCommissionDashboardOut(
        total_pending=round(total.get("pending", 0.0), 2),
        total_approved=round(total.get("approved", 0.0), 2),
        total_paid=round(total.get("paid", 0.0), 2),
        total_cancelled=round(total.get("cancelled", 0.0), 2),
        org_breakdown=org_breakdown,
        referral_breakdown=referral_breakdown,
    )


@router.post("/channel-workspace/seed-defaults", status_code=200)
def seed_channel_workspace_defaults(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kanal kullanıcısının tenant'ına varsayılan kanal departmanlarını ve rollerini seed eder.
    channel_owner kendi workspace'ini seed edebilir; super admin tüm channel tenant'larını seed edebilir.
    """
    normalized = normalized_role(current_user)
    is_channel_owner = normalized in {"channel_owner"}
    is_admin = is_super_admin(current_user) or is_platform_staff(current_user)

    if not (is_channel_owner or is_admin):
        raise HTTPException(
            status_code=403,
            detail="Bu işlem yalnızca kanal hesap sahibi veya platform yöneticisi içindir.",
        )

    if is_channel_owner:
        tenant = _ensure_channel_workspace_tenant(db, current_user)
        _seed_default_channel_catalog_for_tenant(db, tenant, current_user.id)
        seeded_emails = _seed_default_channel_personnel_for_tenant(
            db,
            tenant,
            current_user.id,
            email_domain="buyerasistans.com.tr",
            default_password="Aa1234!!",
        )
        db.commit()
        return {
            "status": "ok",
            "message": "Kanal workspace varsayilan rolleri, departmanlari ve personel kayitlari olusturuldu.",
            "tenant_id": tenant.id,
            "seeded_personnel_emails": seeded_emails,
            "seeded_personnel_password": "Aa1234!!",
        }

    # Super admin: tüm channel tenantlarını seed et
    channel_tenant_ids = [
        int(row[0])
        for row in db.query(User.tenant_id)
        .filter(
            User.tenant_id.isnot(None),
            User.business_role.in_(["channel_owner", "channel_agent"]),
        )
        .distinct()
        .all()
        if row[0] is not None
    ]
    if not channel_tenant_ids:
        return {
            "status": "ok",
            "message": "Seed edilecek kanal tenant'ı bulunamadı.",
            "seeded": 0,
        }

    tenants_to_seed = db.query(Tenant).filter(Tenant.id.in_(channel_tenant_ids)).all()
    seeded_count = 0
    for tenant in tenants_to_seed:
        _seed_default_channel_catalog_for_tenant(db, tenant, None)
        seeded_count += 1

    db.commit()
    return {
        "status": "ok",
        "message": f"{seeded_count} kanal workspace seed edildi.",
        "seeded": seeded_count,
    }
