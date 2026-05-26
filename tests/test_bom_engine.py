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
    assert {item["group_name"] for item in bom} == {"Alçıpan İşleri"}


def test_bom_engine_creates_direct_grouped_items_with_domain_units():
    metadata = {
        "katmanlar": [
            {"layer_name": "PIRIZLER", "total_length": 32.07, "entity_count": 8, "unit": "mt"},
            {"layer_name": "Switch", "total_length": 107.33, "entity_count": 14, "unit": "mt"},
            {"layer_name": "ELEKTRIK TAVA HATTI", "total_length": 51.27, "entity_count": 3, "unit": "mt"},
            {"layer_name": "Bereket Döner Logo", "total_length": 14031.85, "entity_count": 1, "unit": "mt"},
            {"layer_name": "OBJ", "total_length": 4.63, "entity_count": 2, "unit": "mt"},
        ]
    }

    bom = generate_bom_from_metadata(metadata)

    assert {item["source_layer"] for item in bom} == {"PIRIZLER", "Switch", "ELEKTRIK TAVA HATTI"}
    assert all(item["group_name"] == "Elektrik İşleri" for item in bom)
    assert any(item["source_layer"] == "PIRIZLER" and item["quantity"] == 8 and item["unit"] == "adet" for item in bom)
    assert any(item["source_layer"] == "Switch" and item["quantity"] == 14 and item["unit"] == "adet" for item in bom)
    assert any(item["source_layer"] == "ELEKTRIK TAVA HATTI" and item["quantity"] == 51.27 and item["unit"] == "mt" for item in bom)
