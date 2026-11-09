#!/usr/bin/env python3
"""Script to explicitly update committed verification results.

Governed by docs/PROJECT_RULES.md (Rule 1: Correctness before features; Rule 2: Never invent facts).
Tests run normally do not modify tracked files; only this script sets LIGHTPATH_UPDATE_RESULTS=1
and writes tests/results.json and web/public/data/test_results.json from the live test run.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent


def update_results() -> int:
    env = os.environ.copy()
    env["LIGHTPATH_UPDATE_RESULTS"] = "1"

    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "tests/test_verification.py",
        "-v",
    ]

    print("=== Updating Committed Verification Results ===")
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, env=env, cwd=ROOT_DIR)

    if result.returncode == 0:
        print("\nSUCCESS: tests/results.json and web/public/data/test_results.json successfully updated.")
    else:
        print(f"\nFAILURE: pytest exited with code {result.returncode}", file=sys.stderr)

    return result.returncode


if __name__ == "__main__":
    sys.exit(update_results())
