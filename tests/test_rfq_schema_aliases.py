from api.schemas.quote import (
    QuoteApprovalOut,
    QuoteItemOut,
    QuoteOut,
    RfqCreate,
    RfqOut,
)


def test_quote_out_exposes_rfq_id_alias() -> None:
    payload = QuoteOut(
        id=42,
        project_id=7,
        created_by_id=9,
        title="Schema Alias Quote",
        status="draft",
        company_name="ACME",
        company_contact_name="Contact",
        company_contact_phone="5551112233",
        company_contact_email="contact@test.dev",
        total_amount=0,
        currency="TRY",
        is_active=True,
        created_at="2026-04-15T10:00:00Z",
        items=[
            QuoteItemOut(
                id=3,
                quote_id=42,
                line_number="1.1",
                category_code="GEN",
                category_name="Genel",
                description="Kalem",
                unit="adet",
                quantity=1,
                sequence=0,
            )
        ],
    )

    dumped = payload.model_dump()

    assert dumped["rfq_id"] == 42
    assert dumped["items"][0]["rfq_id"] == 42


def test_quote_approval_out_exposes_rfq_id_alias() -> None:
    payload = QuoteApprovalOut(
        id=1,
        quote_id=42,
        approval_level=1,
        status="beklemede",
        requested_at="2026-04-15T10:00:00Z",
    )

    assert payload.model_dump()["rfq_id"] == 42


def test_rfq_alias_types_match_quote_contract() -> None:
    create_payload = RfqCreate(
        project_id=7,
        title="RFQ Alias",
        company_name="ACME",
        company_contact_name="Contact",
        company_contact_phone="5551112233",
        company_contact_email="contact@test.dev",
    )
    output_payload = RfqOut(
        id=12,
        project_id=7,
        created_by_id=9,
        title="RFQ Alias",
        status="draft",
        company_name="ACME",
        company_contact_name="Contact",
        company_contact_phone="5551112233",
        company_contact_email="contact@test.dev",
        total_amount=0,
        currency="TRY",
        is_active=True,
        created_at="2026-04-15T10:00:00Z",
    )

    assert create_payload.project_id == 7
    assert output_payload.model_dump()["rfq_id"] == 12
