import hashlib
import hmac
import json

from api.database import SessionLocal
from api.models.billing import BillingInvoice
from api.models.billing import BillingWebhookEvent, TenantSubscription
from api.models.user import User
from api.core.security import get_password_hash


def _create_user(email: str, password: str, *, role: str, system_role: str) -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            existing.role = role
            existing.system_role = system_role
            existing.hashed_password = get_password_hash(password)
            existing.is_active = True
        else:
            db.add(
                User(
                    email=email,
                    hashed_password=get_password_hash(password),
                    full_name=email.split("@")[0],
                    role=role,
                    system_role=system_role,
                    is_active=True,
                )
            )
        db.commit()
    finally:
        db.close()


def _login(client, email: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_list_tenants_requires_tenant_governance_manager(client):
    _create_user(
        "platform-support@procureflow.dev",
        "Support123!",
        role="user",
        system_role="platform_support",
    )
    token = _login(client, "platform-support@procureflow.dev", "Support123!")

    response = client.get(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_list_tenants_allows_platform_operator(client):
    _create_user(
        "platform-operator@procureflow.dev",
        "Operator123!",
        role="user",
        system_role="platform_operator",
    )
    token = _login(client, "platform-operator@procureflow.dev", "Operator123!")

    response = client.get(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_onboarding_studio_summary_allows_platform_support(client):
    _create_user(
        "tenant-governance-onboarding-support@procureflow.dev",
        "Support123!",
        role="user",
        system_role="platform_support",
    )
    token = _login(
        client, "tenant-governance-onboarding-support@procureflow.dev", "Support123!"
    )

    response = client.get(
        "/api/v1/admin/onboarding-studio/summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert "tenant_count" in body
    assert "rfq_readiness" in body
    assert "supplier_mix" in body
    assert "approvals_quote_tenant_mismatch" in body["rfq_readiness"]
    assert "supplier_quotes_platform_network_count" in body["rfq_readiness"]


def test_onboarding_studio_summary_forbids_tenant_admin(client):
    _create_user(
        "tenant-governance-onboarding-tenant-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
    )
    token = _login(
        client, "tenant-governance-onboarding-tenant-admin@procureflow.dev", "Admin123!"
    )

    response = client.get(
        "/api/v1/admin/onboarding-studio/summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403, response.text


def test_subscription_catalog_requires_super_admin(client):
    _create_user(
        "tenant-package-support@procureflow.dev",
        "Support123!",
        role="user",
        system_role="platform_support",
    )
    token = _login(client, "tenant-package-support@procureflow.dev", "Support123!")

    response = client.get(
        "/api/v1/admin/subscription-catalog",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert "Sadece super admin" in response.json()["detail"]


def test_subscription_catalog_allows_super_admin(client):
    _create_user(
        "tenant-package-super@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    token = _login(client, "tenant-package-super@procureflow.dev", "Super123!")

    response = client.get(
        "/api/v1/admin/subscription-catalog",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert any(plan["code"] == "starter" for plan in body["catalog"]["plans"])
    assert any(
        module["code"] == "rfq_core"
        for plan in body["catalog"]["plans"]
        for module in plan["modules"]
    )
    assert isinstance(body["tenant_usage"], list)


def test_list_tenants_forbids_tenant_admin(client):
    _create_user(
        "tenant-governance-tenant-admin-list@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
    )
    token = _login(
        client, "tenant-governance-tenant-admin-list@procureflow.dev", "Admin123!"
    )

    response = client.get(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert "Sadece super admin" in response.json()["detail"]


def test_list_tenants_allows_super_admin(client):
    _create_user(
        "tenant-governance-super@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    token = _login(client, "tenant-governance-super@procureflow.dev", "Super123!")

    response = client.get(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_create_tenant_forbids_platform_support(client):
    _create_user(
        "tenant-governance-support-create@procureflow.dev",
        "Support123!",
        role="user",
        system_role="platform_support",
    )
    token = _login(
        client,
        "tenant-governance-support-create@procureflow.dev",
        "Support123!",
    )

    response = client.post(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "legal_name": "Support Forbidden Tenant",
            "brand_name": "Support Forbidden",
        },
    )

    assert response.status_code == 403
    assert "Sadece super admin" in response.json()["detail"]


def test_create_tenant_forbids_tenant_admin(client):
    _create_user(
        "tenant-governance-tenant-admin-create@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
    )
    token = _login(
        client,
        "tenant-governance-tenant-admin-create@procureflow.dev",
        "Admin123!",
    )

    response = client.post(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "legal_name": "Tenant Admin Forbidden Tenant",
            "brand_name": "Tenant Admin Forbidden",
        },
    )

    assert response.status_code == 403
    assert "Sadece super admin" in response.json()["detail"]


def test_create_tenant_forbids_platform_operator(client):
    _create_user(
        "tenant-governance-operator-create@procureflow.dev",
        "Operator123!",
        role="user",
        system_role="platform_operator",
    )
    token = _login(
        client,
        "tenant-governance-operator-create@procureflow.dev",
        "Operator123!",
    )

    response = client.post(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "legal_name": "Operator Forbidden Tenant",
            "brand_name": "Operator Forbidden",
        },
    )

    assert response.status_code == 403
    assert "Sadece super admin" in response.json()["detail"]


def test_super_admin_can_create_and_update_tenant(client):
    _create_user(
        "tenant-governance-super-write@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    token = _login(client, "tenant-governance-super-write@procureflow.dev", "Super123!")

    create_response = client.post(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "legal_name": "Governance Writable Tenant",
            "brand_name": "Governance Writable",
            "city": "Istanbul",
            "subscription_plan_code": "starter",
            "status": "active",
            "onboarding_status": "draft",
        },
    )

    assert create_response.status_code == 200, create_response.text
    created = create_response.json()
    assert created["legal_name"] == "Governance Writable Tenant"

    update_response = client.put(
        f"/api/v1/admin/tenants/{created['id']}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "brand_name": "Governance Writable Updated",
            "status": "paused",
            "is_active": False,
        },
    )

    assert update_response.status_code == 200, update_response.text
    updated = update_response.json()
    assert updated["brand_name"] == "Governance Writable Updated"
    assert updated["status"] == "paused"
    assert updated["is_active"] is False


def test_platform_support_can_update_tenant_support_workflow(client):
    _create_user(
        "tenant-governance-super-support-workflow@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    super_token = _login(
        client, "tenant-governance-super-support-workflow@procureflow.dev", "Super123!"
    )

    create_response = client.post(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "legal_name": "Support Workflow Tenant",
            "brand_name": "Workflow Tenant",
            "subscription_plan_code": "starter",
        },
    )
    assert create_response.status_code == 200, create_response.text
    tenant_id = create_response.json()["id"]

    _create_user(
        "tenant-governance-platform-support-workflow@procureflow.dev",
        "Support123!",
        role="user",
        system_role="platform_support",
    )
    support_token = _login(
        client,
        "tenant-governance-platform-support-workflow@procureflow.dev",
        "Support123!",
    )

    workflow_response = client.patch(
        f"/api/v1/admin/tenants/{tenant_id}/support-workflow",
        headers={"Authorization": f"Bearer {support_token}"},
        json={
            "support_status": "resolved",
            "support_owner_name": "Platform Destek",
            "support_notes": "Owner dogrulamasi bekleniyor",
            "support_resolution_reason": "Owner dogrulamasi tamamlandi ve tenant aktif kullanima alindi",
            "support_last_contacted_at": "2026-04-15T00:00:00Z",
        },
    )

    assert workflow_response.status_code == 200, workflow_response.text
    body = workflow_response.json()
    assert body["support_status"] == "resolved"
    assert body["support_owner_name"] == "Platform Destek"
    assert body["support_notes"] == "Owner dogrulamasi bekleniyor"
    assert (
        body["support_resolution_reason"]
        == "Owner dogrulamasi tamamlandi ve tenant aktif kullanima alindi"
    )
    assert body["support_last_contacted_at"].startswith("2026-04-15T00:00:00")


def test_platform_support_cannot_resolve_tenant_support_workflow_without_resolution_reason(
    client,
):
    _create_user(
        "tenant-governance-super-support-workflow-no-reason@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    super_token = _login(
        client,
        "tenant-governance-super-support-workflow-no-reason@procureflow.dev",
        "Super123!",
    )

    create_response = client.post(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "legal_name": "Support Workflow Missing Reason Tenant",
            "brand_name": "Workflow Missing Reason",
            "subscription_plan_code": "starter",
        },
    )
    assert create_response.status_code == 200, create_response.text
    tenant_id = create_response.json()["id"]

    _create_user(
        "tenant-governance-platform-support-workflow-no-reason@procureflow.dev",
        "Support123!",
        role="user",
        system_role="platform_support",
    )
    support_token = _login(
        client,
        "tenant-governance-platform-support-workflow-no-reason@procureflow.dev",
        "Support123!",
    )

    workflow_response = client.patch(
        f"/api/v1/admin/tenants/{tenant_id}/support-workflow",
        headers={"Authorization": f"Bearer {support_token}"},
        json={
            "support_status": "resolved",
            "support_notes": "Kapatiliyor",
        },
    )

    assert workflow_response.status_code == 400
    assert (
        workflow_response.json()["detail"]
        == "Cozulen destek kaydi icin kapanis nedeni zorunludur"
    )


def test_tenant_admin_cannot_update_tenant_support_workflow(client):
    _create_user(
        "tenant-governance-tenant-admin-support-workflow@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
    )
    token = _login(
        client,
        "tenant-governance-tenant-admin-support-workflow@procureflow.dev",
        "Admin123!",
    )

    response = client.patch(
        "/api/v1/admin/tenants/1/support-workflow",
        headers={"Authorization": f"Bearer {token}"},
        json={"support_notes": "Yetkisiz not"},
    )
    assert response.status_code == 403
    assert "Sadece super admin veya platform personeli" in response.json()["detail"]


def test_super_admin_cannot_create_tenant_with_unknown_subscription_plan(client):
    _create_user(
        "tenant-governance-super-invalid-create@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    token = _login(
        client, "tenant-governance-super-invalid-create@procureflow.dev", "Super123!"
    )

    response = client.post(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "legal_name": "Invalid Plan Tenant",
            "brand_name": "Invalid Plan",
            "subscription_plan_code": "unknown-plan",
        },
    )

    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "Gecersiz subscription_plan_code"


def test_super_admin_cannot_update_tenant_with_unknown_subscription_plan(client):
    _create_user(
        "tenant-governance-super-invalid-update@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    token = _login(
        client, "tenant-governance-super-invalid-update@procureflow.dev", "Super123!"
    )
    create_response = client.post(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "legal_name": "Valid Plan Tenant",
            "brand_name": "Valid Plan",
            "subscription_plan_code": "starter",
        },
    )
    assert create_response.status_code == 200, create_response.text

    response = client.put(
        f"/api/v1/admin/tenants/{create_response.json()['id']}",
        headers={"Authorization": f"Bearer {token}"},
        json={"subscription_plan_code": "unknown-plan"},
    )

    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "Gecersiz subscription_plan_code"


def test_tenant_create_and_update_syncs_tenant_subscription_record(client):
    _create_user(
        "tenant-governance-super-subscription-sync@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    token = _login(
        client, "tenant-governance-super-subscription-sync@procureflow.dev", "Super123!"
    )

    create_response = client.post(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "legal_name": "Subscription Sync Tenant",
            "brand_name": "Sync Tenant",
            "subscription_plan_code": "starter",
        },
    )

    assert create_response.status_code == 200, create_response.text
    tenant_id = create_response.json()["id"]

    db = SessionLocal()
    try:
        subscription = (
            db.query(TenantSubscription)
            .filter(TenantSubscription.tenant_id == tenant_id)
            .first()
        )
        assert subscription is not None
        assert subscription.subscription_plan_code == "starter"
        assert subscription.status == "active"
    finally:
        db.close()

    update_response = client.put(
        f"/api/v1/admin/tenants/{tenant_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "subscription_plan_code": "growth",
            "is_active": False,
            "status": "paused",
        },
    )
    assert update_response.status_code == 200, update_response.text

    db = SessionLocal()
    try:
        subscription = (
            db.query(TenantSubscription)
            .filter(TenantSubscription.tenant_id == tenant_id)
            .first()
        )
        assert subscription is not None
        assert subscription.subscription_plan_code == "growth"
        assert subscription.status == "paused"
    finally:
        db.close()


def test_billing_webhook_ingest_is_idempotent_and_updates_subscription(client):
    _create_user(
        "tenant-governance-super-webhook@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    token = _login(
        client, "tenant-governance-super-webhook@procureflow.dev", "Super123!"
    )
    create_response = client.post(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "legal_name": "Webhook Tenant",
            "brand_name": "Webhook Tenant",
            "subscription_plan_code": "starter",
        },
    )
    assert create_response.status_code == 200, create_response.text
    tenant_id = create_response.json()["id"]

    payload = {
        "event_id": f"billing-webhook-{tenant_id}",
        "event_type": "subscription.updated",
        "tenant_id": tenant_id,
        "plan_code": "enterprise",
        "subscription_status": "active",
        "billing_cycle": "yearly",
        "seats_purchased": 25,
        "provider_customer_id": f"cus-{tenant_id}",
        "provider_subscription_id": f"sub-{tenant_id}",
        "invoice": {
            "provider_invoice_id": f"inv-{tenant_id}",
            "invoice_number": f"PF-{tenant_id}",
            "status": "open",
            "currency": "TRY",
            "subtotal_amount": 1000,
            "tax_amount": 200,
            "total_amount": 1200,
        },
    }

    first_response = client.post("/api/v1/billing/webhooks/stripe", json=payload)
    assert first_response.status_code == 200, first_response.text
    assert first_response.json()["duplicate"] is False
    assert first_response.json()["processing_status"] == "processed"

    second_response = client.post("/api/v1/billing/webhooks/stripe", json=payload)
    assert second_response.status_code == 200, second_response.text
    assert second_response.json()["duplicate"] is True

    db = SessionLocal()
    try:
        subscription = (
            db.query(TenantSubscription)
            .filter(TenantSubscription.tenant_id == tenant_id)
            .first()
        )
        assert subscription is not None
        assert subscription.subscription_plan_code == "enterprise"
        assert subscription.billing_cycle == "yearly"
        assert subscription.seats_purchased == 25

        webhook_events = (
            db.query(BillingWebhookEvent)
            .filter(BillingWebhookEvent.tenant_id == tenant_id)
            .all()
        )
        assert len(webhook_events) == 1
        assert webhook_events[0].provider_event_id == payload["event_id"]

        invoice = (
            db.query(BillingInvoice)
            .filter(BillingInvoice.tenant_id == tenant_id)
            .first()
        )
        assert invoice is not None
        assert invoice.provider_invoice_id == payload["invoice"]["provider_invoice_id"]
        assert float(invoice.total_amount) == 1200
    finally:
        db.close()


