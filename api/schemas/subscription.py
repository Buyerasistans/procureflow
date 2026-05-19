from __future__ import annotations

from pydantic import BaseModel


class SubscriptionModuleOut(BaseModel):
    code: str
    name: str
    description: str
    enabled: bool
    limit_key: str | None = None
    limit_value: int | None = None
    unit: str | None = None


class SubscriptionPlanOut(BaseModel):
    code: str
    name: str
    description: str
    audience: str
    is_default: bool = False
    modules: list[SubscriptionModuleOut]


class SubscriptionCatalogOut(BaseModel):
    plans: list[SubscriptionPlanOut]


class SubscriptionTenantUsageMetricOut(BaseModel):
    key: str
    label: str
    used: int
    limit: int | None = None
    unit: str | None = None


class SubscriptionTenantUsageOut(BaseModel):
    tenant_id: int
    tenant_name: str
    plan_code: str
    plan_name: str
    status: str
    is_active: bool
    metrics: list[SubscriptionTenantUsageMetricOut]


class SubscriptionCatalogSnapshotOut(BaseModel):
    catalog: SubscriptionCatalogOut
    tenant_usage: list[SubscriptionTenantUsageOut]
