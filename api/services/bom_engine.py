from __future__ import annotations

from typing import Any

from api.models.bom import Recipe, RecipeItem


FALLBACK_RECIPE_LIBRARY: dict[str, list[dict[str, Any]]] = {
    "PF_DUVAR": [
        {
            "material_name": "Alci panel",
            "consumption_rate": 1.0,
            "unit": "m2",
            "multiplier": 3.0,
        },
        {
            "material_name": "Metal profil",
            "consumption_rate": 1.8,
            "unit": "mt",
            "multiplier": 1.0,
        },
        {
            "material_name": "Derz dolgu",
            "consumption_rate": 0.35,
            "unit": "kg",
            "multiplier": 3.0,
        },
    ],
    "PF_DUVAR_ISLAK": [
        {
            "material_name": "Su yalitimi harci",
            "consumption_rate": 2.5,
            "unit": "kg",
            "multiplier": 3.0,
        },
        {
            "material_name": "Seramik yapistirici",
            "consumption_rate": 4.0,
            "unit": "kg",
            "multiplier": 3.0,
        },
    ],
    "PF_ZEMIN_SERAMIK": [
        {
            "material_name": "Zemin seramigi",
            "consumption_rate": 1.05,
            "unit": "m2",
            "multiplier": 1.0,
        },
        {
            "material_name": "Derz dolgusu",
            "consumption_rate": 0.45,
            "unit": "kg",
            "multiplier": 1.0,
        },
    ],
}


def _select_fallback_recipe(layer_name: str) -> list[dict[str, Any]]:
    normalized = layer_name.upper()
    for key, recipe in FALLBACK_RECIPE_LIBRARY.items():
        if normalized.startswith(key):
            return recipe
    return []


def _load_recipe_items_from_db(db: Any, layer_name: str) -> list[dict[str, Any]]:
    recipe = db.query(Recipe).filter(Recipe.layer_name == layer_name).first()
    if not recipe:
        return []

    items = db.query(RecipeItem).filter(RecipeItem.recipe_id == recipe.id).all()
    return [
        {
            "material_name": item.material_name,
            "consumption_rate": float(item.consumption_rate),
            "unit": item.unit,
            "multiplier": 3.0 if item.unit == "m2" else 1.0,
        }
        for item in items
    ]


def generate_bom_from_metadata(
    metadata: dict[str, Any], db: Any | None = None
) -> list[dict[str, Any]]:
    final_bom: list[dict[str, Any]] = []

    for layer in metadata.get("katmanlar") or []:
        layer_name = str(layer.get("layer_name") or "")
        if not layer_name:
            continue

        quantity_basis = float(
            layer.get("net_length") or layer.get("total_length") or 0
        )
        if quantity_basis <= 0:
            continue

        recipe_items = (
            _load_recipe_items_from_db(db, layer_name) if db is not None else []
        )
        if not recipe_items:
            recipe_items = _select_fallback_recipe(layer_name)

        for item in recipe_items:
            calculated_quantity = (
                quantity_basis
                * float(item.get("multiplier") or 1.0)
                * float(item["consumption_rate"])
            )
            final_bom.append(
                {
                    "material": item["material_name"],
                    "quantity": round(calculated_quantity, 2),
                    "unit": item["unit"],
                    "source_layer": layer_name,
                }
            )

    return final_bom
