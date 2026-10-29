"""Sample smoke test for LightPath CI verification."""

from pipeline.constants import R_MOON_M
from pipeline.geometry import compute_elevation_angle_deg


def test_python_scaffold_smoke():
    """Verify core constants and geometry function execute cleanly."""
    assert R_MOON_M == 1737400.0
    el = compute_elevation_angle_deg(dist_m=1000.0, elev_m=0.0, observer_height_m=0.0)
    assert isinstance(el, float)
    assert el < 0.0
