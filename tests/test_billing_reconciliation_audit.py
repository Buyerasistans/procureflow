from api.scripts.audit_billing_reconciliation import (
    _collect_invoice_issues,
    _collect_section_report,
    _collect_subscription_issues,
    _collect_webhook_issues,
)


def test_collect_subscription_issues_detects_missing_tenant_and_plan_mismatch():
    row = {
        "id": 1,
        "tenant_id": None,
        "subscription_plan_code": "growth",
        "tenant_plan_code": "starter",
    }

    issues = _collect_subscription_issues(row)

    assert "subscription_missing_tenant" in issues
    assert "subscription_tenant_plan_mismatch" in issues


def test_collect_invoice_issues_detects_missing_subscription_and_tenant_drift():
    row = {
        "id": 11,
        "tenant_id": 2,
        "tenant_subscription_id": 6,
        "subscription_tenant_id": 4,
    }

    issues = _collect_invoice_issues(row)

    assert "invoice_subscription_tenant_mismatch" in issues
    assert "invoice_missing_subscription" not in issues


def test_collect_webhook_issues_detects_failed_event_without_error_message():
    row = {
        "id": 21,
        "tenant_id": 3,
        "tenant_subscription_id": 9,
        "subscription_tenant_id": 3,
        "provider_event_id": "",
        "processing_status": "failed",
        "error_message": "",
    }

    issues = _collect_webhook_issues(row)

    assert "webhook_missing_provider_event_id" in issues
    assert "webhook_failed_without_error_message" in issues


def test_collect_section_report_counts_problem_rows_and_issue_distribution():
    rows = [
        {
            "id": 1,
            "tenant_id": None,
            "subscription_plan_code": "starter",
            "tenant_plan_code": "starter",
        },
        {
            "id": 2,
            "tenant_id": 7,
            "subscription_plan_code": "growth",
            "tenant_plan_code": "starter",
        },
    ]

    report = _collect_section_report(
        rows,
        _collect_subscription_issues,
        section_name="tenant_subscriptions",
    )

    assert report["total_rows"] == 2
    assert report["problem_rows"] == 2
    assert report["issue_counts"]["subscription_missing_tenant"] == 1
    assert report["issue_counts"]["subscription_tenant_plan_mismatch"] == 1
    assert len(report["samples"]) == 2
