#!/usr/bin/env python3
"""Claims Guard — Verification of Scientific Claims against Provenance Status.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts; Rule 9: Every number traces to a record).

Scans README.md, docs/, and web/src/ for forbidden phrases implying unverified real-data
sources or benchmarks unless data_status.json explicitly certifies the condition.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Ensure UTF-8 output on Windows
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parent.parent

# Rule mapping: (list of forbidden phrases, required condition key in data_status.json)
CONDITIONAL_RULES: List[Tuple[List[str], str]] = [
    (
        ["Real NASA LOLA", "LOLA topography at"],
        "has_lola_dem",
    ),
    (
        ["DE440", "SPICE ephemerides"],
        "has_spice_kernels",
    ),
    (
        ["JPL Horizons"],
        "has_horizons_fixture",
    ),
    (
        ["peer-reviewed"],
        "has_peer_reviewed_benchmark",
    ),
    (
        ["cross-checked", "verified against"],
        "has_peer_reviewed_benchmark",
    ),
]

# Unconditionally forbidden phrases: stale claims that are never permitted anywhere
UNCONDITIONAL_FORBIDDEN_PHRASES: List[str] = [
    "speeds comparable to a rover",
    "speeds comparable to an uncrewed",
    "twenty kilometers long",
    "20 kilometers long",
    "NASA-standard",
    "nasa standard",
    "Shackleton Connecting Ridge, Malapert Mountain and Nobile Rim",
    "Shackleton Connecting Ridge, Malapert Mountain, and Nobile Rim",
    "Shackleton Connecting Ridge, Malapert Mountain, and Nobile Crater Rim",
]

SCAN_TARGETS = [
    ROOT_DIR / "README.md",
    ROOT_DIR / "docs",
    ROOT_DIR / "web" / "src",
]

ALLOWED_EXTENSIONS = {".md", ".ts", ".tsx", ".json", ".html", ".js", ".css"}


def load_data_status() -> Dict[str, bool]:
    """Load data_status.json if present; otherwise default all flags to False."""
    candidates = [
        ROOT_DIR / "data" / "data_status.json",
        ROOT_DIR / "web" / "public" / "data" / "data_status.json",
    ]
    for c in candidates:
        if c.exists():
            try:
                with open(c, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[WARN] Failed to parse {c}: {e}", file=sys.stderr)

    return {
        "has_lola_dem": False,
        "has_spice_kernels": False,
        "has_horizons_fixture": False,
        "has_peer_reviewed_benchmark": False,
    }


def scan_file(
    file_path: Path,
    active_forbidden: Dict[str, str],
    unconditional_forbidden: Optional[List[str]] = None,
) -> List[str]:
    """Scan a single file for active conditional and unconditional forbidden phrases."""
    if unconditional_forbidden is None:
        unconditional_forbidden = UNCONDITIONAL_FORBIDDEN_PHRASES

    violations = []
    try:
        content = file_path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        print(f"[WARN] Cannot read {file_path}: {e}", file=sys.stderr)
        return violations

    try:
        rel_path = file_path.relative_to(ROOT_DIR)
    except ValueError:
        rel_path = file_path

    for line_no, line in enumerate(content.splitlines(), start=1):
        # 1. Check unconditional forbidden stale claims
        for phrase in unconditional_forbidden:
            pattern = re.compile(re.escape(phrase), re.IGNORECASE)
            if pattern.search(line):
                violations.append(
                    f"{rel_path}:{line_no}: forbidden stale claim '{phrase}' (permanently forbidden per Project Rules)\n"
                    f"    {line.strip()}"
                )

        # 2. Check conditional forbidden phrases
        for phrase, condition in active_forbidden.items():
            pattern = re.compile(re.escape(phrase), re.IGNORECASE)
            if pattern.search(line):
                violations.append(
                    f"{rel_path}:{line_no}: forbidden phrase '{phrase}' (requires {condition}=true)\n"
                    f"    {line.strip()}"
                )

    return violations


def main() -> int:
    status = load_data_status()
    print("[1/2] Evaluated data status conditions:")
    for k, v in status.items():
        print(f"      - {k}: {v}")

    active_forbidden: Dict[str, str] = {}
    for phrases, condition in CONDITIONAL_RULES:
        if not status.get(condition, False):
            for p in phrases:
                active_forbidden[p] = condition

    total_phrases = len(active_forbidden) + len(UNCONDITIONAL_FORBIDDEN_PHRASES)
    print(f"\n[2/2] Scanning README.md, docs/, and web/src/ for {total_phrases} active forbidden phrase(s)...")

    files_to_scan: List[Path] = []
    for target in SCAN_TARGETS:
        if not target.exists():
            continue
        if target.is_file():
            files_to_scan.append(target)
        else:
            for p in target.rglob("*"):
                if p.is_file() and p.suffix.lower() in ALLOWED_EXTENSIONS:
                    # Skip build outputs or tests inside web if any
                    parts = p.parts
                    if "node_modules" in parts or "dist" in parts or ".git" in parts:
                        continue
                    files_to_scan.append(p)

    all_violations: List[str] = []
    for fp in files_to_scan:
        violations = scan_file(fp, active_forbidden, UNCONDITIONAL_FORBIDDEN_PHRASES)
        all_violations.extend(violations)

    if all_violations:
        print(f"\n[FAIL] Claims guard detected {len(all_violations)} violation(s):")
        for v in all_violations:
            print(f"  ✗ {v}")
        print("\nFix: Replace unverified claims with factual status (e.g. synthetic terrain, approximate analytic ephemeris).")
        return 1

    print(f"[PASS] Claims guard: 0 forbidden claims found across {len(files_to_scan)} files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