def test_billing_webhook_rejects_invalid_shared_secret(client, monkeypatch):
    _create_user(
        "tenant-governance-super-webhook-secret@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    token = _login(
        client, "tenant-governance-super-webhook-secret@procureflow.dev", "Super123!"
    )
    create_response = client.post(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "legal_name": "Webhook Secret Tenant",
            "brand_name": "Webhook Secret Tenant",
            "subscription_plan_code": "starter",
        },
    )
    assert create_response.status_code == 200, create_response.text
    tenant_id = create_response.json()["id"]

    monkeypatch.setenv("BILLING_WEBHOOK_SHARED_SECRET", "test-shared-secret")

    payload = {
        "event_id": f"billing-webhook-secret-{tenant_id}",
        "event_type": "subscription.updated",
        "tenant_id": tenant_id,
        "plan_code": "growth",
    }

    unauthorized = client.post("/api/v1/billing/webhooks/stripe", json=payload)
    assert unauthorized.status_code == 401

    authorized = client.post(
        "/api/v1/billing/webhooks/stripe",
        headers={"X-Webhook-Secret": "test-shared-secret"},
        json=payload,
    )
    assert authorized.status_code == 200, authorized.text


def test_billing_webhook_validates_stripe_signature_when_configured(
    client, monkeypatch
):
    _create_user(
        "tenant-governance-super-webhook-signature@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    token = _login(
        client, "tenant-governance-super-webhook-signature@procureflow.dev", "Super123!"
    )
    create_response = client.post(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "legal_name": "Webhook Signature Tenant",
            "brand_name": "Webhook Signature Tenant",
            "subscription_plan_code": "starter",
        },
    )
    assert create_response.status_code == 200, create_response.text
    tenant_id = create_response.json()["id"]

    monkeypatch.delenv("BILLING_WEBHOOK_SHARED_SECRET", raising=False)
    monkeypatch.setenv(
        "BILLING_WEBHOOK_STRIPE_SIGNATURE_SECRET", "stripe-signing-secret"
    )

    payload = {
        "event_id": f"billing-webhook-signature-{tenant_id}",
        "event_type": "subscription.updated",
        "tenant_id": tenant_id,
        "plan_code": "enterprise",
    }
    body = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))
    timestamp = "1700000000"
    valid_signature = hmac.new(
        b"stripe-signing-secret",
        f"{timestamp}.{body}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    invalid_response = client.post(
        "/api/v1/billing/webhooks/stripe",
        headers={"Stripe-Signature": f"t={timestamp},v1=invalid"},
        content=body,
    )
    assert invalid_response.status_code == 401

    valid_response = client.post(
        "/api/v1/billing/webhooks/stripe",
        headers={
            "Stripe-Signature": f"t={timestamp},v1={valid_signature}",
            "Content-Type": "application/json",
        },
        content=body,
    )
    assert valid_response.status_code == 200, valid_response.text
    assert valid_response.json()["processing_status"] == "processed"


