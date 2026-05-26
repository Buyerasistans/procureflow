from __future__ import annotations

import unicodedata
from typing import Any

from api.models.bom import Recipe, RecipeItem


FALLBACK_RECIPE_LIBRARY: dict[str, list[dict[str, Any]]] = {
    "PF_DUVAR": [
        {
            "material_name": "Alçı panel",
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
        {
            "material_name": "Astar",
            "consumption_rate": 0.12,
            "unit": "lt",
            "multiplier": 3.0,
        },
        {
            "material_name": "İç cephe boyası",
            "consumption_rate": 0.18,
            "unit": "lt",
            "multiplier": 3.0,
        },
    ],
    "PF_DUVAR_ISLAK": [
        {
            "material_name": "Su yalıtımı harcı",
            "consumption_rate": 2.5,
            "unit": "kg",
            "multiplier": 3.0,
        },
        {
            "material_name": "Seramik yapıştırıcı",
            "consumption_rate": 4.0,
            "unit": "kg",
            "multiplier": 3.0,
        },
    ],
    "PF_ZEMIN_SERAMIK": [
        {
            "material_name": "Zemin seramiği",
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


TECHNICAL_LAYER_TOKENS = {
    "AKS",
    "AXIS",
    "DIM",
    "GORUNUS",
    "GÖRÜNÜŞ",
    "NOT",
    "OLCU",
    "ÖLÇÜ",
    "OBJ",
    "PDF",
    "LOGO",
    "NOT_C",
    "NOTC",
    "TEXT",
    "YAZI",
}

LAYER_RECIPE_ALIASES: tuple[tuple[tuple[str, ...], str], ...] = (
    (("ALCIPAN", "ALÇIPAN", "KARTONPIYER"), "PF_DUVAR"),
    (("DUVAR", "WALL"), "PF_DUVAR"),
    (("ISLAK", "BANYO", "WC"), "PF_DUVAR_ISLAK"),
    (("ZEMIN_SERAMIK", "SERAMIK", "FAYANS"), "PF_ZEMIN_SERAMIK"),
)

DIRECT_LAYER_RULES: tuple[tuple[tuple[str, ...], str, str, str], ...] = (
    (("PIRIZ", "PRIZ", "ANAHTAR", "SWITCH"), "Elektrik İşleri", "Adetli elektrik ekipmanı", "adet"),
    (("ELEKTRIK_TAVA", "TAVA_HATTI", "KABLO_TAVA"), "Elektrik İşleri", "Elektrik tava hattı", "mt"),
    (("ELEKTRIK_KANAL", "KABLO_KANAL"), "Elektrik İşleri", "Elektrik kanal hattı", "mt"),
    (("DOGRAM", "DOĞRAM"), "Doğrama İşleri", "Doğrama imalatı", "mt"),
    (("DOLAP", "MOBILYA", "MOBİLYA"), "Mobilya İşleri", "Mobilya imalatı", "adet"),
    (("DEMIR", "DEMİR", "METAL", "PROFIL", "PROFİL"), "Metal İşleri", "Metal/profil imalatı", "mt"),
    (("CAM", "PLEKSI", "PLEKSİ"), "Cam ve Pleksi İşleri", "Cam/pleksi imalatı", "m2"),
)


def _normalize_layer_name(layer_name: str) -> str:
    ascii_name = (
        unicodedata.normalize("NFKD", layer_name)
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    return ascii_name.upper().replace("-", "_").replace(" ", "_")


def _is_technical_layer(layer_name: str) -> bool:
    normalized = _normalize_layer_name(layer_name)
    return any(token in normalized for token in TECHNICAL_LAYER_TOKENS)


def _select_fallback_recipe(layer_name: str) -> list[dict[str, Any]]:
    normalized = _normalize_layer_name(layer_name)
    for key, recipe in FALLBACK_RECIPE_LIBRARY.items():
        if normalized.startswith(key):
            return recipe
    if _is_technical_layer(layer_name):
        return []
    for tokens, recipe_key in LAYER_RECIPE_ALIASES:
        if any(token in normalized for token in tokens):
            return FALLBACK_RECIPE_LIBRARY[recipe_key]
    return []


def _resolve_direct_layer_rule(layer_name: str) -> tuple[str, str, str] | None:
    normalized = _normalize_layer_name(layer_name)
    if _is_technical_layer(layer_name):
        return None
    for tokens, group_name, material_name, unit in DIRECT_LAYER_RULES:
        if any(token in normalized for token in tokens):
            return group_name, material_name, unit
    return None


def _quantity_for_direct_layer(layer: dict[str, Any], unit: str) -> float:
    if unit == "adet":
        return float(
            layer.get("entity_count")
            or layer.get("count")
            or layer.get("block_count")
            or 1
        )
    return float(layer.get("net_length") or layer.get("total_length") or 0)


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
                    "group_name": "Alçıpan İşleri",
                    "group_key": "alcipan-isleri",
                }
            )

        if recipe_items:
            continue

        direct_rule = _resolve_direct_layer_rule(layer_name)
        if not direct_rule:
            continue
        group_name, material_name, unit = direct_rule
        quantity = _quantity_for_direct_layer(layer, unit)
        if quantity <= 0:
            continue
        final_bom.append(
            {
                "material": material_name,
                "quantity": round(quantity, 2),
                "unit": unit,
                "source_layer": layer_name,
                "group_name": group_name,
                "group_key": _normalize_layer_name(group_name).lower().replace("_", "-"),
            }
        )

    return final_bom
