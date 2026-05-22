from api.scripts.audit_quote_rfq_legacy_cleanup import (
    _build_quote_fix_preview,
    _collect_quote_issues,
)


def test_collect_quote_issues_flags_legacy_mirror_and_snapshot_drift():
    row = {
        "id": 8,
        "tenant_id": 4,
        "project_id": 6,
        "project_tenant_id": 4,
        "user_id": 11,
        "created_by_id": 12,
        "amount": 100,
        "total_amount": 130,
        "company_name": "",
        "company_contact_name": "Buyer",
        "company_contact_phone": None,
        "company_contact_email": "buyer@test.dev",
    }

    issues = _collect_quote_issues(row)

    assert "quote_created_by_mirror_mismatch" in issues
    assert "quote_total_amount_mirror_mismatch" in issues
    assert "quote_missing_company_snapshot" in issues


def test_build_quote_fix_preview_prefers_canonical_fields_for_safe_fix():
    preview = _build_quote_fix_preview(
        [
            {
                "id": 9,
                "tenant_id": 3,
                "project_id": 2,
                "project_tenant_id": 3,
                "user_id": 5,
                "created_by_id": 7,
                "amount": 90,
                "total_amount": 120,
                "company_name": "ACME",
                "company_contact_name": "Buyer",
                "company_contact_phone": "5550000000",
                "company_contact_email": "buyer@test.dev",
            }
        ]
    )

    assert preview["preview_rows"] == 1
    assert preview["fix_type_counts"]["sync_user_id_from_created_by_id"] == 1
    assert preview["fix_type_counts"]["sync_amount_from_total_amount"] == 1
    sample = preview["samples"][0]
    assert sample["new_user_id"] == 7
    assert sample["new_amount"] == 120
