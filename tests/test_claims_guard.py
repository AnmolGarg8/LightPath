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
