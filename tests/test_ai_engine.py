from __future__ import annotations

import pytest

from api.services.ai_engine import AIKesifAsistani


@pytest.mark.asyncio
async def test_ai_engine_returns_fallback_report_without_openai_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    assistant = AIKesifAsistani()
    result = await assistant.analiz_et(
        {
            "katmanlar": [
                {"layer_name": "PF_DUVAR_ISLAK", "total_length": 12.5, "unit": "mt"},
            ],
            "bloklar": [],
        }
    )

    assert "teknik_analiz" in result
    assert result["karar_destek_sorulari"]
    assert any("yali" in item["kalem"].lower() for item in result["recete_onerileri"])
