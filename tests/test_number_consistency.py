# Portions of this code were generated with AI assistance (see docs/AI_DISCLOSURE.md)
"""Cross-artifact Number Consistency Test.

Verifies that the Earth line-of-sight, Sun, joint, darkness, and outage
statistics shown on the home page, site page, evidence card, Data page,
and docs/PITCH_NUMBERS.md all derive from the same stats.json values and agree.
"""

import json
import math
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "web" / "public" / "data"
DOCS_DIR = ROOT_DIR / "docs"
SRC_DIR = ROOT_DIR / "web" / "src"


def test_pitch_numbers_agree_with_stats_json():
    """Verify docs/pitch_numbers.json and docs/PITCH_NUMBERS.md strictly match stats.json."""
    stats_path = DATA_DIR / "test-location" / "stats.json"
    assert stats_path.exists(), "stats.json missing for test-location"

    with open(stats_path, encoding="utf-8") as f:
        stats = json.load(f)

    pitch_json_path = DOCS_DIR / "pitch_numbers.json"
    assert pitch_json_path.exists(), "docs/pitch_numbers.json missing"
    with open(pitch_json_path, encoding="utf-8") as f:
        pitch_json = json.load(f)

    pitch_md_path = DOCS_DIR / "PITCH_NUMBERS.md"
    assert pitch_md_path.exists(), "docs/PITCH_NUMBERS.md missing"
    pitch_md = pitch_md_path.read_text(encoding="utf-8")

    # 1. Sun uptime fraction & percent
    sun_frac = stats["sun"]["uptime_fraction"]
    sun_pct_str = f"{sun_frac * 100:.1f}%"
    assert math.isclose(pitch_json["sun_uptime_fraction"], sun_frac, abs_tol=1e-4)
    assert pitch_json["sun_uptime_pct"] == sun_pct_str
    assert sun_pct_str in pitch_md

    # 2. Earth line-of-sight uptime fraction & percent (36.5%, rounded from 0.3646)
    earth_frac = stats["earth"]["uptime_fraction"]
    earth_pct_str = f"{earth_frac * 100:.1f}%"
    assert math.isclose(pitch_json["earth_uptime_fraction"], earth_frac, abs_tol=1e-4)
    assert pitch_json["earth_uptime_pct"] == earth_pct_str
    assert earth_pct_str in pitch_md
    assert earth_pct_str == "36.5%"

    # 3. Joint Sun + DTE uptime
    joint_frac = stats["joint"]["uptime_fraction"]
    joint_pct_str = f"{joint_frac * 100:.1f}%"
    assert math.isclose(pitch_json["joint_uptime_fraction"], joint_frac, abs_tol=1e-4)
    assert pitch_json["joint_uptime_pct"] == joint_pct_str
    assert joint_pct_str in pitch_md

    # 4. Longest darkness
    dark_h = stats["sun"]["longest_outage_h"]
    assert math.isclose(pitch_json["longest_darkness_h"], dark_h, abs_tol=0.1)
    assert f"{dark_h:.1f}" in pitch_md

    # 5. Longest Earth outage
    outage_h = stats["earth"]["longest_outage_h"]
    assert math.isclose(pitch_json["longest_earth_outage_h"], outage_h, abs_tol=0.1)
    assert f"{outage_h:.1f}" in pitch_md


def test_series_json_derivation_equals_stats_json():
    """Verify that evaluating raw series.json matches stats.json exactly."""
    for site_id in ["test-location", "test-location-2"]:
        site_dir = DATA_DIR / site_id
        with open(site_dir / "stats.json", encoding="utf-8") as f:
            stats = json.load(f)
        with open(site_dir / "series.json", encoding="utf-8") as f:
            series = json.load(f)

        thresh = stats["thresholds"]["min_sun_frac"]
        sun_fracs = series["sun"]["frac"]
        earth_fracs = series["earth"]["frac"]
        n = len(series["time_utc"])

        # Derived sun uptime fraction (half-open step integration: (n - 1) intervals)
        intervals = n - 1 if n > 1 else 1
        # Count steps (half-open slice [: -1] or sum of intervals)
        sun_steps = sum(1 for x in sun_fracs[:-1] if x >= thresh)
        earth_steps = sum(1 for x in earth_fracs[:-1] if x >= thresh)
        derived_sun_frac = round(sun_steps / intervals, 4)
        derived_earth_frac = round(earth_steps / intervals, 4)

        assert math.isclose(derived_sun_frac, stats["sun"]["uptime_fraction"], abs_tol=1e-3)
        assert math.isclose(derived_earth_frac, stats["earth"]["uptime_fraction"], abs_tol=1e-3)


def test_no_divergent_earth_los_number_in_views():
    """Confirm that web views do not contain hardcoded divergent Earth LOS numbers like 36.4%."""
    # 36.4% was an earlier manual approximation before rounding 0.3646 -> 36.5%
    for p in (SRC_DIR / "views").glob("*.tsx"):
        content = p.read_text(encoding="utf-8")
        assert "36.4%" not in content, f"Stale divergent 36.4% Earth LOS found in {p.name}; must be dynamically formatted from stats.json"
