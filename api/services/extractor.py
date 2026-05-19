from __future__ import annotations

from math import cos, hypot, pi, radians, sin
from pathlib import Path
from typing import Any

try:
    import ezdxf
except ImportError:  # pragma: no cover - dependency presence is environment-specific
    ezdxf = None


class DWGExtractor:
    MINHA_BLOCK_WIDTHS = {
        "KAPI_70": 0.7,
        "KAPI_80": 0.8,
        "KAPI_90": 0.9,
        "KAPI_100": 1.0,
        "PEN_120": 1.2,
        "PEN_150": 1.5,
        "PENCERE_120": 1.2,
        "PENCERE_150": 1.5,
    }

    def __init__(self, file_path: str | Path):
        self.file_path = str(file_path)
        self.doc = None
        self.msp = None
        self._block_extent_cache: dict[str, dict[str, float] | None] = {}

    # -------------------------
    # Genel yardımcılar
    # -------------------------
    def _is_supported_extension(self) -> bool:
        return Path(self.file_path).suffix.lower() in {".dxf", ".dwg"}

    def _iter_pf_layers(self) -> list[str]:
        if not self.doc:
            return []
        return [
            str(layer.dxf.name)
            for layer in self.doc.layers
            if str(layer.dxf.name).upper().startswith("PF_")
        ]

    def _iter_target_layers(self) -> list[str]:
        """
        Öncelik PF_ katmanlarında.
        PF_ yoksa modelspace'te entity içeren tüm katmanları fallback olarak döner.
        """
        pf_layers = self._iter_pf_layers()
        if pf_layers:
            return pf_layers

        if not self.msp:
            return []

        layers_with_entities: set[str] = set()
        for entity in self.msp:
            try:
                layer_name = str(getattr(entity.dxf, "layer", "") or "")
                if layer_name:
                    layers_with_entities.add(layer_name)
            except Exception:
                continue

        return sorted(layers_with_entities)

    def _safe_polyline_length(self, polyline: Any) -> float:
        try:
            return float(polyline.length())
        except Exception:
            points = list(polyline.get_points("xy"))
            total = 0.0
            for index in range(1, len(points)):
                x1, y1 = points[index - 1]
                x2, y2 = points[index]
                total += hypot(x2 - x1, y2 - y1)
            return total

    def _update_bounds(
        self, bounds: dict[str, float] | None, x: float, y: float
    ) -> dict[str, float]:
        if bounds is None:
            return {"min_x": x, "max_x": x, "min_y": y, "max_y": y}
        bounds["min_x"] = min(bounds["min_x"], x)
        bounds["max_x"] = max(bounds["max_x"], x)
        bounds["min_y"] = min(bounds["min_y"], y)
        bounds["max_y"] = max(bounds["max_y"], y)
        return bounds

    def _distance_to_bounds(
        self, position: tuple[float, float], bounds: dict[str, float] | None
    ) -> float:
        if not bounds:
            return float("inf")
        x, y = position
        clamped_x = min(max(x, bounds["min_x"]), bounds["max_x"])
        clamped_y = min(max(y, bounds["min_y"]), bounds["max_y"])
        return hypot(x - clamped_x, y - clamped_y)

    # -------------------------
    # Blok extents
    # -------------------------
    def _extract_block_definition_extents(
        self, block_name: str
    ) -> dict[str, float] | None:
        normalized_name = str(block_name or "").upper()
        if normalized_name in self._block_extent_cache:
            return self._block_extent_cache[normalized_name]

        if not self.doc:
            self._block_extent_cache[normalized_name] = None
            return None

        try:
            block_layout = self.doc.blocks.get(block_name)
        except Exception:
            self._block_extent_cache[normalized_name] = None
            return None

        bounds: dict[str, float] | None = None
        try:
            for entity in block_layout:
                entity_type = str(entity.dxftype()).upper()

                if entity_type == "LINE":
                    bounds = self._update_bounds(
                        bounds, float(entity.dxf.start.x), float(entity.dxf.start.y)
                    )
                    bounds = self._update_bounds(
                        bounds, float(entity.dxf.end.x), float(entity.dxf.end.y)
                    )

                elif entity_type == "LWPOLYLINE":
                    for point in entity.get_points("xy"):
                        bounds = self._update_bounds(
                            bounds, float(point[0]), float(point[1])
                        )

                elif entity_type in {"CIRCLE", "ARC"}:
                    center_x = float(entity.dxf.center.x)
                    center_y = float(entity.dxf.center.y)
                    radius = float(entity.dxf.radius)
                    bounds = self._update_bounds(
                        bounds, center_x - radius, center_y - radius
                    )
                    bounds = self._update_bounds(
                        bounds, center_x + radius, center_y + radius
                    )
        except Exception:
            self._block_extent_cache[normalized_name] = None
            return None

        if not bounds:
            self._block_extent_cache[normalized_name] = None
            return None

        extents = {
            "width": round(max((bounds["max_x"] - bounds["min_x"]) / 100, 0.0), 2),
            "height": round(max((bounds["max_y"] - bounds["min_y"]) / 100, 0.0), 2),
        }
        self._block_extent_cache[normalized_name] = extents
        return extents

    # -------------------------
    # Virtual entity analizleri
    # -------------------------
    def _iter_virtual_entity_points(self, entity: Any) -> list[tuple[float, float]]:
        entity_type = str(getattr(entity, "dxftype", lambda: "")()).upper()
        points: list[tuple[float, float]] = []
        try:
            if entity_type == "LINE":
                points.append((float(entity.dxf.start.x), float(entity.dxf.start.y)))
                points.append((float(entity.dxf.end.x), float(entity.dxf.end.y)))

            elif entity_type == "LWPOLYLINE":
                points.extend(
                    (float(point[0]), float(point[1]))
                    for point in entity.get_points("xy")
                )

            elif entity_type in {"CIRCLE", "ARC"}:
                center_x = float(entity.dxf.center.x)
                center_y = float(entity.dxf.center.y)
                radius = float(entity.dxf.radius)

                if entity_type == "CIRCLE":
                    for angle in range(0, 360, 45):
                        a = radians(float(angle))
                        points.append(
                            (center_x + radius * cos(a), center_y + radius * sin(a))
                        )
                else:
                    start_angle = float(getattr(entity.dxf, "start_angle", 0.0) or 0.0)
                    end_angle = float(getattr(entity.dxf, "end_angle", 0.0) or 0.0)
                    sweep = (end_angle - start_angle) % 360.0
                    if sweep == 0:
                        sweep = 360.0
                    step_count = max(int(sweep // 15.0), 2)
                    for step_index in range(step_count + 1):
                        angle = start_angle + (sweep * step_index / step_count)
                        a = radians(angle)
                        points.append(
                            (center_x + radius * cos(a), center_y + radius * sin(a))
                        )

            elif entity_type == "ELLIPSE":
                center_x = float(entity.dxf.center.x)
                center_y = float(entity.dxf.center.y)
                major_axis_x = float(entity.dxf.major_axis.x)
                major_axis_y = float(entity.dxf.major_axis.y)
                ratio = float(getattr(entity.dxf, "ratio", 1.0) or 1.0)
                start_param = float(getattr(entity.dxf, "start_param", 0.0) or 0.0)
                end_param = float(getattr(entity.dxf, "end_param", 2 * pi) or (2 * pi))
                sweep = end_param - start_param
                if abs(sweep) < 1e-6:
                    sweep = 2 * pi

                step_count = max(int(abs(sweep) / (pi / 12)), 8)
                minor_axis_x = -major_axis_y * ratio
                minor_axis_y = major_axis_x * ratio

                for step_index in range(step_count + 1):
                    param = start_param + (sweep * step_index / step_count)
                    points.append(
                        (
                            center_x
                            + major_axis_x * cos(param)
                            + minor_axis_x * sin(param),
                            center_y
                            + major_axis_y * cos(param)
                            + minor_axis_y * sin(param),
                        )
                    )

            elif entity_type == "SPLINE":
                fit_points = list(getattr(entity, "fit_points", []) or [])
                control_points = list(getattr(entity, "control_points", []) or [])
                raw_points = fit_points or control_points
                for point in raw_points:
                    points.append((float(point[0]), float(point[1])))

        except Exception:
            return []

        return points

    def _extract_insert_virtual_opening(
        self, insert: Any
    ) -> dict[str, float | str] | None:
        try:
            virtual_entities = list(insert.virtual_entities())
        except Exception:
            return None

        bounds: dict[str, float] | None = None
        longest_horizontal_segment = 0.0
        longest_vertical_segment = 0.0
        entity_scores: list[tuple[float, float, bool]] = []
        has_linear_geometry = False
        has_curved_geometry = False

        for entity in virtual_entities:
            entity_type = str(getattr(entity, "dxftype", lambda: "")()).upper()
            points = self._iter_virtual_entity_points(entity)
            if not points:
                continue

            entity_bounds: dict[str, float] | None = None
            entity_horizontal_segment = 0.0
            entity_vertical_segment = 0.0
            is_linear_geometry = entity_type in {"LINE", "LWPOLYLINE", "SPLINE"}
            has_linear_geometry = has_linear_geometry or is_linear_geometry
            has_curved_geometry = has_curved_geometry or not is_linear_geometry

            for x, y in points:
                bounds = self._update_bounds(bounds, x, y)
                entity_bounds = self._update_bounds(entity_bounds, x, y)

            for index in range(1, len(points)):
                x1, y1 = points[index - 1]
                x2, y2 = points[index]
                segment_length = hypot(x2 - x1, y2 - y1)
                if abs(y2 - y1) > abs(x2 - x1):
                    longest_vertical_segment = max(
                        longest_vertical_segment, segment_length
                    )
                    entity_vertical_segment = max(
                        entity_vertical_segment, segment_length
                    )
                else:
                    longest_horizontal_segment = max(
                        longest_horizontal_segment, segment_length
                    )
                    entity_horizontal_segment = max(
                        entity_horizontal_segment, segment_length
                    )

            if entity_bounds:
                entity_width = max(
                    (entity_bounds["max_x"] - entity_bounds["min_x"]) / 100, 0.0
                )
                entity_height = max(
                    (entity_bounds["max_y"] - entity_bounds["min_y"]) / 100, 0.0
                )
                entity_scores.append(
                    (
                        max(entity_width, entity_horizontal_segment / 100),
                        max(entity_height, entity_vertical_segment / 100),
                        is_linear_geometry,
                    )
                )

        if not bounds:
            return None

        width = max((bounds["max_x"] - bounds["min_x"]) / 100, 0.0)
        height = max((bounds["max_y"] - bounds["min_y"]) / 100, 0.0)

        horizontal_score = longest_horizontal_segment / 100
        vertical_score = longest_vertical_segment / 100

        for entity_horizontal, entity_vertical, is_linear_geometry in entity_scores:
            weight = 1.0 if (is_linear_geometry or not has_linear_geometry) else 0.7
            horizontal_score = max(horizontal_score, entity_horizontal * weight)
            vertical_score = max(vertical_score, entity_vertical * weight)

        if has_linear_geometry and not has_curved_geometry:
            horizontal_score = max(horizontal_score, width)
            vertical_score = max(vertical_score, height)

        if horizontal_score <= 0:
            horizontal_score = width
        if vertical_score <= 0:
            vertical_score = height

        dominant_orientation = (
            "vertical" if vertical_score > horizontal_score else "horizontal"
        )
        axis_length = (
            vertical_score if dominant_orientation == "vertical" else horizontal_score
        )

        return {
            "orientation": dominant_orientation,
            "axis_length": round(axis_length, 2),
            "width": round(width, 2),
            "height": round(height, 2),
        }

    # -------------------------
    # Katman metrikleri
    # -------------------------
    def _extract_layer_metrics(self, layer_name: str) -> dict[str, float | str] | None:
        if not self.msp:
            return None

        total_length = 0.0
        entity_count = 0
        bounds: dict[str, float] | None = None

        # LINE
        for line in self.msp.query(f'LINE[layer=="{layer_name}"]'):
            try:
                total_length += float(line.dxf.start.distance(line.dxf.end))
                entity_count += 1
                bounds = self._update_bounds(
                    bounds, float(line.dxf.start.x), float(line.dxf.start.y)
                )
                bounds = self._update_bounds(
                    bounds, float(line.dxf.end.x), float(line.dxf.end.y)
                )
            except Exception:
                continue

        # LWPOLYLINE
        for polyline in self.msp.query(f'LWPOLYLINE[layer=="{layer_name}"]'):
            try:
                total_length += self._safe_polyline_length(polyline)
                entity_count += 1
                for point in polyline.get_points("xy"):
                    bounds = self._update_bounds(
                        bounds, float(point[0]), float(point[1])
                    )
            except Exception:
                continue

        # POLYLINE (2D/3D)
        for polyline in self.msp.query(f'POLYLINE[layer=="{layer_name}"]'):
            try:
                if hasattr(polyline, "points"):
                    pts = list(polyline.points())
                    for i in range(1, len(pts)):
                        p1, p2 = pts[i - 1], pts[i]
                        total_length += hypot(
                            float(p2.x) - float(p1.x), float(p2.y) - float(p1.y)
                        )
                    for p in pts:
                        bounds = self._update_bounds(bounds, float(p.x), float(p.y))
                    if pts:
                        entity_count += 1
            except Exception:
                continue

        # ARC
        for arc in self.msp.query(f'ARC[layer=="{layer_name}"]'):
            try:
                r = float(arc.dxf.radius)
                start_angle = radians(
                    float(getattr(arc.dxf, "start_angle", 0.0) or 0.0)
                )
                end_angle = radians(float(getattr(arc.dxf, "end_angle", 0.0) or 0.0))
                sweep = end_angle - start_angle
                if sweep < 0:
                    sweep += 2 * pi
                total_length += abs(r * sweep)
                entity_count += 1

                cx, cy = float(arc.dxf.center.x), float(arc.dxf.center.y)
                bounds = self._update_bounds(bounds, cx - r, cy - r)
                bounds = self._update_bounds(bounds, cx + r, cy + r)
            except Exception:
                continue

        # CIRCLE
        for circle in self.msp.query(f'CIRCLE[layer=="{layer_name}"]'):
            try:
                r = float(circle.dxf.radius)
                total_length += 2 * pi * r
                entity_count += 1

                cx, cy = float(circle.dxf.center.x), float(circle.dxf.center.y)
                bounds = self._update_bounds(bounds, cx - r, cy - r)
                bounds = self._update_bounds(bounds, cx + r, cy + r)
            except Exception:
                continue

        if total_length <= 0:
            return None

        return {
            "layer_name": layer_name,
            "total_length": round(total_length / 100, 2),
            "unit": "mt",
            "entity_count": entity_count,
            "bounds": bounds,
        }

    # -------------------------
    # Minha hesapları
    # -------------------------
    def _estimate_minha_width(
        self, block_name: str, *, scale_x: float = 1.0, scale_y: float = 1.0
    ) -> float:
        normalized_name = str(block_name or "").upper()

        for token, width in self.MINHA_BLOCK_WIDTHS.items():
            if token in normalized_name:
                return round(width * max(scale_x, 0.1), 2)

        if "KAPI" in normalized_name:
            return round(0.9 * max(scale_x, 0.1), 2)
        if "PEN" in normalized_name or "PENCERE" in normalized_name:
            return round(1.2 * max(scale_x, 0.1), 2)

        if scale_x > 0 or scale_y > 0:
            return round(max(scale_x, scale_y), 2)

        return 0.0

    def _normalize_rotation(self, rotation: float | None) -> float:
        return float(rotation or 0.0) % 180.0

    def _resolve_opening_orientation(self, rotation: float | None) -> str:
        normalized_rotation = self._normalize_rotation(rotation)
        return "vertical" if 45.0 <= normalized_rotation < 135.0 else "horizontal"

    def _resolve_orientation_scale(
        self, *, scale_x: float, scale_y: float, rotation: float | None
    ) -> float:
        orientation = self._resolve_opening_orientation(rotation)
        primary_scale = scale_y if orientation == "vertical" else scale_x
        fallback_scale = scale_x if orientation == "vertical" else scale_y
        return max(float(primary_scale or 0.0), float(fallback_scale or 0.0), 0.1)

    def _estimate_opening_cut(
        self,
        block_name: str,
        *,
        scale_x: float = 1.0,
        scale_y: float = 1.0,
        rotation: float | None = None,
        block_width: float | None = None,
        block_height: float | None = None,
        axis_length: float | None = None,
        axis_orientation: str | None = None,
    ) -> float:
        orientation = axis_orientation or self._resolve_opening_orientation(rotation)

        if float(axis_length or 0.0) > 0:
            axis_scale = scale_y if orientation == "vertical" else scale_x
            fallback_scale = scale_x if orientation == "vertical" else scale_y
            return round(
                float(axis_length or 0.0)
                * max(float(axis_scale or 0.0), float(fallback_scale or 0.0), 0.1),
                2,
            )

        if (block_width or 0) > 0 or (block_height or 0) > 0:
            dominant_axis = block_height if orientation == "vertical" else block_width
            fallback_axis = block_width if orientation == "vertical" else block_height
            geometric_width = max(
                float(dominant_axis or 0.0), float(fallback_axis or 0.0), 0.0
            )

            if geometric_width > 0:
                geometric_scale = scale_y if orientation == "vertical" else scale_x
                fallback_scale = scale_x if orientation == "vertical" else scale_y
                return round(
                    geometric_width
                    * max(
                        float(geometric_scale or 0.0), float(fallback_scale or 0.0), 0.1
                    ),
                    2,
                )

        base_width = self._estimate_minha_width(block_name, scale_x=1.0, scale_y=1.0)
        if base_width <= 0:
            return 0.0

        orientation_scale = self._resolve_orientation_scale(
            scale_x=scale_x, scale_y=scale_y, rotation=rotation
        )
        return round(base_width * orientation_scale, 2)

    def _apply_minha_deduction(
        self, katmanlar: list[dict[str, Any]], minha_elemanlari: list[dict[str, Any]]
    ) -> None:
        wall_layers = [
            layer
            for layer in katmanlar
            if "DUVAR" in str(layer.get("layer_name", "")).upper()
        ]

        for layer in katmanlar:
            layer["minha_deduction"] = 0.0
            layer["net_length"] = round(float(layer.get("total_length") or 0.0), 2)

        if not wall_layers:
            return

        fallback_total_deduction = 0.0
        for item in minha_elemanlari:
            deduction = self._estimate_opening_cut(
                str(item.get("type") or ""),
                scale_x=float(item.get("scale_x") or 1.0),
                scale_y=float(item.get("scale_y") or 1.0),
                rotation=float(item.get("rotation") or 0.0),
                block_width=float(item.get("block_width") or 0.0),
                block_height=float(item.get("block_height") or 0.0),
                axis_length=float(item.get("axis_length") or 0.0),
                axis_orientation=str(item.get("axis_orientation") or "") or None,
            )

            if deduction <= 0:
                continue

            fallback_total_deduction += deduction
            position = item.get("position")
            if not isinstance(position, tuple) or len(position) != 2:
                continue

            nearest_layer = min(
                wall_layers,
                key=lambda layer: self._distance_to_bounds(
                    position, layer.get("bounds")
                ),
                default=None,
            )
            if nearest_layer is None:
                continue

            nearest_layer["minha_deduction"] = round(
                float(nearest_layer.get("minha_deduction") or 0.0) + deduction,
                2,
            )

        assigned_total = round(
            sum(float(layer.get("minha_deduction") or 0.0) for layer in wall_layers),
            2,
        )
        remaining_deduction = round(
            max(fallback_total_deduction - assigned_total, 0.0), 2
        )

        if remaining_deduction > 0:
            total_wall_length = sum(
                float(layer.get("total_length") or 0.0) for layer in wall_layers
            )
            if total_wall_length > 0:
                for layer in wall_layers:
                    total_length = float(layer.get("total_length") or 0.0)
                    layer["minha_deduction"] = round(
                        float(layer.get("minha_deduction") or 0.0)
                        + remaining_deduction * (total_length / total_wall_length),
                        2,
                    )

        for layer in katmanlar:
            total_length = float(layer.get("total_length") or 0.0)
            layer["net_length"] = round(
                max(total_length - float(layer.get("minha_deduction") or 0.0), 0.0),
                2,
            )

    # -------------------------
    # Dosya yükleme
    # -------------------------
    def load_doc(self) -> bool:
        if ezdxf is None:
            print("Hata: ezdxf kutuphanesi yuklu degil")
            return False

        if not self._is_supported_extension():
            print("Hata: Desteklenmeyen CAD dosya uzantisi")
            return False

        ext = Path(self.file_path).suffix.lower()

        try:
            self.doc = ezdxf.readfile(self.file_path)
            self.msp = self.doc.modelspace()
            return True
        except Exception as e:
            # DWG için legacy denemesi
            if ext == ".dwg":
                try:
                    self.doc = ezdxf.readfile(self.file_path, legacy_mode=True)
                    self.msp = self.doc.modelspace()
                    return True
                except Exception as e2:
                    print(f"Hata: DWG okunamadi (legacy dahil) - {e2}")
                    return False

            print(f"Hata: {ext.upper()} okunamadi - {e}")
            return False

    # -------------------------
    # Ana metadata çıkarımı
    # -------------------------
    def extract_metadata(self) -> dict[str, Any] | None:
        try:
            if not self.load_doc():
                return None

            metadata: dict[str, Any] = {
                "proje_ozet": {
                    "kaynak_dosya": Path(self.file_path).name,
                    "pf_katman_sayisi": 0,
                    "pf_blok_sayisi": 0,
                    "minha_adedi": 0,
                    "toplam_minha_dusumu": 0.0,
                },
                "katmanlar": [],
                "bloklar": [],
                "minha_elemanlari": [],
            }

            # Katmanlar
            target_layers = self._iter_target_layers()
            for layer in target_layers:
                layer_metrics = self._extract_layer_metrics(layer)
                if layer_metrics:
                    metadata["katmanlar"].append(layer_metrics)

            # Bloklar
            block_counts: dict[str, int] = {}
            for block in self.msp.query("INSERT"):
                try:
                    name = str(block.dxf.name or "")
                    upper_name = name.upper()
                except Exception:
                    continue

                if upper_name.startswith("PF_"):
                    block_counts[name] = block_counts.get(name, 0) + 1

                    if (
                        "KAPI" in upper_name
                        or "PEN" in upper_name
                        or "PENCERE" in upper_name
                    ):
                        block_extents = (
                            self._extract_block_definition_extents(name) or {}
                        )
                        virtual_opening = (
                            self._extract_insert_virtual_opening(block) or {}
                        )

                        rotation = float(getattr(block.dxf, "rotation", 0.0) or 0.0)
                        orientation = str(
                            virtual_opening.get("orientation")
                            or self._resolve_opening_orientation(rotation)
                        )

                        metadata["minha_elemanlari"].append(
                            {
                                "type": name,
                                "position": (
                                    float(getattr(block.dxf.insert, "x", 0.0)),
                                    float(getattr(block.dxf.insert, "y", 0.0)),
                                ),
                                "scale_x": float(
                                    getattr(block.dxf, "xscale", 1.0) or 1.0
                                ),
                                "scale_y": float(
                                    getattr(block.dxf, "yscale", 1.0) or 1.0
                                ),
                                "rotation": rotation,
                                "orientation": orientation,
                                "axis_orientation": str(
                                    virtual_opening.get("orientation") or ""
                                ),
                                "axis_length": float(
                                    virtual_opening.get("axis_length") or 0.0
                                ),
                                "block_width": float(
                                    virtual_opening.get("width")
                                    or block_extents.get("width")
                                    or 0.0
                                ),
                                "block_height": float(
                                    virtual_opening.get("height")
                                    or block_extents.get("height")
                                    or 0.0
                                ),
                            }
                        )

            for b_name, count in block_counts.items():
                metadata["bloklar"].append(
                    {"block_name": b_name, "count": count, "unit": "adet"}
                )

            # Minha düşümü
            self._apply_minha_deduction(
                metadata["katmanlar"], metadata["minha_elemanlari"]
            )

            # Özet
            metadata["proje_ozet"] = {
                **metadata["proje_ozet"],
                "pf_katman_sayisi": len(metadata["katmanlar"]),
                "pf_blok_sayisi": int(
                    sum(item.get("count", 0) for item in metadata["bloklar"])
                ),
                "minha_adedi": len(metadata["minha_elemanlari"]),
                "toplam_minha_dusumu": round(
                    sum(
                        float(layer.get("minha_deduction") or 0.0)
                        for layer in metadata["katmanlar"]
                    ),
                    2,
                ),
            }

            return metadata

        except Exception as e:
            print(f"Hata: Metadata cikartma basarisiz - {e}")
            return None
