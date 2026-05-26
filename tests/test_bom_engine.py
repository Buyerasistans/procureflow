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
    assert any(item["material"] == "Zemin seramiği" for item in bom)


def test_bom_engine_maps_real_project_wall_layers_to_template_recipe():
    metadata = {
        "katmanlar": [
            {"layer_name": "ALD_Duvar", "total_length": 190.25, "unit": "mt"},
            {"layer_name": "ALD_Görünüş", "total_length": 62.36, "unit": "mt"},
            {"layer_name": "Olcu", "total_length": 10.81, "unit": "mt"},
        ]
    }

    bom = generate_bom_from_metadata(metadata)

    assert bom
    assert {item["source_layer"] for item in bom} == {"ALD_Duvar"}
    assert any(item["material"] == "Astar" for item in bom)
    assert any(item["material"] == "İç cephe boyası" for item in bom)
