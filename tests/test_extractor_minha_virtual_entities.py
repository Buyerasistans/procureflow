from types import SimpleNamespace
from math import pi

from api.services.extractor import DWGExtractor


class FakeLine:
    def __init__(self, start, end):
        self.dxf = SimpleNamespace(
            start=SimpleNamespace(x=start[0], y=start[1]),
            end=SimpleNamespace(x=end[0], y=end[1]),
        )

    def dxftype(self):
        return "LINE"


class FakeArc:
    def __init__(self, center, radius, start_angle, end_angle):
        self.dxf = SimpleNamespace(
            center=SimpleNamespace(x=center[0], y=center[1]),
            radius=radius,
            start_angle=start_angle,
            end_angle=end_angle,
        )

    def dxftype(self):
        return "ARC"


class FakeInsert:
    def __init__(self, entities):
        self._entities = entities

    def virtual_entities(self):
        return self._entities


class FakeEllipse:
    def __init__(self, center, major_axis, ratio, start_param=0.0, end_param=2 * pi):
        self.dxf = SimpleNamespace(
            center=SimpleNamespace(x=center[0], y=center[1]),
            major_axis=SimpleNamespace(x=major_axis[0], y=major_axis[1]),
            ratio=ratio,
            start_param=start_param,
            end_param=end_param,
        )

    def dxftype(self):
        return "ELLIPSE"


class FakeSpline:
    def __init__(self, control_points):
        self.control_points = control_points

    def dxftype(self):
        return "SPLINE"


def test_extract_insert_virtual_opening_prefers_longest_axis():
    extractor = DWGExtractor("dummy.dxf")
    insert = FakeInsert(
        [
            FakeLine((0, 0), (150, 0)),
            FakeLine((0, 0), (0, 40)),
        ]
    )

    opening = extractor._extract_insert_virtual_opening(insert)

    assert opening is not None
    assert opening["orientation"] == "horizontal"
    assert opening["axis_length"] == 1.5
    assert opening["width"] == 1.5
    assert opening["height"] == 0.4


def test_estimate_opening_cut_uses_virtual_axis_length_before_bbox():
    extractor = DWGExtractor("dummy.dxf")

    deduction = extractor._estimate_opening_cut(
        "PF_KAPI_90",
        scale_x=1.0,
        scale_y=1.0,
        rotation=90.0,
        block_width=0.9,
        block_height=2.1,
        axis_length=1.4,
        axis_orientation="horizontal",
    )

    assert deduction == 1.4


def test_extract_insert_virtual_opening_uses_arc_span_for_axis_length():
    extractor = DWGExtractor("dummy.dxf")
    insert = FakeInsert([FakeArc((0, 0), 100, 0, 180)])

    opening = extractor._extract_insert_virtual_opening(insert)

    assert opening is not None
    assert opening["orientation"] == "horizontal"
    assert opening["axis_length"] == 2.0
    assert opening["width"] == 2.0
    assert opening["height"] == 1.0


def test_extract_insert_virtual_opening_combines_multi_part_horizontal_segments():
    extractor = DWGExtractor("dummy.dxf")
    insert = FakeInsert(
        [
            FakeLine((0, 0), (80, 0)),
            FakeLine((80, 0), (150, 0)),
            FakeLine((20, 0), (20, 40)),
        ]
    )

    opening = extractor._extract_insert_virtual_opening(insert)

    assert opening is not None
    assert opening["orientation"] == "horizontal"
    assert opening["axis_length"] == 1.5
    assert opening["width"] == 1.5


def test_extract_insert_virtual_opening_supports_ellipse_bounds():
    extractor = DWGExtractor("dummy.dxf")
    insert = FakeInsert([FakeEllipse((0, 0), (120, 0), 0.5)])

    opening = extractor._extract_insert_virtual_opening(insert)

    assert opening is not None
    assert opening["orientation"] == "horizontal"
    assert opening["width"] == 2.4
    assert opening["height"] == 1.2


def test_extract_insert_virtual_opening_supports_spline_control_points():
    extractor = DWGExtractor("dummy.dxf")
    insert = FakeInsert([FakeSpline([(0, 0), (50, 20), (160, 20)])])

    opening = extractor._extract_insert_virtual_opening(insert)

    assert opening is not None
    assert opening["orientation"] == "horizontal"
    assert opening["axis_length"] == 1.6


def test_extract_insert_virtual_opening_combines_ellipse_and_spline_geometry():
    extractor = DWGExtractor("dummy.dxf")
    insert = FakeInsert(
        [
            FakeEllipse((0, 0), (90, 0), 0.4),
            FakeSpline([(0, 0), (40, 10), (190, 10)]),
        ]
    )

    opening = extractor._extract_insert_virtual_opening(insert)

    assert opening is not None
    assert opening["orientation"] == "horizontal"
    assert opening["axis_length"] == 1.9
    assert opening["width"] == 2.8
