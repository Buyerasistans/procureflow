from __future__ import annotations

from api.services.bom_engine import generate_bom_from_metadata


def test_bom_engine_generates_fallback_recipe_items_from_metadata():
    metadata = {
        "katmanlar": [
            {"layer_name": "PF_DUVAR_ISLAK", "total_length": 10.0, "unit": "mt"},
            {"layer_name": "PF_ZEMIN_SERAMIK", "total_length": 24.0, "unit": "m2"},
        ]
    }

    bom = generate_bom_from_metadata(metadata)

    assert bom
    assert any(item["source_layer"] == "PF_DUVAR_ISLAK" for item in bom)
    assert any(item["material"] == "Zemin seramigi" for item in bom)
