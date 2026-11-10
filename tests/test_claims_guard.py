"""Unit tests for scripts/claims_guard.py."""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

from scripts.claims_guard import scan_file

ROOT_DIR = Path(__file__).resolve().parent.parent
GUARD_SCRIPT = ROOT_DIR / "scripts" / "claims_guard.py"


def test_claims_guard_passes_on_repository():
    """Verify that scripts/claims_guard.py passes with exit code 0 on the clean repository."""
    proc = subprocess.run(
        [sys.executable, str(GUARD_SCRIPT)],
        capture_output=True,
        text=True,
        cwd=ROOT_DIR,
    )
    assert proc.returncode == 0, f"claims_guard.py failed:\n{proc.stdout}\n{proc.stderr}"
    assert "0 forbidden claims found" in proc.stdout


def test_claims_guard_detects_forbidden_phrase():
    """Verify that scan_file flags forbidden phrases when condition is False."""
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as tf:
        tf.write("This file claims Real NASA LOLA data is loaded.\n")
        bad_path = Path(tf.name)

    try:
        active_forbidden = {"Real NASA LOLA": "has_lola_dem"}
        violations = scan_file(bad_path, active_forbidden)
        assert len(violations) == 1
        assert "forbidden phrase 'Real NASA LOLA'" in violations[0]
    finally:
        bad_path.unlink(missing_ok=True)


def test_ui_text_does_not_contradict_data_status():
    """Verify that footer and page views dynamically adhere to data_status.json."""
    import json

    status_file = ROOT_DIR / "data" / "data_status.json"
    assert status_file.exists(), "data_status.json must exist"
    with open(status_file, "r", encoding="utf-8") as f:
        status = json.load(f)

    # 1. Check Footer.tsx
    footer_path = ROOT_DIR / "web" / "src" / "components" / "layout" / "Footer.tsx"
    footer_text = footer_path.read_text(encoding="utf-8")
    assert "data_status.json" in footer_text, "Footer must dynamically fetch data_status.json"

    # Check that footer does not contain hardcoded contradictory claims
    contradictory_footer_phrases = [
        "approximate analytic ephemeris",
        "to be replaced by SPICE",
        "SPICE kernels pending",
        "analytic approximation",
    ]
    for phrase in contradictory_footer_phrases:
        assert phrase.lower() not in footer_text.lower(), f"Footer contains stale contradictory claim: '{phrase}'"

    # 2. Check all views in web/src/views/
    views_dir = ROOT_DIR / "web" / "src" / "views"
    for view_file in views_dir.glob("*.tsx"):
        content = view_file.read_text(encoding="utf-8")
        if status.get("has_spice_kernels"):
            # When SPICE is active, views should not claim SPICE is pending or using approximate ephemeris as permanent state
            assert "approximate analytic ephemeris" not in content.lower(), f"{view_file.name} contradicts has_spice_kernels=True"
            assert "to be replaced by spice" not in content.lower(), f"{view_file.name} contains stale 'to be replaced by SPICE'"
            assert "spice kernels pending" not in content.lower(), f"{view_file.name} contains stale 'SPICE kernels pending'"

        if not status.get("has_peer_reviewed_benchmark"):
            assert "cross-checked" not in content.lower(), f"{view_file.name} contains unverified cross-checked claim"


def test_margin_consistency_across_artifacts():
    """Verify that margin 0.03 deg is consistent across docs, stats, provenance, and UI."""
    import json

    expected_margin = 0.03

    # 1. stats.json
    for site_id in ["test-location", "synthetic-proving-ground"]:
        stats_path = ROOT_DIR / "web" / "public" / "data" / site_id / "stats.json"
        assert stats_path.exists(), f"stats.json missing for {site_id}"
        with open(stats_path, "r", encoding="utf-8") as f:
            stats = json.load(f)
        assert stats.get("thresholds", {}).get("margin_deg") == expected_margin, (
            f"stats.json thresholds.margin_deg for {site_id} must be {expected_margin}"
        )

    # 2. provenance.json
    for site_id in ["test-location", "synthetic-proving-ground"]:
        prov_path = ROOT_DIR / "web" / "public" / "data" / site_id / "provenance.json"
        assert prov_path.exists(), f"provenance.json missing for {site_id}"
        with open(prov_path, "r", encoding="utf-8") as f:
            prov = json.load(f)
        assert prov.get("parameters", {}).get("margins", {}).get("horizon_margin_deg") == expected_margin, (
            f"provenance.json horizon_margin_deg for {site_id} must be {expected_margin}"
        )

    # 3. docs/terrain_inspection.md
    terrain_doc = (ROOT_DIR / "docs" / "terrain_inspection.md").read_text(encoding="utf-8")
    assert "0.03°" in terrain_doc or "0.03 deg" in terrain_doc
    assert "0.468" in terrain_doc, "95th percentile error (0.468 m) must be stated"
    assert "1,000" in terrain_doc or "1000" in terrain_doc, "1000 m range must be stated"
    assert "0.003" in terrain_doc, "0.003 tilt allowance must be stated"

    # 4. EvidenceView.tsx
    evidence_view = (ROOT_DIR / "web" / "src" / "views" / "EvidenceView.tsx").read_text(encoding="utf-8")
    assert "±0.03°" in evidence_view, "EvidenceView must show ±0.03° margin"
    assert "±0.10°" not in evidence_view, "EvidenceView must not contain old ±0.10° margin"

    # 5. TrustView.tsx
    trust_view = (ROOT_DIR / "web" / "src" / "views" / "TrustView.tsx").read_text(encoding="utf-8")
    assert "0.03°" in trust_view, "TrustView must document the 0.03° margin"

