"""
Tests for Quote domain concurrency control and domain events.
"""

import pytest


def test_quote_version_increments_on_transition(
    client, setup_test_db, admin_auth_headers, quote_payload
):
    """Verify that version field increments when transitioning"""
    # 1. Create quote
    create_response = client.post(
        "/api/v1/quotes/",
        json=quote_payload("Test Quote"),
        headers=admin_auth_headers,
    )
    assert create_response.status_code == 201
    quote_id = create_response.json()["id"]

    # Initial version should be 1
    get_response = client.get(f"/api/v1/quotes/{quote_id}", headers=admin_auth_headers)
    assert get_response.status_code == 200
    initial_version = get_response.json()["version"]
    assert initial_version == 1

    # 2. Submit quote (transition)
    submit_response = client.post(
        f"/api/v1/quotes/{quote_id}/submit", headers=admin_auth_headers
    )
    assert submit_response.status_code == 200

    # Version should increment to 2
    submitted_quote = submit_response.json()
    assert submitted_quote["version"] == 2
    assert submitted_quote["status"] == "submitted"


def test_domain_event_emitted_on_transition(
    client, setup_test_db, admin_auth_headers, quote_payload
):
    """Verify that domain event is emitted when transitioning"""
    # Clear previous events
    clear_response = client.post(
        "/api/v1/quotes/internal/events/clear", headers=admin_auth_headers
    )
    assert clear_response.status_code == 200

    # Create quote
    create_response = client.post(
        "/api/v1/quotes/",
        json=quote_payload("Event Test Quote"),
        headers=admin_auth_headers,
    )
    assert create_response.status_code == 201
    quote_id = create_response.json()["id"]

    # Submit quote
    submit_response = client.post(
        f"/api/v1/quotes/{quote_id}/submit",
        headers=admin_auth_headers,
    )
    assert submit_response.status_code == 200

    # Check events
    events_response = client.get(
        "/api/v1/quotes/internal/events", headers=admin_auth_headers
    )
    assert events_response.status_code == 200
    events = events_response.json()

    # Should have at least 1 event
    assert events["count"] >= 1, f"Expected events, got: {events}"


def test_transition_reason_stored(
    client, setup_test_db, admin_auth_headers, quote_payload
):
    """Verify that transition reason is stored in quote"""
    create_response = client.post(
        "/api/v1/quotes/",
        json=quote_payload("Reason Test Quote"),
        headers=admin_auth_headers,
    )
    assert create_response.status_code == 201
    quote_id = create_response.json()["id"]

    # Submit quote (should store reason)
    submit_response = client.post(
        f"/api/v1/quotes/{quote_id}/submit", headers=admin_auth_headers
    )
    assert submit_response.status_code == 200

    quote_after = submit_response.json()
    assert quote_after["transition_reason"] == "User submitted quote"
