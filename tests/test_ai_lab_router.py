from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path

import pytest

from api.database import SessionLocal
from api.models import (
    DiscoveryLabAnswerAudit,
    DiscoveryLabEvent,
    DiscoveryLabSession,
    Project,
    Quote,
    QuoteItem,
)
from api.services.cad_convert import can_convert_dwg
from api.services import extractor as extractor_module

pytestmark = pytest.mark.nodrop


def test_ai_lab_rejects_invalid_extension(client, admin_auth_headers):
    response = client.post(
        "/api/v1/ai-lab/analyze",
        files={"file": ("kesif.txt", BytesIO(b"not-a-cad"), "text/plain")},
        headers=admin_auth_headers,
    )

    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["code"] == "UNSUPPORTED_CAD_EXTENSION"
    assert detail["message"] == "Yalnızca .dwg veya .dxf dosyaları desteklenir."
    assert detail["request_id"]


def test_can_convert_dwg_reports_missing_converter_without_name_error(monkeypatch):
    monkeypatch.delenv("DWG_TO_DXF_CONVERTER_PATH", raising=False)
    monkeypatch.delenv("ODA_CONVERTER_PATH", raising=False)
    monkeypatch.setattr("api.services.cad_convert.shutil.which", lambda _: None)
    monkeypatch.setattr(
        "api.services.cad_convert._iter_default_converter_candidates", lambda: []
    )

    ok, reason = can_convert_dwg()

    assert ok is False
    assert "_resolve_oda_executable" not in reason
    assert "DWG dönüştürme aracı bulunamadı" in reason


