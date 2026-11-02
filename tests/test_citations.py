"""Automated tests for citations and external source claim integrity.

Enforces Rule 2 (never invent facts or citations):
- Every external citation, paper, authority, or claim in README.md MUST be documented in docs/CITATIONS.md.
- No bracketed placeholder may be left unexplained.
- Physical claims (tilt per km, polar shadow speed) are validated against exact formulas.
"""

import math
import re
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
README_PATH = ROOT_DIR / "README.md"
CITATIONS_PATH = ROOT_DIR / "docs" / "CITATIONS.md"
PHYSICS_NOTES_PATH = ROOT_DIR / "docs" / "PHYSICS_NOTES.md"
CHALLENGE_STATEMENT_PATH = ROOT_DIR / "docs" / "CHALLENGE_STATEMENT.md"


def test_citations_file_exists_and_non_empty():
    """docs/CITATIONS.md must exist, have valid structure, and document claims."""
    assert CITATIONS_PATH.exists(), "docs/CITATIONS.md does not exist!"
    content = CITATIONS_PATH.read_text(encoding="utf-8")
    assert len(content) > 500, "docs/CITATIONS.md appears too short or incomplete"
    assert "| Claim | Where It Appears |" in content
    assert "Human Verified?" in content
    assert "Action" in content


def test_readme_references_in_citations_md():
    """Every reference, dataset, or outside claim in README.md must be cataloged in docs/CITATIONS.md."""
    assert README_PATH.exists()
    readme_text = README_PATH.read_text(encoding="utf-8")
    citations_text = CITATIONS_PATH.read_text(encoding="utf-8")

    # Key external reference keywords and citations present in README.md
    expected_references = [
        "LOLA",
        "MOON_ME",
        "1,737,400",
        "0.033",
        "0.53",
        "1.90",
        "Fibonacci",
        "DSN",
        "Horn",
        "VIPER",
        "SPICE",
        "DE440",
        "Barker",
    ]

    missing_in_citations = []
    for ref in expected_references:
        # If the reference is cited in README.md, it must be documented in docs/CITATIONS.md
        if ref in readme_text:
            if ref not in citations_text:
                missing_in_citations.append(ref)

    assert not missing_in_citations, (
        f"The following references appear in README.md but are NOT documented in docs/CITATIONS.md: "
        f"{missing_in_citations}"
    )


def test_readme_external_urls_in_citations_md():
    """All external reference URLs in README.md must be present and explained in docs/CITATIONS.md."""
    readme_text = README_PATH.read_text(encoding="utf-8")
    citations_text = CITATIONS_PATH.read_text(encoding="utf-8")

    # Find markdown external links (excluding internal file links like docs/ or LICENSE)
    urls = re.findall(r'https?://[^\s\)`]+', readme_text)
    external_ref_urls = [
        u for u in urls
        if "github.com/AnmolGarg8" not in u
        and "img.shields.io" not in u
        and "localhost" not in u
    ]

    missing_urls = []
    for url in external_ref_urls:
        if url not in citations_text:
            missing_urls.append(url)

    assert not missing_urls, (
        f"The following external URLs appear in README.md but are NOT documented in docs/CITATIONS.md: "
        f"{missing_urls}"
    )


def test_no_unexplained_bracketed_placeholders_in_readme():
    """Any bracketed placeholder in README.md must contain an explicit explanation."""
    readme_text = README_PATH.read_text(encoding="utf-8")

    # Match bracketed placeholders like [PLACEHOLDER...] or [CITATION NEEDED...]
    placeholders = re.findall(r'\[([A-Z_ ]+:[^\]]+)\]', readme_text)

    # Assert that all placeholders have non-empty explanation after the colon
    for ph in placeholders:
        prefix, explanation = ph.split(":", 1)
        assert len(explanation.strip()) > 5, f"Placeholder '{ph}' has insufficient explanation!"

    # Also assert that bare untagged placeholders like [TODO] or [...] do not appear in README
    bare_placeholders = re.findall(r'\[(TODO|FIXME|\.\.\.)\]', readme_text)
    assert not bare_placeholders, f"Bare unexplained placeholders found in README.md: {bare_placeholders}"


def test_track_name_not_in_readme_without_challenge_statement():
    """The track name 'Interactive Lunar Exploration' must not appear unless confirmed in docs/CHALLENGE_STATEMENT.md."""
    assert CHALLENGE_STATEMENT_PATH.exists(), "docs/CHALLENGE_STATEMENT.md must exist!"
    statement_text = CHALLENGE_STATEMENT_PATH.read_text(encoding="utf-8")
    readme_text = README_PATH.read_text(encoding="utf-8")

    unverified_track = "Interactive Lunar Exploration & Trajectory Planning"
    if unverified_track in statement_text and "PLACEHOLDER" not in statement_text:
        # Human has officially confirmed the track
        pass
    else:
        # Until confirmed, it must NOT appear in README.md
        assert unverified_track not in readme_text, (
            f"Unverified track name '{unverified_track}' found in README.md without human confirmation in docs/CHALLENGE_STATEMENT.md!"
        )


def test_curvature_tilt_formula_and_numbers():
    """Verify exact spherical curvature tilt calculation: 1 km / 1737.4 km rad ~= 0.033 deg/km."""
    r_moon_km = 1737.4
    dist_1km = 1.0
    tilt_rad = dist_1km / r_moon_km
    tilt_deg_per_km = math.degrees(tilt_rad)

    # Must be ~0.033 deg/km, NOT 0.1 deg/km
    assert math.isclose(tilt_deg_per_km, 0.032978, abs_tol=1e-4)
    assert f"{tilt_deg_per_km:.3f}" == "0.033"

    # 3 km tilt is ~0.10 deg
    dist_3km = 3.0
    tilt_3km = math.degrees(dist_3km / r_moon_km)
    assert math.isclose(tilt_3km, 0.09893, abs_tol=1e-4)
    assert f"{tilt_3km:.2f}" == "0.10"


def test_shadow_speed_physical_calculation():
    """Verify polar shadow lateral sweep speed formulas documented in docs/PHYSICS_NOTES.md."""
    assert PHYSICS_NOTES_PATH.exists(), "docs/PHYSICS_NOTES.md must exist!"

    # Synodic rotation rate (relative to Sun)
    t_synodic_days = 29.53059
    omega_rad_s = (2.0 * math.pi) / (t_synodic_days * 86400.0)

    # 500m ridge at 1.0 degree solar elevation
    h_m = 500.0
    el_deg = 1.0
    shadow_length_m = h_m / math.tan(math.radians(el_deg))
    assert math.isclose(shadow_length_m, 28645.0, abs_tol=5.0)

    # Lateral speed: v = L * omega
    v_tip_m_s = shadow_length_m * omega_rad_s
    v_tip_cm_s = v_tip_m_s * 100.0
    v_tip_m_h = v_tip_m_s * 3600.0

    # Assert ~7.05 cm/s (~254 m/h), matching VIPER nominal speed (2-10 cm/s)
    assert math.isclose(v_tip_cm_s, 7.05, abs_tol=0.2)
    assert math.isclose(v_tip_m_h, 254.0, abs_tol=5.0)
