from api.models.quote import Quote


def test_quote_model_exposes_rfq_transition_helpers():
    quote = Quote(
        id=12,
        user_id=5,
        created_by_id=7,
        project_id=3,
        title="Transition Quote",
        company_name="ACME",
        company_contact_name="Buyer",
        company_contact_phone="5550000000",
        company_contact_email="buyer@test.dev",
        amount=100,
        total_amount=125,
    )

    assert quote.rfq_id == 12
    assert quote.canonical_created_by_id == 7
    assert quote.canonical_total_amount == 125
    assert quote.company_snapshot == {
        "company_name": "ACME",
        "company_contact_name": "Buyer",
        "company_contact_phone": "5550000000",
        "company_contact_email": "buyer@test.dev",
    }


def test_quote_model_declares_legacy_and_snapshot_columns():
    assert "user_id" in Quote.LEGACY_MIRROR_COLUMNS
    assert "amount" in Quote.LEGACY_MIRROR_COLUMNS
    assert "company_name" in Quote.SNAPSHOT_COLUMNS
    assert "company_contact_email" in Quote.SNAPSHOT_COLUMNS