def test_ai_lab_dwg_converter_missing_returns_sanitized_error(
    client, monkeypatch, admin_auth_headers
):
    monkeypatch.setattr(
        "api.routers.ai_lab.can_convert_dwg",
        lambda: (False, "name '_resolve_oda_executable' is not defined"),
    )

    response = client.post(
        "/api/v1/ai-lab/analyze",
        files={
            "file": (
                "test-plan.dwg",
                BytesIO(b"DWG"),
                "application/acad",
            )
        },
        headers=admin_auth_headers,
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["code"] == "DWG_CONVERTER_UNAVAILABLE"
    assert "_resolve_oda_executable" not in detail["message"]
    assert "Lütfen dosyayı DXF olarak yükleyin" in detail["message"]
    assert detail["request_id"]


def test_ai_lab_converter_health_returns_safe_diagnostics(
    client, monkeypatch, admin_auth_headers
):
    monkeypatch.delenv("DWG_TO_DXF_CONVERTER_PATH", raising=False)
    monkeypatch.delenv("ODA_CONVERTER_PATH", raising=False)
    monkeypatch.setattr("api.services.cad_convert.shutil.which", lambda _: None)
    monkeypatch.setattr(
        "api.services.cad_convert._iter_default_converter_candidates", lambda: []
    )

    response = client.get(
        "/api/v1/ai-lab/health/converter", headers=admin_auth_headers
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload == {
        "converter_found": False,
        "resolver_source": "unavailable",
        "executable_name": None,
        "request_id": payload["request_id"],
    }
    assert payload["request_id"]


def test_ai_lab_converter_health_detects_default_install_candidate(
    client, monkeypatch, admin_auth_headers
):
    candidate = Path(__file__).resolve()
    monkeypatch.delenv("DWG_TO_DXF_CONVERTER_PATH", raising=False)
    monkeypatch.delenv("ODA_CONVERTER_PATH", raising=False)
    monkeypatch.setattr("api.services.cad_convert.shutil.which", lambda _: None)
    monkeypatch.setattr(
        "api.services.cad_convert._iter_default_converter_candidates",
        lambda: [candidate],
    )

    response = client.get(
        "/api/v1/ai-lab/health/converter", headers=admin_auth_headers
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload == {
        "converter_found": True,
        "resolver_source": "default_install:ODA",
        "executable_name": candidate.name,
        "request_id": payload["request_id"],
    }
    assert payload["request_id"]


def test_ai_lab_returns_analysis_payload_with_fallback_ai_report(
    client, monkeypatch, admin_auth_headers
):
    metadata = {
        "proje_ozet": {
            "kaynak_dosya": "test-plan.dxf",
            "pf_katman_sayisi": 2,
            "pf_blok_sayisi": 1,
            "minha_adedi": 0,
        },
        "katmanlar": [
            {
                "layer_name": "PF_DUVAR_ISLAK",
                "total_length": 45.2,
                "unit": "mt",
                "entity_count": 3,
            },
            {
                "layer_name": "PF_TAVAN",
                "total_length": 18.0,
                "unit": "mt",
                "entity_count": 2,
            },
        ],
        "bloklar": [{"block_name": "PF_KAPI_90", "count": 1, "unit": "adet"}],
        "minha_elemanlari": [],
    }

    monkeypatch.setattr(
        extractor_module.DWGExtractor, "extract_metadata", lambda self: metadata
    )

    response = client.post(
        "/api/v1/ai-lab/analyze",
        files={
            "file": (
                "test-plan.dxf",
                BytesIO(b"0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n"),
                "application/dxf",
            )
        },
        headers=admin_auth_headers,
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["metadata"]["proje_ozet"]["pf_katman_sayisi"] == 2
    assert payload["metadata"]["katmanlar"][0]["layer_name"] == "PF_DUVAR_ISLAK"
    assert "karar_destek_sorulari" in payload["ai_report"]
    assert payload["ai_report"]["karar_destek_sorulari"]
    assert "bom" in payload
    assert payload["bom"]
    assert payload["session_id"]


def test_ai_lab_logs_bom_selection_decision_and_confirm_transfer(
    client, monkeypatch, admin_auth_headers
):
    metadata = {
        "proje_ozet": {
            "kaynak_dosya": "test-plan.dxf",
            "pf_katman_sayisi": 1,
            "pf_blok_sayisi": 0,
            "minha_adedi": 0,
        },
        "katmanlar": [
            {
                "layer_name": "PF_DUVAR_ISLAK",
                "total_length": 45.2,
                "unit": "mt",
                "entity_count": 3,
            },
        ],
        "bloklar": [],
        "minha_elemanlari": [],
    }

    monkeypatch.setattr(
        extractor_module.DWGExtractor, "extract_metadata", lambda self: metadata
    )

    analyze_response = client.post(
        "/api/v1/ai-lab/analyze",
        files={
            "file": (
                "test-plan.dxf",
                BytesIO(b"0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n"),
                "application/dxf",
            )
        },
        headers=admin_auth_headers,
    )
    assert analyze_response.status_code == 200, analyze_response.text
    analyze_payload = analyze_response.json()
    session_id = analyze_payload["session_id"]

    select_response = client.post(
        "/api/v1/ai-lab/bom-selection",
        json={
            "session_id": session_id,
            "item_key": "PF_DUVAR_ISLAK-Su yalitimi harci-0",
            "selected": False,
        },
        headers=admin_auth_headers,
    )
    assert select_response.status_code == 200, select_response.text

    decision_response = client.post(
        "/api/v1/ai-lab/decision",
        json={"session_id": session_id, "question_id": 1, "decision": "approved"},
        headers=admin_auth_headers,
    )
    assert decision_response.status_code == 200, decision_response.text

    db = SessionLocal()
    try:
        project_row = (
            db.query(Project)
            .filter(Project.is_active.is_(True))
            .order_by(Project.id.asc())
            .first()
        )
        assert project_row is not None
        project_id = project_row.id
    finally:
        db.close()

    confirm_response = client.post(
        "/api/v1/ai-lab/confirm",
        json={
            "session_id": session_id,
            "project_id": project_id,
            "selected_bom_item_keys": [],
        },
        headers=admin_auth_headers,
    )
    assert confirm_response.status_code == 200, confirm_response.text
    confirm_payload = confirm_response.json()
    assert confirm_payload["transfer"]["status"] == "queued_for_procurement"
    assert confirm_payload["transfer"]["approved_questions"] == ["question:1"]
    assert confirm_payload["transfer"]["quote_id"] > 0

    timeline_response = client.get(
        f"/api/v1/ai-lab/{session_id}/timeline", headers=admin_auth_headers
    )
    assert timeline_response.status_code == 200, timeline_response.text
    timeline_payload = timeline_response.json()
    assert timeline_payload["quote_id"] == confirm_payload["transfer"]["quote_id"]
    assert len(timeline_payload["timeline"]) == 4
    assert timeline_payload["timeline"][0]["type"] == "analysis_created"
    assert timeline_payload["timeline"][-1]["actor"] == "Admin User"

    admin_sessions_response = client.get(
        "/api/v1/ai-lab/admin/sessions", headers=admin_auth_headers
    )
    assert admin_sessions_response.status_code == 403, admin_sessions_response.text

    db = SessionLocal()
    try:
        session_row = (
            db.query(DiscoveryLabSession)
            .filter(DiscoveryLabSession.session_id == session_id)
            .first()
        )
        assert session_row is not None
        assert session_row.status == "technical_locked"
        assert (
            session_row.procurement_quote_id == confirm_payload["transfer"]["quote_id"]
        )
        procurement_payload = json.loads(session_row.procurement_payload_json or "{}")
        assert procurement_payload["transfer_id"].startswith("DL-")

        quote_row = (
            db.query(Quote).filter(Quote.id == session_row.procurement_quote_id).first()
        )
        assert quote_row is not None
        assert quote_row.title.startswith("Discovery Lab RFQ -")

        quote_items = (
            db.query(QuoteItem).filter(QuoteItem.quote_id == quote_row.id).all()
        )
        assert quote_items == []

        event_rows = (
            db.query(DiscoveryLabEvent)
            .filter(DiscoveryLabEvent.session_ref_id == session_row.id)
            .order_by(DiscoveryLabEvent.id.asc())
            .all()
        )
        assert [row.event_type for row in event_rows] == [
            "analysis_created",
            "bom_selection",
            "ai_decision",
            "technical_lock",
        ]
    finally:
        db.close()


def test_ai_lab_session_mutations_and_timeline_reject_unrelated_user(
    client, monkeypatch, admin_auth_headers, other_user_auth_headers
):
    metadata = {
        "proje_ozet": {
            "kaynak_dosya": "guard-test.dxf",
            "pf_katman_sayisi": 1,
            "pf_blok_sayisi": 0,
            "minha_adedi": 0,
        },
        "katmanlar": [
            {
                "layer_name": "PF_DUVAR",
                "total_length": 12.0,
                "unit": "mt",
                "entity_count": 1,
            }
        ],
        "bloklar": [],
        "minha_elemanlari": [],
    }

    monkeypatch.setattr(
        extractor_module.DWGExtractor, "extract_metadata", lambda self: metadata
    )

    analyze_response = client.post(
        "/api/v1/ai-lab/analyze",
        files={
            "file": (
                "guard-test.dxf",
                BytesIO(b"0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n"),
                "application/dxf",
            )
        },
        headers=admin_auth_headers,
    )
    assert analyze_response.status_code == 200, analyze_response.text
    session_id = analyze_response.json()["session_id"]

    mutation_attempts = [
        (
            "/api/v1/ai-lab/bom-selection",
            {"session_id": session_id, "item_key": "PF_DUVAR-Duvar-0", "selected": False},
        ),
        (
            "/api/v1/ai-lab/decision",
            {"session_id": session_id, "question_id": 1, "decision": "approved"},
        ),
        (
            "/api/v1/ai-lab/answer",
            {
                "session_id": session_id,
                "question_id": 1,
                "answer_text": "Kontrol edilecek.",
            },
        ),
    ]

    for url, payload in mutation_attempts:
        response = client.post(url, json=payload, headers=other_user_auth_headers)
        assert response.status_code == 403, response.text

    timeline_response = client.get(
        f"/api/v1/ai-lab/{session_id}/timeline", headers=other_user_auth_headers
    )
    assert timeline_response.status_code == 403, timeline_response.text


def test_ai_lab_persists_user_answer_audit_and_timeline(
    client, monkeypatch, admin_auth_headers
):
    metadata = {
        "proje_ozet": {
            "kaynak_dosya": "answer-test.dxf",
            "pf_katman_sayisi": 1,
            "pf_blok_sayisi": 0,
            "minha_adedi": 0,
        },
        "katmanlar": [
            {
                "layer_name": "PF_DUVAR",
                "total_length": 12.0,
                "unit": "mt",
                "entity_count": 1,
            }
        ],
        "bloklar": [],
        "minha_elemanlari": [],
    }

    monkeypatch.setattr(
        extractor_module.DWGExtractor, "extract_metadata", lambda self: metadata
    )

    analyze_response = client.post(
        "/api/v1/ai-lab/analyze",
        files={
            "file": (
                "answer-test.dxf",
                BytesIO(b"0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n"),
                "application/dxf",
            )
        },
        headers=admin_auth_headers,
    )
    assert analyze_response.status_code == 200, analyze_response.text
    session_id = analyze_response.json()["session_id"]

    answer_response = client.post(
        "/api/v1/ai-lab/answer",
        json={
            "session_id": session_id,
            "question_id": 7,
            "question_text": "Kapı detayı otomatik tamamlansın mı?",
            "answer_text": "Evet, standart kapı reçetesi eklensin.",
            "decision": "needs_review",
            "rationale": "Islak hacim ile çakışan bölümler ayrıca kontrol edilecek.",
        },
        headers=admin_auth_headers,
    )
    assert answer_response.status_code == 200, answer_response.text

    timeline_response = client.get(
        f"/api/v1/ai-lab/{session_id}/timeline", headers=admin_auth_headers
    )
    assert timeline_response.status_code == 200, timeline_response.text
    timeline = timeline_response.json()["timeline"]
    assert [row["type"] for row in timeline] == ["analysis_created", "user_answer"]
    assert (
        timeline[-1]["details"]["answer_text"]
        == "Evet, standart kapı reçetesi eklensin."
    )
    assert timeline[-1]["details"]["decision"] == "needs_review"

    db = SessionLocal()
    try:
        session_row = (
            db.query(DiscoveryLabSession)
            .filter(DiscoveryLabSession.session_id == session_id)
            .first()
        )
        assert session_row is not None

        answer_audit = (
            db.query(DiscoveryLabAnswerAudit)
            .filter(DiscoveryLabAnswerAudit.session_ref_id == session_row.id)
            .order_by(DiscoveryLabAnswerAudit.id.desc())
            .first()
        )
        assert answer_audit is not None
        assert answer_audit.question_id == 7
        assert answer_audit.decision == "needs_review"
        assert answer_audit.created_by_email == "admin@procureflow.dev"
        assert "standart kapı reçetesi" in answer_audit.answer_text
    finally:
        db.close()