def test_billing_overview_requires_super_admin(client):
    _create_user(
        "billing-overview-support@procureflow.dev",
        "Support123!",
        role="user",
        system_role="platform_support",
    )
    token = _login(client, "billing-overview-support@procureflow.dev", "Support123!")

    response = client.get(
        "/api/v1/billing/overview",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert "Sadece super admin" in response.json()["detail"]


def test_billing_overview_allows_super_admin(client):
    _create_user(
        "billing-overview-super@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    token = _login(client, "billing-overview-super@procureflow.dev", "Super123!")

    response = client.get(
        "/api/v1/billing/overview",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert "subscriptions" in body
    assert "invoices" in body
    assert "recent_webhook_events" in body


def test_billing_webhook_retry_requires_super_admin(client):
    _create_user(
        "billing-webhook-retry-support@procureflow.dev",
        "Support123!",
        role="user",
        system_role="platform_support",
    )
    token = _login(
        client, "billing-webhook-retry-support@procureflow.dev", "Support123!"
    )

    response = client.post(
        "/api/v1/billing/webhooks/events/1/retry",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert "Sadece super admin" in response.json()["detail"]


def test_super_admin_can_retry_failed_billing_webhook_event(client):
    _create_user(
        "billing-webhook-retry-super@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    token = _login(client, "billing-webhook-retry-super@procureflow.dev", "Super123!")

    create_response = client.post(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "legal_name": "Webhook Retry Tenant",
            "brand_name": "Webhook Retry Tenant",
            "subscription_plan_code": "starter",
        },
    )
    assert create_response.status_code == 200, create_response.text
    tenant_id = create_response.json()["id"]

    db = SessionLocal()
    try:
        failed_event = BillingWebhookEvent(
            tenant_id=tenant_id,
            provider="stripe",
            event_type="subscription.updated",
            provider_event_id=f"billing-retry-{tenant_id}",
            processing_status="failed",
            error_message="mock processing error",
            payload_json=json.dumps(
                {
                    "event_id": f"billing-retry-{tenant_id}",
                    "event_type": "subscription.updated",
                    "tenant_id": tenant_id,
                    "plan_code": "growth",
                    "subscription_status": "active",
                    "billing_cycle": "yearly",
                    "seats_purchased": 12,
                    "provider_customer_id": f"cus-retry-{tenant_id}",
                    "provider_subscription_id": f"sub-retry-{tenant_id}",
                    "invoice": {
                        "provider_invoice_id": f"inv-retry-{tenant_id}",
                        "invoice_number": f"PF-RETRY-{tenant_id}",
                        "status": "open",
                        "currency": "TRY",
                        "subtotal_amount": 100,
                        "tax_amount": 20,
                        "total_amount": 120,
                    },
                },
                ensure_ascii=True,
            ),
        )
        db.add(failed_event)
        db.commit()
        db.refresh(failed_event)
        event_id = failed_event.id
    finally:
        db.close()

    retry_response = client.post(
        f"/api/v1/billing/webhooks/events/{event_id}/retry",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert retry_response.status_code == 200, retry_response.text
    body = retry_response.json()
    assert body["id"] == event_id
    assert body["retried"] is True
    assert body["processing_status"] == "processed"

    db = SessionLocal()
    try:
        updated_event = (
            db.query(BillingWebhookEvent)
            .filter(BillingWebhookEvent.id == event_id)
            .first()
        )
        assert updated_event is not None
        assert updated_event.processing_status == "processed"
        assert not updated_event.error_message

        subscription = (
            db.query(TenantSubscription)
            .filter(TenantSubscription.tenant_id == tenant_id)
            .first()
        )
        assert subscription is not None
        assert subscription.subscription_plan_code == "growth"
        assert subscription.billing_cycle == "yearly"
        assert subscription.seats_purchased == 12

        invoice = (
            db.query(BillingInvoice)
            .filter(BillingInvoice.tenant_id == tenant_id)
            .first()
        )
        assert invoice is not None
        assert invoice.provider_invoice_id == f"inv-retry-{tenant_id}"
        assert float(invoice.total_amount) == 120
    finally:
        db.close()


def test_update_tenant_forbids_platform_support(client):
    _create_user(
        "tenant-governance-super-seed@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    super_token = _login(
        client, "tenant-governance-super-seed@procureflow.dev", "Super123!"
    )
    create_response = client.post(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "legal_name": "Governance Protected Tenant",
            "brand_name": "Governance Protected",
        },
    )
    assert create_response.status_code == 200, create_response.text
    tenant_id = create_response.json()["id"]

    _create_user(
        "tenant-governance-support-update@procureflow.dev",
        "Support123!",
        role="user",
        system_role="platform_support",
    )
    token = _login(
        client,
        "tenant-governance-support-update@procureflow.dev",
        "Support123!",
    )

    update_response = client.put(
        f"/api/v1/admin/tenants/{tenant_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"status": "paused", "is_active": False},
    )

    assert update_response.status_code == 403
    assert "Sadece super admin" in update_response.json()["detail"]


def test_update_tenant_forbids_tenant_admin(client):
    _create_user(
        "tenant-governance-super-seed-tenant-admin@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    super_token = _login(
        client, "tenant-governance-super-seed-tenant-admin@procureflow.dev", "Super123!"
    )
    create_response = client.post(
        "/api/v1/admin/tenants",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "legal_name": "Governance Tenant Admin Protected Tenant",
            "brand_name": "Governance Tenant Admin Protected",
        },
    )
    assert create_response.status_code == 200, create_response.text
    tenant_id = create_response.json()["id"]

    _create_user(
        "tenant-governance-tenant-admin-update@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
    )
    token = _login(
        client,
        "tenant-governance-tenant-admin-update@procureflow.dev",
        "Admin123!",
    )

    update_response = client.put(
        f"/api/v1/admin/tenants/{tenant_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"status": "paused", "is_active": False},
    )

    assert update_response.status_code == 403
    assert "Sadece super admin" in update_response.json()["detail"]
